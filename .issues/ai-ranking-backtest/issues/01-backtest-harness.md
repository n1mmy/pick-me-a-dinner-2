# 01 — Backtest harness for the AI ranking

Status: done
Type: AFK

## Parent

[Spec: Backtest the AI ranking, then decide](../PRD.md)

## What to build

A way to run both rankers against recent **decided** days as the Household saw
them, and score the output against what was actually eaten. No prompt changes
in this issue: the first run is the prompt-v9 baseline, and every later change
is measured against it.

### The snapshot as of a past day

`snapshotForDay` today sends the full Log, every Rejection and every Day note
with no date filter (`lib/snapshot.ts:394-416`, `db/queries.ts:276-286`), and
removes an Option eaten *on* the anchor day as "already Picked"
(`lib/snapshot.ts:354-356`). For a past day that leaks the answer and drops the
Pick from the candidates. Add a backtest mode to the snapshot builder (an
option on `snapshotForDay`, not a second builder) that, for anchor day D:

- keeps Log rows dated **before** D only — the Pick(s) on D are the ground
  truth and must stay candidates;
- keeps Rejections dated before D only — Rejections *on* D are ground truth
  for the scorer, never a suppression;
- keeps Day notes dated on or before D, D's own as `todayDayNote` (the
  Household had it when deciding);
- leaves the timing facts as they are (they already count `<= asOf`; with the
  Log cut they count `< D`, which is right).

Known and accepted: the Catalog is read as it is now (active flag, Tags,
Option notes, Closed days), so an Option archived or added since D is off.
Keep the window recent (about the last 60 days) and say so in the output.

### Day selection

Decided days in the window, sampled across weekdays — about 20 by default; a
`--days=` list for a fixed set so runs compare like with like. A day with more
than one Log entry (10-26 had Leftovers and Mollie Stone's) scores on the best
rank among them.

### Scores and flags

Per day and in aggregate, for a run of N days:

- rank of the actual Pick; hit@3, hit@5, hit@10;
- any Option Rejected on D with a too-soon/too-recent reason ranked in the top
  5 (a miss);
- brief consistency (Prepared note only): the Options named in the brief are
  in the top 3; when D has a Day note, the brief mentions it (flag for
  reading, not a verdict).

Flags to read, in the style of the existing `RHYTHM_CLAIM_SUSPECTS`
(`scripts/prepared-note-eval.ts:48`), extended and shared by both scripts:

- elapsed-time phrasing, widened to relative forms the current regex misses:
  "last week", "last night", "just had", "this past <weekday>",
  "after/eaten <weekday>";
- a weekday-habit claim in a top-10 rationale, printed next to that Option's
  `weekdays` counts so a reader can see whether the counts bear it out;
- a top-10 rationale whose every sentence is cadence vocabulary and nothing
  household-sourced (no Note, Tag, weekday, standing reason) — the
  "timing-only top row" the glossary now calls a tail row's.

### Running it

- Strata: `scripts/prepared-note-eval.ts` gains the backtest flags; keep
  `--reasoning` so traces are saved per day. Free, serial, ~9 min a note:
  ~3 hours for 20 days. Nothing is deployed, so there is no production sweep
  to compete with.
- Claude: `scripts/ai-search-eval.ts` gains the same flags over the same
  snapshot mode. **Billed**: one call per day, ~20k cache-write tokens each in
  `pithy` mode. State the call count and wait for approval before running.
- Output: a per-day table plus the aggregate, and `--json` so two runs
  (prompt versions, models) can be diffed. Save Strata's reasoning traces —
  they are where the v9 diagnosis came from.

## Acceptance criteria

- [x] `snapshotForDay` has a backtest mode with the cuts above, covered by
      tests in `lib/snapshot.test.ts` (Log before D only; D's Pick a candidate;
      D's Rejections absent from suppressions; Day notes `<= D`).
- [x] Both eval scripts run a day list in backtest mode and print the scores
      and flags above; `--json` output diffs cleanly between runs.
- [x] The v9 Strata baseline over the default day set has been run and its
      output saved (path noted under Comments), with a short read of what it
      shows.
- [x] Claude baseline run only after the user approved the call count; its
      output saved likewise.
- [x] The four hand-picked checks are removed from the scripts and docs.

## Comments

- 2026-10-28: v9 baseline run for all three rankers over the same 20 decided
  days, saved under `scripts/backtest-runs/` (`ai-search-opus-5-5-pithy`,
  `ai-search-sonnet-5-5-pithy`, `strata-v9` + reasoning traces; Strata ran
  in two parts, `--resume` after the 2-hour background limit). Short read:
  hit@3 Opus 13/20, Strata 11/20, Sonnet 7/20, the deterministic Score 5/20;
  hit@5 14 / 12 / 11 / 8; Pick's median rank 3 / 2 / 4 / 8. The
  misses are shared and structural — the Pick was under its Interval on 8 of
  20 days, Aji Ichi's stale Interval puts it in the top 5 on more than half
  the days unconsumed, and about half of every ranker's top-5 slots go to
  Options never eaten in the window. Strata wrote rank positions where Option
  numbers belong on 2 of 20 days (10-02, 10-14). Full read and the proposals
  in issue 02.
- 2026-10-28: the four hand-picked checks never lived in the scripts or docs —
  they were run by hand and survive only as history in commit 96f14c7 and
  ADR-0012's Consequences, which stay. Nothing to remove. All three runs read
  the dev DB (the Claude ones with the key from `.env.k8s`); their candidate
  counts match day for day. The cluster DB has two Options and a Log row
  added since the dev copy, so the live app's snapshots now differ from the
  backtest's — a rerun on the same `--days` list is comparable only against
  the same DB.
  Known checker limits: the brief name matcher reads "bb.q Chicken" as
  Chicken and Rice, and the Day-note check ignores words under four letters
  ("No Jen" read as silent).
