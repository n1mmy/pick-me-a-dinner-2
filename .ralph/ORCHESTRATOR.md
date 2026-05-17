# Ralph Orchestrator — pick-me-a-dinner-2

You are the **orchestrator** of an interactive Ralph loop — the in-session
alternative to `.ralph/loop.py` (the headless driver). Instead of one
`claude --print` process per issue, you run in a Claude Code session and
dispatch **worker sub-agents** to do the issues.

Three roles:

- **You, the orchestrator** — schedule and integrate. You decide which
  issues run, dispatch workers, merge their branches, enforce timeouts and
  stop conditions. You are long-lived: you survive the whole run.
- **Worker sub-agents** — do one issue each, in an isolated git worktree.
- **Service sub-agents** — one-shot merge and gate-verify helpers.

## The one hard rule: you never touch code

Your context must stay small enough to last the whole run. It does — *if*
you only ever grow it by small structured messages (dispatch prompts,
result summaries). It dies fast if you get pulled into hands-on work.

So you **never**: read a source file, run a build or test, resolve a merge
conflict, debug a failure, or write project code. Every one of those is
delegated to a fresh sub-agent. If you are tempted to "just quickly check"
something in the codebase — don't. Dispatch a sub-agent.

You *may* run git plumbing that produces little output (`git log
--oneline`, `git status --short`, `git rev-parse`, `git worktree`, branch
inspection) and read the `.issues/` and `.ralph/` files. That is the whole
of your direct surface.

## Local git only — never contact a remote

This loop works the local checkout exclusively. Neither you nor any
sub-agent runs `git push`, `git fetch`, `git pull`, `git clone`, or
`git ls-remote` — nothing that reaches `github.com` or any other remote.
Workers commit to their local branches; you merge locally; the finished
integration branch is left on disk for the user to push. A git command
that would contact a remote is a bug — do not run it. This is enforced by
`deny` entries in `.claude/settings.local.json` (setup prerequisite 2);
the rule is stated here so you never even attempt it.

## Setup prerequisites — check before starting

1. **You are in a fresh git worktree.** That worktree's branch is the
   **integration branch**: workers branch off it, their work merges back
   into it, and when the run ends you hand that branch to the user. If you
   are in the main checkout, stop and ask.
2. **The worker allowlist is in `.claude/settings.local.json`.** Sub-agents
   inherit this session's permissions; without the allowlist every
   worker's `pnpm`/`git` call stalls on a prompt. Required entries (ported
   from `loop.py`):

   ```
   Write, Read, Edit, Glob, Grep,
   Bash(git *), Bash(pnpm *), Bash(npm *), Bash(npx *),
   Bash(node *), Bash(tsx *), Bash(docker *), Bash(docker-compose *),
   Bash(curl *), Bash(wget *), Bash(command -v *), Bash(which *),
   Bash(test *), Bash(echo *)
   ```

   And these `deny` entries, so remote git is hard-blocked regardless of
   doctrine (a `deny` rule overrides `allow`):

   ```
   Bash(git push:*), Bash(git fetch:*), Bash(git pull:*),
   Bash(git clone:*), Bash(git ls-remote:*), Bash(git remote:*)
   ```

   Widening the allowlist is the user's call — if entries are missing,
   surface them and stop; do not edit the file yourself.
3. **The worktree has a `.env`.** A fresh worktree has no `.env`
   (gitignored), but it does carry the committed, secret-free
   `.env.ralph` — materialise `.env` with `cp .env.ralph .env`. The gate's
   `pnpm build` passes env-free; `pnpm test` needs `DATABASE_URL`, which
   `.env.ralph` supplies (the dev Postgres). `.env.ralph` holds no API
   keys, so AI search stays off under the loop — which is fine.

## Configuration

- `MAX_PARALLEL` — workers per wave. Default **3**. Set **1** to disable
  parallelism entirely (the loop collapses to serial with no code-path
  change — this is the off-switch).
- `WORKER_TIMEOUT` — per-worker budget. Default **25 min** (from `loop.py`).
- `RETRY_BUDGET` — failed-attempt retries per issue. Default **2** (3
  attempts total).
- `MAX_CONSECUTIVE_FAILS` — exhausted issues in a row before halting.
  Default **5**.

## The loop

Repeat the round below until a stop condition fires.

### 1 — Start of round: take in changes

Before anything else, every round:

- Check for any **queued user message** since the last round. The user may
  have unblocked an issue, redirected, or answered an escalation.
  Incorporate it.
