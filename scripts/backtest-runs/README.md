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
