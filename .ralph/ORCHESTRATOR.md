# Ralph Orchestrator — pick-me-a-dinner-2

You are the **orchestrator** of an interactive Ralph loop — the in-session
alternative to `.ralph/loop.py` (the headless driver). Instead of one
`claude --print` process per issue, you run in a Claude Code session and
dispatch **worker sub-agents** to do the issues.

Two roles:

- **You, the orchestrator** — schedule and integrate. You decide which
  issues run, dispatch workers, merge their branches into the integration
  branch, run the gate, enforce stop conditions. You are long-lived: you
  survive the whole run.
- **Worker sub-agents** — do one issue each, in an isolated git worktree.

This harness isolates **every** `Agent` call into its own throwaway git
worktree, whether or not `isolation` is set. A merge or gate sub-agent
therefore cannot operate on the integration branch — its commit would land
on a throwaway branch, and its gate would test the wrong tree. So merging
and gate-verify are **not** delegated: the orchestrator runs them itself,
directly in the integration worktree (see steps 5 and 7).

## The hard rule: you never touch code

Your context must stay small enough to last the whole run. It does — *if*
you only ever grow it by small structured messages (dispatch prompts,
result summaries, bounded git and gate output). It dies fast if you get
pulled into hands-on work.

So you **never**: read a source file, resolve a merge conflict, debug a
failure, or write project code. Every one of those is delegated to a fresh
worker sub-agent. If you are tempted to "just quickly check" something in
the codebase — don't. Dispatch a sub-agent.

You *do*, directly, two things that integrate the run — because the harness
isolates every sub-agent and so neither can be delegated:

- **Merge** a verified worker branch into the integration branch with `git
  merge --no-ff` (step 5). A clean merge is tiny output. A merge that
  conflicts is aborted immediately — you never resolve the conflict, you
  boot the issue back to a worker.
- **Run the gate** on the integration branch (step 7) — `pnpm typecheck`,
  `lint`, `test`, `test:db`, `build`. You read only pass/fail; you never
  fix a red gate yourself, you revert-and-serialize (step 7).

Beyond those, you *may* run git plumbing that produces little output (`git
log --oneline`, `git status --short`, `git rev-parse`, `git worktree`,
branch inspection) and read the `.issues/` and `.ralph/` files. That is the
whole of your direct surface.