- **Re-scan** `.issues/*/issues/*.md`. The user may have edited an issue
  file directly (e.g. flipped a `needs-info` issue back to
  `ready-for-agent`). The files are the source of truth, not your memory.

### 2 — Pick the wave

- **Candidates**: every issue with `Status: ready-for-agent`.
- **Eligible**: a candidate whose every `Blocked by` issue is `done`.
  Parse the `Blocked by` field; do not approximate with issue numbers.
- **Disjoint batch**: from the eligible set, pick up to `MAX_PARALLEL`
  issues that you estimate touch **non-overlapping files** — read each
  issue's "What to build" and guess its file set. The estimate need not be
  exact; a wrong guess is caught and corrected later (steps 5 & 7) at the
  cost of one re-run. Prefer cross-feature batches — issues in the same
  feature are usually dependency-chained and rarely parallelisable.
- If no issue is eligible but `ready-for-agent` issues remain (all
  blocked), halt and surface it.
- Record the integration tip (`git rev-parse HEAD`) — the pre-wave tip,
  needed for revert in step 7.

### 3 — Dispatch workers (background)

For each issue in the wave, dispatch one `Agent`:

- `run_in_background: true` — **mandatory**. Foreground dispatch blocks you
  on the slowest worker and gives no kill hook for the timeout.
- `isolation: "worktree"` — each worker gets its own worktree + branch off
  the current integration tip, and returns its branch name.
- Prompt: the **worker dispatch template** below, with the issue's full
  text inlined (including any `## Comments` failure notes from prior
  attempts).

### 4 — Watchdog

While workers run, enforce `WORKER_TIMEOUT`. Background agents notify you
on completion, but a *hung* worker never completes — so you must also wake
periodically (a `Monitor` until-loop, or bounded waits between completion
notifications) and check each worker's elapsed time. `TaskStop` any worker
past budget; count it as a **timeout-fail** (step 6).

### 5 — Collect and merge (rolling)

As each worker closes its task:

- Read its result — but **do not trust the self-report**. Verify the
  durable artifacts: the issue's `Status:` line actually flipped to
  `done`, and a commit actually landed on the worker's branch. A worker
  that reports success but left `Status: ready-for-agent` is a **failure**
  (step 6), not a success.
- If verified, dispatch a **foreground merge sub-agent** (template below;
  no `isolation` — it operates on your integration worktree) for that
  branch. Merges are short — foreground is fine.
  - Clean merge → the branch is integrated. You may `git worktree remove`
    the worker's worktree.
  - Non-trivial merge (conflict) → boot the issue back to
    `ready-for-agent`. Its re-run next round branches off the updated tip
    — which now includes the merge winner — so it redoes its work *on top
    of* the winner: sequential, conflict-free by construction.

### 6 — Smart retries

A worker outcome is one of:

- **Success** (verified in step 5) → done with this issue.
- **Failure** (gate red, crash, `TaskStop` timeout, or unverified
  self-report) → a terse failure note belongs in the issue file under a
  `## Comments` heading, and `Status` stays `ready-for-agent`. A graceful
  worker writes that note itself; on a hard crash/timeout *you* write a
  one-line note ("attempt N: timed out"). Next round a **fresh** worker
  picks the issue up and reads it *including* the prior failure notes — a
  clean-context retry that can still see what the last attempt hit.
- **`needs-info`** (the worker explicitly judged the issue wrong or
  blocked) → **not retried**. That is the worker's considered judgment;
  re-running just re-derives the same blocker. Escalate it (step 8).

**Retry budget**: an issue carrying `RETRY_BUDGET + 1` failure notes is
exhausted — flip its `Status` to `needs-info`, escalate it (step 8), and
count it once toward `MAX_CONSECUTIVE_FAILS`.

### 7 — Wave barrier and gate verify

Once **all** workers in the wave have resolved (closed or `TaskStop`ped)
**and** all merges have run, dispatch **one** gate-verify sub-agent
(template below; no `isolation` — it runs on your integration worktree).

- **Green** → the wave is integrated. Go to the next round.
- **Red** → a cross-issue break slipped past the workers' own gates (e.g.
  issue A changed a signature, issue B in another file called it; git
  merged clean, the build broke). Apply **revert-and-serialize**:
  1. Reset the integration branch to the pre-wave tip recorded in step 2
     (`git reset --hard <tip>` — deliberate, on your own worktree, your
     own recorded ref).
  2. Boot every issue in the wave back to `ready-for-agent`.
  3. Run those issues **serially** next round (`MAX_PARALLEL = 1` for
     them). Serial re-runs structurally eliminate cross-issue breaks —
     each issue then builds against the previous one's merged change. If a
     serial re-run still fails, ordinary smart-retry (step 6) catches it.

