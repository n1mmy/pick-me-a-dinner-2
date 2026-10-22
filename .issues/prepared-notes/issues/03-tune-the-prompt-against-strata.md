# 03 — Tune the prompt against Strata

Status: ready-for-human
Type: HITL

## Parent

[Spec: Prepared notes](../PRD.md)

## What to build

A free eval script, and a prompt that reads well on the real snapshot. HITL
because it needs Strata, the dev database, and a judgment of whether the brief
reads well — a Ralph worker has none of the three.

- **`scripts/prepared-note-eval.ts`**, modelled on `scripts/ai-search-eval.ts`:
  for a `--day`, against the dev DB, print the built prompt, Strata's raw reply,
  and the parsed brief and ranking.
- **Tune** `buildPreparedSystemPrompt()` and `max_tokens` until the brief reads
  well (150–300 words, the evening's context, two or three standouts, what to
  watch out for), the ranking covers every candidate, and rationales follow the
  rhythm-claim rule. Bump `PREPARED_PROMPT_VERSION` on any prompt change.
- **Check the loop end to end.** Run the dev server with the loop temporarily
  forced on: rows land in `prepared_notes`, and a second tick skips unchanged
  days. Don't commit the forcing.

Calling Strata is **free** — the billed-call rule doesn't apply. Its endpoint
and key are in `~/.omp/agent/models.yml` (provider `strata`); put them in
`.env.local`, never in a commit. `scripts/ai-search-eval.ts` is still billed
and still needs approval.

## Acceptance criteria

- [ ] The script runs for today and today+3 and prints prompt, raw reply, and
      parsed note
- [ ] Every candidate is ranked in both runs; the brief is in the word range
- [ ] Output quality and latency for both runs recorded in the commit message
- [ ] Rows land on a forced-on dev tick; a second tick skips unchanged days
- [ ] `corepack pnpm typecheck`, `lint`, `test`, `build` all green

## Blocked by

- Issues 01 and 02

## Comments