Read those files the same way a worker does — `CLAUDE.md` "Tool &
permissions discipline" binds you, not just the sub-agents. Use `Read`,
`Glob`, and `Grep`; never `Bash` `cat`/`ls`/`grep`/`find` to inspect
`.issues/` or `.ralph/`. The Bash matcher treats every `cat .issues/...`
shape as unrecognised and prompts the user — `Glob` for
`.issues/*/issues/*.md` and `Read` per file never do. The git plumbing
above is the *only* `Bash` you run; everything else is the dedicated
file tools.

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
   Bash(rg *), Bash(grep *), Bash(find *),
   Bash(test *), Bash(echo *)
   ```

   `Glob`/`Grep` are the search tools on npm-installed Claude Code;
   native macOS/Linux builds drop those tools and fold search into Bash,
   which is why `Bash(rg *)`, `Bash(grep *)`, and `Bash(find *)` are
   listed too. A worker uses whichever its tool set actually exposes —
   keep both kinds of entry so the loop runs on either build.

   And these `deny` entries, so remote git is hard-blocked regardless of
   doctrine (a `deny` rule overrides `allow`):

   ```
   Bash(git push:*), Bash(git fetch:*), Bash(git pull:*),
   Bash(git clone:*), Bash(git ls-remote:*), Bash(git remote:*)
   ```

   Widening the allowlist is the user's call — if entries are missing,
   surface them and stop; do not edit the file yourself.
3. **The worktree carries `.env.ralph`.** A fresh worktree has no `.env`
   (gitignored), but it does carry the committed, secret-free `.env.ralph`
   — materialise `.env` with `cp .env.ralph .env`. The gate's
   `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` all pass
   env-free; only `pnpm test:db` needs `DATABASE_URL`, which `.env.ralph`
   supplies (the dev Postgres). `.env.ralph` holds no API keys, so AI
   search stays off under the loop — which is fine.

## Watching the run

Foreground worker sub-agents render their steps in the Claude Code GUI — each
wave's workers show up as disclosures in the session sidebar, so the human
running the orchestrator can watch progress there directly. You, the
orchestrator agent, do not see those steps; a foreground `Agent` call returns
only the worker's final terse outcome.

For a terminal view — or in a headless run with no GUI — `.ralph/watch-steps.py`
turns the workers' transcripts into a compact step log, one line per tool call
(`Read x`, `Edit y`, `Bash pnpm test`), never the tool output. Run `python3
.ralph/watch-steps.py` (no args) in a separate terminal for a live tail. It is
a plain process, not an agent: nothing it reads or prints enters any agent's
context.

## Configuration

- `MAX_PARALLEL` — workers per wave. Default **5**. Set **1** to disable
  parallelism entirely (the loop collapses to serial with no code-path
  change — this is the off-switch).
- `WORKER_TIMEOUT` — per-worker budget. Default **25 min** (from `loop.py`).
  Advisory only: you have no kill hook (step 4), so it is enforced
  worker-side — the dispatch template passes it to each worker as a
  self-limit.
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
- **Fill the wave**: take up to `MAX_PARALLEL` issues from the eligible
  set. When more than `MAX_PARALLEL` are eligible, **prefer a spread
  across distinct features** (`.issues/<feature>/` directories): different
  features draw from independent dependency chains, so they rarely touch
  the same files. Do not estimate file sets — a wrong pick is caught and
  corrected reactively by the merge (step 5) and gate (step 7) at the cost
  of one re-run.
- If no issue is eligible but `ready-for-agent` issues remain (all
  blocked), halt and surface it.
- Record the integration tip (`git rev-parse HEAD`) — the pre-wave tip,
  needed for revert in step 7.

### 3 — Dispatch the wave (foreground, one message)

Dispatch the wave's workers as `Agent` calls — **all of them in a single
message**, one tool call per issue. Foreground `Agent` calls issued
together in one message run concurrently, so the wave is still parallel.

- **Do not set `run_in_background`.** `isolation: "worktree"` is honored
  only on foreground dispatch. With `run_in_background: true` the harness
  silently drops isolation: the worker runs in *your* integration worktree
  on the integration branch, its commit lands directly on that branch, and
  parallel workers collide on the one branch. Foreground is mandatory — it
  is what makes `isolation` real. (Verified: a background worker reports
  your own worktree path and branch; a foreground one gets its own.)
- `isolation: "worktree"` — each worker runs in its own isolated git
  worktree and returns its branch name. **That worktree is branched off
  `main`, not off the integration tip** — `main` is stale and may predate
  the issues themselves. The worker's dispatch prompt must therefore carry
  a setup preamble that resets the worktree onto the integration tip;
  inline the tip SHA recorded in step 2 into every worker's prompt (see the
  worker dispatch template).
- Prompt: the **worker dispatch template** below, with the issue's full
  text inlined (including any `## Comments` failure notes from prior
  attempts).

Foreground dispatch **suspends you until every worker in the message has
returned** — you cannot act mid-wave. That is the accepted trade for
working isolation; see step 4.

### 4 — While the wave runs

