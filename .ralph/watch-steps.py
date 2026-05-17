#!/usr/bin/env python3
"""Live step viewer for Ralph orchestrator worker sub-agents.

Run this in a separate terminal while an orchestrator run is in progress. It
tails the Claude Code background-agent transcript files and prints one compact
line per tool call — `Read x`, `Edit y`, `Bash pnpm test` — and nothing else:
no tool output, no full transcript, no narration.

It is a plain process, not an agent: nothing it reads or prints touches any
agent's context, so it never bloats the orchestrator. This is the human-facing
side channel that the orchestrator's "do not narrate" rule deliberately leaves
room for — step visibility for you, a terse return message for the orchestrator.

Usage:
    python3 .ralph/watch-steps.py                 # watch — project = cwd
    python3 .ralph/watch-steps.py /path/to/worktree   # watch a given worktree
    python3 .ralph/watch-steps.py some-agent.output   # replay one transcript

Stop with Ctrl-C.
"""
import glob
import json
import os
import sys
import time

POLL_SECONDS = 0.5


def tasks_pattern(project_dir):
    """Glob for the transcript files of background agents dispatched from
    `project_dir`. The harness files them under a slug of the dispatching
    worktree's absolute path, with both `/` and `.` flattened to `-`."""
    uid = os.getuid()
    slug = os.path.abspath(project_dir).rstrip("/").replace("/", "-").replace(".", "-")
    return f"/private/tmp/claude-{uid}/{slug}/*/tasks/*.output"


def shorten(value, limit=72):
    text = " ".join(str(value).split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


def relpath(path):
    """Strip the absolute / worktree prefix so a file shows as its repo-relative
    path (`.ralph/PROMPT.md`, `app/catalog/page.tsx`) rather than a long,
    truncated absolute path into some `worktrees/agent-xxxx/` checkout."""
    path = str(path)
    marker = "/worktrees/"
    cut = path.find(marker)
    if cut != -1:
        rest = path[cut + len(marker):]
        slash = rest.find("/")
        if slash != -1:
            return rest[slash + 1:]
    parts = path.rstrip("/").split("/")
    return "/".join(parts[-2:]) if len(parts) > 1 else path


def describe(tool, tool_input):
    tool_input = tool_input or {}
    if tool in ("Read", "Edit", "Write", "NotebookEdit"):
        return shorten(relpath(tool_input.get("file_path", "")))
    if tool == "Bash":
        return shorten(tool_input.get("command", ""))
    if tool in ("Grep", "Glob"):
        target = tool_input.get("pattern", "")
        if tool_input.get("path"):
            target += f"  in {tool_input['path']}"
        return shorten(target)
    if tool in ("Agent", "Task"):
        return shorten(tool_input.get("description", ""))
    for value in tool_input.values():
        if isinstance(value, str) and value.strip():
            return shorten(value)
    return ""


def find_tool_uses(node):
    """Recursively collect every (tool name, input) pair in a transcript event,
    robust to however the event nests its content blocks."""
    found = []
    if isinstance(node, dict):
        if node.get("type") == "tool_use":
            found.append((node.get("name", "?"), node.get("input")))
        for value in node.values():
            found.extend(find_tool_uses(value))
    elif isinstance(node, list):
        for value in node:
            found.extend(find_tool_uses(value))
    return found


def worker_label(path):
    return os.path.basename(path)[:8]


def emit(label, raw):
    try:
        event = json.loads(raw)
    except json.JSONDecodeError:
        return
    for tool, tool_input in find_tool_uses(event):
        print(f"  [{label}] {tool:9} {describe(tool, tool_input)}", flush=True)


def replay(path):
    print(f"[watch-steps] replaying {path}\n", flush=True)
    label = worker_label(path)
    with open(path, "rb") as handle:
        for raw in handle:
            raw = raw.strip()
            if raw:
                emit(label, raw)


def watch(project_dir):
    pattern = tasks_pattern(project_dir)
    print(f"[watch-steps] watching {pattern}", flush=True)
    print("[watch-steps] waiting for the orchestrator to dispatch workers…\n", flush=True)

    # Files present when the viewer starts belong to earlier runs — skip their
    # backlog and only show steps that happen from now on.
    offsets = {path: os.path.getsize(path) for path in glob.glob(pattern)}

    while True:
        for path in sorted(glob.glob(pattern)):
            if path not in offsets:
                offsets[path] = 0
                print(f"\n── worker {worker_label(path)} ──", flush=True)
            try:
                size = os.path.getsize(path)
            except OSError:
                continue
            if size <= offsets[path]:
                continue
            with open(path, "rb") as handle:
                handle.seek(offsets[path])
                data = handle.read()
            cut = data.rfind(b"\n")
            if cut == -1:
                continue  # only a partial line so far — wait for the rest
            offsets[path] += cut + 1
            label = worker_label(path)
            for raw in data[: cut + 1].split(b"\n"):
                raw = raw.strip()
                if raw:
                    emit(label, raw)
        time.sleep(POLL_SECONDS)


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else "."
    if os.path.isfile(arg):
        replay(arg)
    else:
        watch(arg)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[watch-steps] stopped.", flush=True)
