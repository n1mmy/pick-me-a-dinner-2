# 04 — The spread script and the averaged ranking

Status: ready-for-agent
Type: AFK

## Parent

[Spec: Rank-only rankings and run-to-run spread](../PRD.md) ·
[Plan](../../../plans/rank-only-rankings.md), step 4

## What to build

`npx tsx scripts/backtest-spread.ts <run.json>… [--averaged]` reads saved
run files offline and reports how far runs of the same setup differ. With
`--averaged` it writes one averaged ranking per arm as a run file of its
own.

**Arms:**

- Files are grouped by `meta`: `output` (absent reads as `note`),
  `model`, `thinking` (absent reads as `effort`), `temperature` (absent
  reads as `default`), and `promptVersion`.
- Options are matched by name.
- A day counts when two or more of an arm's files have it `ok`.

**What it reports for each arm:**

- **Per day:**
  - the share of run pairs agreeing on the #1;
  - mean top-3 and top-5 overlap;
  - mean Kendall tau-b over the Options both runs ranked;
  - the Pick's median and lowest-to-highest rank;
  - each averaged-top-10 Option's mean rank and range.
- **Per arm:**
  - hit@3/5/10 and the capped mean rank (`summarize` from
    `scripts/backtest.ts`), each as a mean with its range across runs;
  - the per-day measures averaged;
  - the number of runs and days.

**`--averaged`**, for each arm with two or more runs:

- writes `<arm>-averaged-n<N>.json`;
- each day orders Options by mean rank, with a missing Option counted at
  the candidate count;
- a tie goes to the Option ranked above the other in more runs, then to
  name order (run files carry no Score);
- Picks, candidate flags, `pickTiming` and `candidates` are copied from
  the source records, and ranks, hits and `bestRank` recomputed;
- `tooSoonMisses` is empty;
- `meta` holds the arm's fields plus `averagedFrom` and the source paths;
- `backtest-compare.ts` reads the file like any run.

The Kendall, overlap, grouping and averaging functions are exported and
tested in `scripts/backtest-spread.test.ts` on small in-memory records.

## Acceptance criteria

- [ ] Kendall tau-b tested on identical, reversed and partly overlapping
      rankings.
- [ ] Top-k overlap and #1 agreement tested.
- [ ] Arm grouping tested with an old file and a new one.
- [ ] Averaged order tested: mean rank, the missing-Option rank, both
      tie-breaks, and its hits from the Picks.
- [ ] On the saved `prepared-v14-opus-5-5-low` and `-run2` it reports
      the same #1 on 16/20 days and a top-5 overlap of 3.95, matching
      the plan.
- [ ] `backtest-compare.ts` opens an averaged file without error.
- [ ] The gate passes.

## Blocked by

None. It reads existing run files, so it can start immediately. Ticket
03's `meta` fields only add to the grouping.