A foreground wave suspends you until the whole dispatch message returns —
you cannot wake, monitor, or kill a worker mid-wave. (The human can still
watch progress: workers render their steps in the GUI sidebar, and
`.ralph/watch-steps.py` gives the same view in a terminal — see "Watching
the run". You, the orchestrator, see only each worker's final outcome.)

One consequence: **`WORKER_TIMEOUT` is advisory — you do not enforce it.**
You have no `TaskStop` kill hook. Enforcement is worker-side: the dispatch
template tells each worker its budget and to write a failure note and stop
rather than run indefinitely. A genuinely hung worker (one that does not
self-police) stalls only its own wave, until the agent runtime ends it; on
return, treat it as a failure (step 6). It cannot corrupt the integration
branch — its work is isolated in its own worktree.

### 5 — Collect and merge

When the wave's dispatch message returns, all workers have resolved
together. Then, for each worker:

- Read its result — but **do not trust the self-report**. Verify the
  durable artifacts: the issue's `Status:` line actually flipped to
  `done`, and a commit actually landed on the worker's branch. A worker
  that reports success but left `Status: ready-for-agent` is a **failure**
  (step 6), not a success.
- If verified, **merge it yourself**: run `git merge --no-ff
  <worker-branch>` into the integration branch (see the merge procedure
  below).
  - Clean merge → the branch is integrated. **Reap the worker's
    worktree** so it does not leak: `git worktree unlock <path>` then
    `git worktree remove --force <path>`. The worker has already
    returned, so its worktree is done. Unlock first — the harness locked
    it to this run's pid, so a bare `remove` skips it; an un-reaped
    worktree is left locked to a dead pid once the run ends, and they
    pile up. Removal drops only the directory; the worker's branch ref
    survives.
  - Conflict → `git merge --abort` at once and boot the issue back to
    `ready-for-agent`. Do not resolve the conflict. Its re-run next round
    branches off the updated tip — which now includes the merge winner —
    so it redoes its work *on top of* the winner: sequential, conflict-free
    by construction.

### 6 — Smart retries

A worker outcome is one of:

- **Success** (verified in step 5) → done with this issue.
- **Failure** (gate red, crash, out-of-time, or unverified self-report) →
  a terse failure note belongs in the issue file under a `## Comments`
  heading, and `Status` stays `ready-for-agent`. A graceful worker writes
  that note itself; on a hard crash or a worker that ran out of time *you*
  write a one-line note ("attempt N: timed out"). Next round a **fresh**
  worker picks the issue up and reads it *including* the prior failure
  notes — a clean-context retry that can still see what the last attempt
  hit.
- **`needs-info`** (the worker explicitly judged the issue wrong or
  blocked) → **not retried**. That is the worker's considered judgment;
  re-running just re-derives the same blocker. Escalate it (step 8).

**Retry budget**: an issue carrying `RETRY_BUDGET + 1` failure notes is
exhausted — flip its `Status` to `needs-info`, escalate it (step 8), and
count it once toward `MAX_CONSECUTIVE_FAILS`.

### 7 — Wave barrier and gate verify

Once the wave's dispatch message has returned (all workers resolved)
**and** all merges have run, run the project gate yourself on the
integration branch (see the gate procedure below).

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

Then, green or red, print a one-line **wave summary**: wave number, wall
time (dispatch → gate done), issues attempted / done / failed, conflicts
booted, and the gate outcome (green, or red → revert-and-serialize). These
per-wave numbers are the run's only telemetry — they are what tells you
whether `MAX_PARALLEL` is set well and whether the dropped disjoint-batch
filter is costing enough wasted runs to be worth re-adding.

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

## Dispatch template and integration procedures

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
> First, set up your worktree — it was branched off `main`, which is stale
> and may predate this issue:
>
> 1. `git reset --hard <integration-tip>` — move your worktree onto the
>    integration tip (`<integration-tip>` is the SHA inlined here by the
>    orchestrator). It is reachable through the shared object store, so
>    this needs no network. Your worktree has no work yet, so the reset is
>    safe.
> 2. `cp .env.ralph .env` — materialise the gitignored `.env` from the
>    committed, secret-free defaults.
>
> Then read, this loop: `.ralph/PROMPT.md` (your full doctrine),
> `CLAUDE.md`, `CONTEXT.md`, and any `docs/adr/` that touch this issue.
> Then follow `PROMPT.md` exactly:
>
> - Implement the issue literally; satisfy every acceptance criterion; use
>   `CONTEXT.md` glossary terms; keep scope lean.
> - Verify before committing — run every check the project defines
>   (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:db`, and for
>   UI/route/env work `pnpm build`). All must be green.
> - Budget: aim to finish within `<WORKER_TIMEOUT>`. If you cannot — a
>   check stays red, or you are stuck — do **not** run indefinitely: take
>   the failure path below (write the `## Comments` note, leave `Status:`
>   as `ready-for-agent`) and stop.
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

### Merge procedure — the orchestrator runs this directly

In the integration worktree, on the integration branch:

- `git merge --no-ff <worker-branch>` — merge the verified worker branch.
- Clean → the branch is integrated; continue.
- Conflict → `git merge --abort` immediately. Do **not** resolve it; do not
  edit any file. Boot the issue back to `ready-for-agent` (step 5).

A clean `--no-ff` merge produces only a one-line commit summary — bounded
output, safe for the orchestrator's context.

### Gate procedure — the orchestrator runs this directly

In the integration worktree, on the integration branch, after all of the
wave's merges have run. Ensure `.env` exists first — `cp .env.ralph .env`
if it does not. Then run, as separate bare commands: `pnpm typecheck`,
`pnpm lint`, `pnpm test`, `pnpm test:db`, `pnpm build`.

Read only pass/fail and (on red) the first failure. Do not fix anything; do
not commit. Green → next round; red → revert-and-serialize (step 7).

## Protected files — never modify

- `.ralph/` and its contents — `ORCHESTRATOR.md`, `PROMPT.md`, `loop.py`,
  `loop_state.json`, `watch-steps.py`.

Issue files under `.issues/` *are* expected to change — ticking checkboxes
and advancing `Status:` lines is the loop.
