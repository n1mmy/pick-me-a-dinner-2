# Issue tracker: Local Markdown

Issues and PRDs for this repo live as markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The PRD is `.scratch/<feature-slug>/PRD.md`
- Implementation issues are `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`
- Triage state is recorded as a `Status:` line near the top of each issue file (see `triage-labels.md` for the role strings)
- A finished issue gets `Status: done` — a lifecycle state past triage, set by the implementing agent once the work is committed and its acceptance criteria are all ticked
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## Ralph loop

`.ralph/loop.py` is an autonomous orchestrator that drives Claude Code through the issues here, one per invocation. It picks the lowest-numbered issue with `Status: ready-for-agent`, implements it, and advances it to `Status: done`. The loop doctrine lives in `.ralph/PROMPT.md`. Run it from the repo root with `python3 .ralph/loop.py`.

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.
