---
name: orchestrate-ralph
description: Run the Ralph loop as an interactive orchestrator that dispatches worker sub-agents — the in-session alternative to the headless `.ralph/loop.py`. Use when asked to "orchestrate ralph", run the Ralph loop interactively, or drive the `.issues/` tracker with sub-agents.
---

# Orchestrate Ralph

Read `.ralph/ORCHESTRATOR.md` in full and become the orchestrator it
describes — then run that loop until a stop condition fires.

Before starting, confirm the setup prerequisites from `ORCHESTRATOR.md`:

1. You are in a fresh git worktree (its branch is the integration branch).
2. `.claude/settings.local.json` carries the curated worker allowlist.
3. `.env` exists in the worktree.

If any prerequisite is missing, surface it and stop — do not start the
loop.

`ORCHESTRATOR.md` is the single source of truth for the loop's behaviour
(wave selection, background dispatch, watchdog, smart retries, merge and
gate-verify sub-agents, escalation, stop conditions). This skill only
points at it; do not paraphrase or second-guess it here.
