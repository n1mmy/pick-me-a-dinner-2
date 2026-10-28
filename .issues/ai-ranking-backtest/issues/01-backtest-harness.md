# 01 — Backtest harness for the AI ranking

Status: ready-for-agent
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

- [ ] `snapshotForDay` has a backtest mode with the cuts above, covered by
      tests in `lib/snapshot.test.ts` (Log before D only; D's Pick a candidate;
      D's Rejections absent from suppressions; Day notes `<= D`).
- [ ] Both eval scripts run a day list in backtest mode and print the scores
      and flags above; `--json` output diffs cleanly between runs.
- [ ] The v9 Strata baseline over the default day set has been run and its
      output saved (path noted under Comments), with a short read of what it
      shows.
- [ ] Claude baseline run only after the user approved the call count; its
      output saved likewise.
- [ ] The four hand-picked checks are removed from the scripts and docs.
