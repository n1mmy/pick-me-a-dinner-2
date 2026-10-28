# Backtest runs

Saved output of the AI ranking backtest (`scripts/backtest.ts`, issue
`.issues/ai-ranking-backtest/issues/01-backtest-harness.md`). Each run is:

- `<ranker>.json` — the `--json` file: `meta` (model, prompt version, window,
  day list), `aggregate`, and one record per day (rank of the Pick, hits,
  too-soon misses, brief checks, flags, full ranking). Diff two runs' files to
  compare prompt versions or models; rerun on the same days with
  `--days=<meta.days>`.
- `<ranker>.log` — the printed report: each day's top 10 with its flags, the
  per-day table, and the aggregate.
- `<ranker>-reasoning/<day>.txt` — Strata's reasoning trace per day
  (`--reasoning`).

Compare two runs on the same days with
`npx tsx scripts/backtest-compare.ts <a.json> <b.json>`: aggregates side by
side, the Pick's rank per day, top-N overlap, hit flips, top-5 occupancy per
Option, never-eaten slots, and the Pick's row in each run.

Runs so far, all on the same 20 days (`2026-10-02` … `2026-10-26`, dev DB):

- `ai-search-opus-5-5-pithy` and `-run2` — prompt v9, Opus 5.5, pithy. Two
  identical runs: the noise floor is 1 day at hit@3 and 2 at hit@5.
- `ai-search-sonnet-5-5-pithy` — prompt v9, Sonnet 5.5.
- `strata-v9` — Prepared note prompt v9, with traces.
- `ai-search-v10-opus-5-5-pithy` and `-run2` — prompt v10, Opus 5.5, pithy.
  Two identical runs: they differ by 3 days at hit@3 and 1 at hit@5.
- Prompt v10 runs are named `ai-search-v10-…` and `strata-v10` by default.
