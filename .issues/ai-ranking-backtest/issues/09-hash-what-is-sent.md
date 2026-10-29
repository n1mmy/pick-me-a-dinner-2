# 09 — The Prepared note's input hash covers what is sent

Status: done
Type: AFK

## Parent

[Spec: Backtest the AI ranking, then decide](../PRD.md) ·
[Plan: simplifications](../../../plans/old/simplifications-2026-10-29.md), step 4 ·
review item 4 in `plans/old/code-review-2026-10-28.md`

## Why

`inputHash` (`lib/prepared-notes.ts:49`) hashes the prompt version, the
model and the full snapshot. What is sent is the system prompt — built partly
from blocks shared with `lib/ai-search.ts` — and the lean user message. An
edit to a shared block, or to `leanSnapshot`, leaves every stored note
"current" unless someone remembers to bump the Prepared version too; the
comment at `lib/ai-search.ts:721` relies on the two versions moving together
by hand.

## What to do

Hash `[model, buildPreparedSystemPrompt(), buildPreparedUserMessage(built)]`.
`PREPARED_PROMPT_VERSION` stays as the label in eval file names and `meta`
and leaves the hash; the moving-together comment goes. `preparedNoteFor`
passes the built value it already has. Every stored note regenerates once
after deploy; accepted.

## Acceptance

- [x] A test shows a change to a shared prompt block, with no version bump,
      makes a stored note read `out-of-date`.
- [x] `pnpm test:db` run if Postgres is up; say so if it was not.
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test` pass.

## Comments

- Done. `inputHash(built, model)` hashes `[model, buildPreparedSystemPrompt(), buildPreparedUserMessage(built)]`. The DB tests replace the prompt-version override with a getter over `RATIONALE_RULES` (shared with AI search): with no version bump, the sweep regenerates every date and `preparedNoteFor` reads `out-of-date`. `pnpm test:db` ran against the local `pmad-pg` (`.env` copied from `.env.ralph`): 9 files, 132 tests pass. Every stored note regenerates once after deploy, as accepted.
