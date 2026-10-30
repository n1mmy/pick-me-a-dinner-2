# Remove the rank-only ranker, keep the spread tooling

Planned 2026-10-30 on `grill-ai-precomputed-dinner-notes`, after the
rank-only sweep on the local model. The rank-only work
(`plans/old/rank-only-rankings.md`, `.issues/rank-only-rankings/`) asked whether
a ranking without the text could be repeated cheaply enough to measure
run-to-run noise. On the local model it can't, so the ranker goes. The tools
that measured the noise stay: they still work on with-text runs. Tonight,
the production Prepared note and its input hash are unchanged.

## What the runs showed

Qwen 3.8 dense, prompt v21, the 20 standard days, read with
`scripts/backtest-spread.ts`. Hits are per run, on the days all of an
arm's runs have:

| Arm | Runs | Per day | Same #1 (pairs, /20) | Top-5 shared | Tau | hit@3/5/10 | Mean rank |
|---|---|---|---|---|---|---|---|
| With text, low | 5 | ~230s, ~9.5k tok | 7.0 | 3.01 | 0.57 | 7.8 / 10.0 / 16.0 | 6.2 |
| Rank-only, low | 5 | ~220s, ~9.1k tok | 7.9 | 3.07 | 0.54 | 8.4 / 10.6 / 14.2 | 6.6 |
| Rank-only, thinking off | 5 | ~40s, ~1.5k tok | 3.3 | 2.00 | 0.40 | 6.0 / 8.0 / 13.0 | 8.0 |
| Rank-only, off, t=0 | 2 | ~50s, ~1.8k tok | 19.0 | 4.90 | 0.98 | 5.5 / 8.0 / 10.0 | 9.0 |

- **Rank-only saves nothing on the local model.** Reasoning is the cost, so
  a ranking alone takes as long and as many tokens as a full note.
- **It is no steadier and no better.** Agreement and hits sit within the
  run-to-run range of the with-text prompt. A production two-call Prepared
  note (rank first, then text) has no saving to build on either.
- **Thinking off is fast and worse** on rank-only: less agreement and lower
  hits. With-text with thinking off is unmeasured.
- **Temperature 0 is steady and worst.** The spread is not just sampling
  noise: with thinking, the model reaches different and better answers.
- **The noise floor, now measured:** single with-text runs span hit@3 7–9,
  hit@10 15–17 and mean rank 5.5–6.6. A prompt change has to move more than
  about 2 hits, or 1 place of mean rank, to show on one run.
- **Averaging** the with-text runs (read while the fifth was still at 13
  days) reached hit@10 18 against 15–17 for one run: a small gain at several
  times the cost, and not a production option.
- **Opus** rank-only is cheap (2–3s, 91 tokens) but was only probed on
  2026-10-22. That is not enough to keep the ranker for.

## Remove

Everything that exists only because there is a second prompt, plus the two
measuring options whose questions are answered.

- **The rank-only ranker** (`lib/prepared-note.ts`): `RANK_OUTPUT_FORMAT`,
  `buildRankSystemPrompt`, `buildRankUserMessage`, `parseRankReply`, and the
  client's `output` option and its `parse` wrapper. The ranking paragraph's
  lead/body split folds back into one block, and `candidateChecklist`'s
  `briefFollows` flag goes (the brief line is always there). The pinned
  snapshots show the production text unchanged. The rank tests in
  `lib/prepared-note.test.ts` go with them, and the rank-only mention in the
  `PREPARED_PROMPT_VERSION` comment.
- **`--output`:** in `prepared-note-eval.ts` (the flag, `readReply`,
  `recordedBrief`, `ranker: "rank only"`) and in `scripts/backtest.ts`
  (`rankOnly` on `scoreDay` and `printDay`, `output` in `EvalFlags`, the
  `rank|prepared` prefix in `defaultRunPath`, `output` in `SETUP_FIELDS`).
  The spread script's `Arm` loses `output`.
- **`--temperature`:** its question is answered, and production never sends
  one. Goes from the client, the eval, `defaultRunPath`, the run `meta`, and
  the spread script's arms.
- **`--averaged` and `averageDay`:** averaging was for scoring cheap
  rank-only repeats as a production strategy. Averaging with-text runs is
  not one.
- **The local `rank-v20-*` and `rank-v21-*` run files, and
  `prepared-v21-qwen3.8-low-t0.6-r1`**, once the README line below records
  them: moved to `scripts/backtest-runs/removed-setups/`. They are
  git-ignored, and without `output` and `temperature` in the arm the spread
  script would group them with with-text runs.

## Keep

The question that started this still stands: two runs of one prompt differ
by as much as a prompt change. These are the tools for measuring that, and
none of them depends on a second prompt.

- **The pinned prompt snapshots** (`lib/__snapshots__/prepared-*.txt`). A
  stored note's input hash covers the prompt, so they guard every note.
- **The named prompt blocks**, less the ranking split above. Pinned by the
  snapshots, and no harder to read than one string.
- **`--repeat=N`** and **the resume guard** (`resumeConflict`), which caught
  v19 days stamped as v20.
- **`--thinking=off`**, on both paths: a future local or Claude model may
  run well without thinking, and with-text thinking off is unmeasured. Opus
  5.5 refuses `thinking: disabled` today; the eval's header says so.
- **The spread report:** #1 agreement, top-k overlap, Kendall tau, the
  Pick's rank range, and hits with their range across runs. It is how a
  prompt change is told apart from noise.
- **Everything on the branch unrelated to rank-only:** the capped mean rank,
  the Shortlist and multi-Pick reading, No Shared Dinner last, the backfill
  script, the ADR-0011 amendment.

## Fix while here

The spread script's per-arm hits average runs with different day counts, so
a short run drags the arm down (with its fifth run stopped at 13 days, the
with-text arm reported hit@3 7.2 where its four full runs gave 8.0). Score
each run on the days all of the arm's runs share, and print that day count.

## Steps

1. Record the table and findings above as a line in the run list of
   `scripts/backtest-runs/README.md`, so the finding outlives the files.
2. Remove the code and tests listed, and fix the spread script's day count,
   in one commit. Run the gate.
3. Move `plans/rank-only-rankings.md` to `plans/old/`, set the PRD's status
   to done with a pointer here, and close ticket 05 with this finding
   instead of a sweep proposal.

## Verification

- The gate passes: `npx tsc --noEmit`, `npx next lint`, `npx vitest run`.
- The pinned Prepared prompt and message snapshots are unchanged.
- The spread script scores hits on the days every run shares and prints
  that count (unit-tested; `prepared-v21-qwen3.8-low-r5` has since finished
  all 20 days, so no saved arm is short any more).
