# Issue tracker: Local Markdown

Issues and PRDs for this repo live as markdown files in `.issues/`.

## Conventions

- One feature per directory: `.issues/<feature-slug>/`
- The PRD is `.issues/<feature-slug>/PRD.md`
- Implementation issues are `.issues/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`
- Triage state is recorded as a `Status:` line near the top of each issue file (see `triage-labels.md` for the role strings)
- A finished issue gets `Status: done` — a lifecycle state past triage, set by the implementing agent once the work is committed and its acceptance criteria are all ticked
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## Ralph loop

How the Ralph orchestrator (`orchestrate-ralph` skill) does each of its
operations against this tracker. Loop config (gate, env bootstrap, parallelism)
lives in `docs/agents/ralph.md`.

- **Discover** — issues are files at `<feature-dir>/issues/<NN>-<slug>.md`. A
  candidate is any file whose `Status:` line reads `ready-for-agent`. Find them
  with the `Glob` / `Grep` tools, or — if your harness lacks them — `rg` /
  `find` as single bare `Bash` commands. Not a `cat`/`find` loop.
- **Read** — the issue is the whole file, including any notes under a
  `## Comments` heading from prior attempts.
- **Dependencies** — issues here carry **no** machine-readable `Blocked by:`
  line; any ordering is prose only. So this tracker is **not** `parallel-safe`
  (`parallel-safe: false` in `docs/agents/ralph.md`) — the loop runs serially.
- **Feature grouping** — the parent directory `<feature-dir>` is the feature.
- **Transition** — `Edit` the `Status:` line in place: `ready-for-agent` →
  `done` on success, → `needs-info` when the issue is wrong or infeasible.
- **Comment** — append a one-to-three-line note under a `## Comments` heading at
  the end of the file. Cluster every transition `Edit` and every comment for a
  round into **one `git commit`** on the integration branch.

## When a skill says "publish to the issue tracker"

Create a new file under `.issues/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.