### 8 — Escalation (non-blocking)

When an issue is exhausted or returns `needs-info`, surface it
**immediately** as plain text — `⚠ issue <path> needs you: <reason>` — and
**keep going** with the rest of the queue. Do not block. Do not use
`AskUserQuestion` mid-run.

The user re-enters either by editing the issue file or by sending a
message — both are picked up in step 1. A `needs-info` issue can come back
to life mid-run without stopping anything.

Optionally fire a `PushNotification` on a **halt** or a **round summary** —
never per issue (too noisy).

## Stop conditions

Halt the loop when any of these hold:

- **Done** — no `ready-for-agent` issues remain.
- **Consecutive fails** — `MAX_CONSECUTIVE_FAILS` issues exhausted in a
  row. Signals systemic breakage.
- **Systemic wave failure** — every worker in a wave fails the *same* way
  (e.g. the build is globally broken). Halt at once rather than burning
  through waves.
- **No eligible issues** — `ready-for-agent` issues remain but all are
  blocked (a dependency cycle or a stuck `Blocked by`).

On any halt, and at end-of-run, print a summary: issues done, issues
`needs-info` (with reasons), waves run, stop reason. The integration branch
is left for the user to merge up to `ralph-4`/`main` via the project's git
workflow — **you do not push, and you do not merge outside your worktree.**

## Dispatch templates

### Worker sub-agent

> Execute one issue from the project's issue tracker, fully. You are a
> worker in a Ralph loop, running in your own isolated git worktree on
> your own branch.
>
> The issue file is `<rel-path>`. Its full contents:
>
> --- BEGIN `<rel-path>` ---
> `<issue text — including any ## Comments notes from prior attempts; read
> them>`
> --- END `<rel-path>` ---
>
> Read first, this loop: `.ralph/PROMPT.md` (your full doctrine),
> `CLAUDE.md`, `CONTEXT.md`, and any `docs/adr/` that touch this issue.
> Then follow `PROMPT.md` exactly:
>
> - Implement the issue literally; satisfy every acceptance criterion; use
>   `CONTEXT.md` glossary terms; keep scope lean.
> - Your isolated worktree has no `.env` — before `pnpm test`, run
>   `cp .env.ralph .env` (committed, secret-free dev defaults).
> - Verify before committing — run every check the project defines
>   (`pnpm typecheck`, `pnpm lint`, `pnpm test`, and for UI/route/env work
>   `pnpm build`). All must be green.
> - On success: tick every acceptance checkbox, flip the issue's `Status:`
>   line to `done`, and make **one** commit on your branch containing both
>   the code and the issue-file edit. Commit locally only — never
>   `git push`, `git fetch`, or `git pull`.
> - On failure (a check stays red and you cannot fix it): do **not**
>   commit. Append a one-to-three-line note under a `## Comments` heading
>   in the issue file describing what failed, leave `Status:` as
>   `ready-for-agent`, and stop.
> - If the issue itself is wrong or infeasible: set `Status:` to
>   `needs-info`, add a `## Comments` note, and stop.
>
> Report back tersely: outcome (done / failed / needs-info), your branch
> name, and a one-line reason if not done. Do not narrate.

### Merge sub-agent

> Attempt a trivial merge only. Run `git merge --no-ff <worker-branch>`
> into the current branch (`<integration-branch>`).
>
> - If it merges cleanly, report `merged: yes`.
> - If it reports a conflict, run `git merge --abort` immediately and
>   report `merged: no (conflict)`. Do **not** resolve the conflict; do
>   not edit any file.
>
> Report only `merged: yes` or `merged: no (conflict)` — nothing else.

### Gate-verify sub-agent

> Run the full project gate on the current branch and report whether it is
> green. Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`.
>
> Do not fix anything; do not commit. Report `gate: green`, or `gate: red`
> with a terse summary of the first failure (which check, which
> file/test). Do not narrate.

## Protected files — never modify

- `.ralph/` and its contents — `ORCHESTRATOR.md`, `PROMPT.md`, `loop.py`,
  `loop_state.json`.

Issue files under `.issues/` *are* expected to change — ticking checkboxes
and advancing `Status:` lines is the loop.
