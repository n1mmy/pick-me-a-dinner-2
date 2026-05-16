#!/usr/bin/env python3
"""
Ralph loop orchestrator — drives Claude Code through the ready-for-agent
issues in `.issues/<feature>/issues/`, one issue per invocation.

Adapted from the wine-inventory `scripts/loop.py`. That project kept its
task list in a single `.ralph/fix_plan.md` with `- [ ]` checkboxes; this
project tracks work as individual issue files under `.issues/` (see
`docs/agents/issue-tracker.md`), so task discovery scans those files and
keys off each issue's `Status:` line instead of a checkbox.

Run from the repo root:

    python3 .ralph/loop.py

Ctrl-C once: sends SIGTERM to the claude subprocess group, lets it
cleanup, exits when it does. Ctrl-C twice: forces a Python
KeyboardInterrupt and exits immediately.

State is written to `.ralph/loop_state.json` (calls/hour, consecutive
fails, hour bucket); it is gitignored and regenerated.
"""

import argparse
import json
import os
import re
import signal
import subprocess
import sys
import time
from pathlib import Path

REPO       = Path.cwd()
RALPH      = REPO / ".ralph"
PROMPT     = (RALPH / "PROMPT.md").read_text()  # existence sanity check
STATE_FILE = RALPH / "loop_state.json"

# Issue files live at `.issues/<feature>/issues/<NN>-<slug>.md`.
ISSUES_GLOB     = ".issues/*/issues/*.md"
READY_STATUS    = "ready-for-agent"
STATUS_RE       = re.compile(r"^Status:\s*(.+)$", re.MULTILINE)
ISSUE_NUM_RE    = re.compile(r"\d+")

DEFAULT_MAX_CALLS_PER_HOUR    = 100
DEFAULT_MAX_CONSECUTIVE_FAILS = 5
DEFAULT_LOOP_TIMEOUT_SEC      = 1500  # 25 min

# Populated from CLI args in main().
MAX_CALLS_PER_HOUR    = DEFAULT_MAX_CALLS_PER_HOUR
MAX_CONSECUTIVE_FAILS = DEFAULT_MAX_CONSECUTIVE_FAILS
LOOP_TIMEOUT_SEC      = DEFAULT_LOOP_TIMEOUT_SEC


def next_issue():
    """Return `(path, text)` for the lowest-numbered issue file whose
    `Status:` line is `ready-for-agent`, or None when there are none.

    Issues are numbered in dependency order (`Blocked by` always points
    at lower numbers), so lowest-number-first respects the dependency
    graph without parsing it. A failed loop leaves its issue at
    `ready-for-agent`, so the next loop naturally retries the same one.
    """
    candidates = []
    for path in sorted(REPO.glob(ISSUES_GLOB)):
        text = path.read_text()
        m = STATUS_RE.search(text)
        if not m or m.group(1).strip() != READY_STATUS:
            continue
        num_m = ISSUE_NUM_RE.search(path.name)
        num = int(num_m.group(0)) if num_m else 9999
        candidates.append((num, path, text))
    if not candidates:
        return None
    candidates.sort(key=lambda c: (c[0], c[1].name))
    _, path, text = candidates[0]
    return path, text


