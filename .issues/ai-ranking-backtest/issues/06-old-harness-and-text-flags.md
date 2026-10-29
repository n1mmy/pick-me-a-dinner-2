# 06 — Delete the old harness and the backtest's text flags

Status: done
Type: AFK

## Parent

[Spec: Backtest the AI ranking, then decide](../PRD.md) ·
[Plan: simplifications](../../../plans/old/simplifications-2026-10-29.md), step 1

## Why

`scripts/model-comparison/` is the September harness the backtest replaced;
the user does not care about the models it compared. `scripts/backtest-baseline.ts`
is scratch with a hard-coded day list, superseded by `backtest-score.ts`.
The backtest's regex flags (elapsed-time suspects, weekday claims, timing-only
rows, brief naming) have been patched twice for misfires — "Chicken" in "bb.q
Chicken San Bruno" matched Chicken and Rice; "October" as a best-by date read
as elapsed time; "No Jen" needed a three-letter rule — and issue 03 already
demoted them: a prompt change is judged by reading days, the numbers are
context.

## What to do

See the plan, step 1, for the line anchors. In short:

- `git rm -r scripts/model-comparison`; `git rm scripts/backtest-baseline.ts`.
- `scripts/ai-search-eval.ts`: remove `--compare`, `--cells`, `--reps`,
  `--serial`, `COMPARE_CELLS`, the Fireworks cells and the compare JSON
  writer. Keep the plain run, `--day`, `--snapshot`, `--backtest`.
- `scripts/backtest.ts`: remove the flag regexes and helpers, the `flags`,
  `briefNamed` and `briefMentionsDayNote` record fields, and their aggregate
  counts and printing. `brief` stays on the record.
- `scripts/backtest-compare.ts`: remove the flag markers and columns; old
  JSON files must still load.
- `scripts/backtest.test.ts` follows.
- `lib/ai-search.ts:791`: `splitUserTurn`'s export is for
  `ai-search-eval --snapshot` now, not `show-prompt.mjs`.

## Acceptance

- [x] The directory and the scratch script are gone.
- [x] `npx tsx scripts/backtest-compare.ts scripts/backtest-runs/ai-search-v12-opus-5-5-pithy.json scripts/backtest-runs/ai-search-v13-opus-5-5-pithy.json`
      still runs on the recorded (pre-step) files.
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test` pass.

## Comments

- Done. `splitUserTurn` had no caller outside `lib/` (the eval's `--snapshot` printed `leanSnapshot`), so `--snapshot` now prints the two blocks through `splitUserTurn` — the export's named caller. `prepared-note-eval.ts`'s single-day "rhythm-claim suspects" line used the deleted regex and went too. `briefSkippedDays` stays: it is not a text flag.