def load_state():
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {"calls": 0, "hour": int(time.time() // 3600), "fails": 0}


def save_state(s):
    STATE_FILE.write_text(json.dumps(s, indent=2))


def format_duration(seconds):
    """Format a duration as h/m/s, trimming leading zero units."""
    seconds = int(seconds)
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    if h:
        return f"{h}h {m}m {s}s"
    if m:
        return f"{m}m {s}s"
    return f"{s}s"


def print_session_summary(stats):
    elapsed = time.time() - stats["start_time"]
    loops = stats["loops"]
    print()
    print("[session]")
    print(f"  elapsed:       {format_duration(elapsed)}")
    if not loops:
        print("  loops run:     0")
        return
    successes = sum(1 for l in loops if l["status"])
    failures  = len(loops) - successes
    total_dur = sum(l["wall_time"] for l in loops)
    avg_dur   = total_dur / len(loops)
    turn_vals = [l["turns"] for l in loops if isinstance(l["turns"], int)]
    avg_turns = (sum(turn_vals) / len(turn_vals)) if turn_vals else None

    print(f"  loops run:     {len(loops)} ({successes} ok, {failures} failed)")
    print(f"  avg loop time: {format_duration(avg_dur)}")
    if avg_turns is not None:
        print(f"  avg turns:     {avg_turns:.1f}  (over {len(turn_vals)}/"
              f"{len(loops)} loops that reported)")
    else:
        print("  avg turns:     — (no loop reported turn count)")


def run_loop():
    """One claude invocation.

    Returns None when no ready-for-agent issues are left, otherwise a
    dict `{"status": bool, "wall_time": float, "turns": int|None,
    "issue": str}` where `issue` is the repo-relative issue path.
    """
    picked = next_issue()
    if picked is None:
        print("[done] no ready-for-agent issues")
        return None
    issue_path, issue_text = picked
    rel = issue_path.relative_to(REPO).as_posix()

    # Keep the user message tight — Claude Code auto-loads CLAUDE.md and
    # `.ralph/PROMPT.md` is too long to repeat every turn. We state the
    # issue, the verification gate, and the completion requirement.
    prompt = f"""Execute one issue from the project's issue tracker, fully.

The issue file is `{rel}`. Its full contents:

--- BEGIN {rel} ---
{issue_text}
--- END {rel} ---

Doctrine summary (the full version is in `.ralph/PROMPT.md` — read it
first this loop, along with `CLAUDE.md`, `CONTEXT.md`, and any ADRs in
`docs/adr/` that touch this issue):

1. Implement the issue. Follow its "What to build" literally and
   satisfy every "Acceptance criteria" checkbox. Use the CONTEXT.md
   glossary terms in code, tests, and copy.
2. Verify before committing — every check the project defines must be
   green. Run whichever of these `package.json` exposes: `pnpm
   typecheck`, `pnpm lint`, `pnpm test`, and for UI / route / env work
   also `pnpm build`. (Issue 01 scaffolds these scripts; that issue is
   done only once they exist and pass.)
3. Commit with a descriptive message focused on the *why*.
4. In the issue file `{rel}`: tick every acceptance-criteria checkbox
   (`[ ]` → `[x]`) and change the `Status:` line from `ready-for-agent`
   to `done`. Commit that edit too.
5. Stop. Do NOT pull the next issue into the same loop.

If the issue is genuinely blocked or unsafe to complete, change its
`Status:` line to `needs-info`, add a one-line explanation under a
`## Comments` heading at the end of the file, and stop — do NOT commit
a placeholder file or partial work.
"""
    print(f"[loop] {rel}")

    # Allowlist for `--allowedTools`. Broad enough for git + pnpm/node
    # workflows, narrower than `bypassPermissions` (no apt/pip/sudo/rm/
    # mkdir/mv/cp/raw shell). File mgmt is intentionally absent — Claude
    # uses `git rm` (tracked), `Write` (auto-creates parents), or
    # `git mv`. Outside-tree mutations are structurally impossible
    # without `rm`/`mv`.
    allowed_tools = " ".join([
        "Write", "Read", "Edit", "Glob", "Grep",
        "Bash(git *)",
        "Bash(pnpm *)", "Bash(npm *)", "Bash(npx *)",
        "Bash(node *)", "Bash(tsx *)",
        "Bash(docker *)", "Bash(docker-compose *)",
        "Bash(curl *)", "Bash(wget *)",
        "Bash(command -v *)", "Bash(which *)",
        "Bash(test *)", "Bash(echo *)",
    ])

    proc = subprocess.Popen(
        # `--verbose` is required by claude when --print is paired with
        # --output-format stream-json; without it the CLI errors out
        # before producing any events.
        ["claude", "--print", "--output-format", "stream-json", "--verbose",
         "--allowedTools", allowed_tools],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        preexec_fn=os.setsid,  # new process group → clean signal forwarding
    )

    def on_sigint(_sig, _frame):
        print("\n[interrupt] SIGTERM → claude (Ctrl-C again to force exit)")
        signal.signal(signal.SIGINT, signal.SIG_DFL)  # second Ctrl-C → KeyboardInterrupt
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
    signal.signal(signal.SIGINT, on_sigint)

    proc.stdin.write(prompt)
    proc.stdin.close()

    start, final = time.time(), None
    for line in proc.stdout:
        if time.time() - start > LOOP_TIMEOUT_SEC:
            print(f"[timeout] >{LOOP_TIMEOUT_SEC}s, killing")
            os.killpg(proc.pid, signal.SIGTERM)
            break
        try:
            ev = json.loads(line)
        except json.JSONDecodeError:
            continue

        # Live tool-use stream.
        if ev.get("type") == "assistant":
            for block in ev["message"]["content"]:
                if block.get("type") == "tool_use":
                    inp = block.get("input", {})
                    short = (inp.get("command") or inp.get("file_path") or "")[:80]
                    print(f"  → {block['name']}: {short}")
        elif ev.get("type") == "result":
            final = ev

    proc.wait()
    signal.signal(signal.SIGINT, signal.SIG_DFL)  # restore default between loops
    wall_time = time.time() - start
    turns_raw = final.get("num_turns") if final else None
    turns = turns_raw if isinstance(turns_raw, int) else None

    if final is None or final.get("is_error"):
        msg = final.get("result") if final else "no result emitted"
        print(f"[loop] failed: {msg!r}")
        return {"status": False, "wall_time": wall_time, "turns": turns,
                "issue": rel}
    result_text = (final.get("result") or "").strip().splitlines()
    headline = result_text[0][:120] if result_text else ""
    turns_label = turns if turns is not None else "?"
    print(f"[loop] ok in {final['duration_ms']/1000:.1f}s ({turns_label} turns)")
    if headline:
        print(f"       result: {headline}")
    return {"status": True, "wall_time": wall_time, "turns": turns,
            "issue": rel}


def main():
    global MAX_CALLS_PER_HOUR, MAX_CONSECUTIVE_FAILS, LOOP_TIMEOUT_SEC

    p = argparse.ArgumentParser(
        description="Drive Claude Code through ready-for-agent issues in "
                    ".issues/, one issue per invocation.",
    )
    p.add_argument("--max-calls", type=int, default=DEFAULT_MAX_CALLS_PER_HOUR,
                   help=f"Max claude invocations per hour (default: {DEFAULT_MAX_CALLS_PER_HOUR})")
    p.add_argument("--max-fails", type=int, default=DEFAULT_MAX_CONSECUTIVE_FAILS,
                   help=f"Stop after N consecutive failed loops (default: {DEFAULT_MAX_CONSECUTIVE_FAILS})")
    p.add_argument("--timeout", type=int, default=DEFAULT_LOOP_TIMEOUT_SEC,
                   help=f"Per-loop timeout in seconds (default: {DEFAULT_LOOP_TIMEOUT_SEC})")
    p.add_argument("--reset", action="store_true",
                   help="Delete .ralph/loop_state.json (resets call counter and consecutive-fail counter) and exit.")
    args = p.parse_args()
    if args.reset:
        if STATE_FILE.exists():
            STATE_FILE.unlink()
            print(f"[reset] removed {STATE_FILE}")
        else:
            print(f"[reset] no state file at {STATE_FILE}")
        return

    MAX_CALLS_PER_HOUR    = args.max_calls
    MAX_CONSECUTIVE_FAILS = args.max_fails
    LOOP_TIMEOUT_SEC      = args.timeout

    state = load_state()
    stats = {"start_time": time.time(), "loops": []}
    prev = None  # previous loop's result dict
    try:
        while True:
            now_hour = int(time.time() // 3600)
            if now_hour != state["hour"]:
                state = {"calls": 0, "hour": now_hour, "fails": state["fails"]}

            if state["calls"] >= MAX_CALLS_PER_HOUR:
                print(f"[stop] rate-limit ({MAX_CALLS_PER_HOUR}/h)")
                break
            if state["fails"] >= MAX_CONSECUTIVE_FAILS:
                print(f"[stop] {MAX_CONSECUTIVE_FAILS} consecutive failures — investigate")
                break

            state["calls"] += 1
            result = run_loop()
            if result is None:
                break
            stats["loops"].append(result)

            # Stuck-loop guard: a "successful" loop that left the same
            # issue at ready-for-agent never advanced its Status line.
            # Without this the loop would re-run the same issue until
            # the hourly rate-limit, all reported as successes.
            if (prev and prev["status"] and result["status"]
                    and prev["issue"] == result["issue"]):
                print(f"[stop] {result['issue']} still ready-for-agent after "
                      "a successful loop — Status not advanced to `done`; "
                      "investigate")
                break
            prev = result

            state["fails"] = 0 if result["status"] else state["fails"] + 1
            save_state(state)
            time.sleep(2)
    finally:
        print_session_summary(stats)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[exit]")
        sys.exit(0)
