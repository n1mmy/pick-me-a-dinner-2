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
- `strata-v10` and `strata-v12` — Prepared note prompt v10 and v12 on Strata,
  with traces, over the first ten days only (`2026-10-02` … `2026-10-14`):
  7/8/8 and 5/6/10. Each stopped after its first half because the prompt
  moved on before the `--resume` half could run.
- `prepared-v13-opus-5-5-low` — the Prepared note prompt v13 sent to Opus 5.5
  instead of Strata (`--claude`, effort low): 10/11/17 against v13 AI
  search Opus's 10/12/16, ~22s and ~2k output tokens a day. Its
  `-reasoning/` files are thinking summaries, on the 11 days it thought. On
  `2026-10-09` and `2026-10-16` it wrote rank positions in the number
  column; every row was resolved by name.

Fireworks models, through its Anthropic-compatible endpoint, on the same 20
days: `ANTHROPIC_BASE_URL=https://api.fireworks.ai/inference`, a Fireworks key
as `ANTHROPIC_API_KEY`, the model as `AI_MODEL`, and a long `AI_TIMEOUT_MS`.
Thinking there is on or off and nothing between: `output_config.effort`,
`budget_tokens` and `reasoning_effort` are accepted but did not shorten
DeepSeek's or GLM's thinking. Hits are hit@3/5/10 out of 20.

- `ai-search-v11-deepseek-v4p1-flash-pithy` — prompt v11, DeepSeek V4.1
  Flash, thinking off: 7/9/14 against v11 Opus's 10/13/17. Taqueria Mi
  Durango in its top 5 on all 20 days, eaten on one.
- `ai-search-v11-deepseek-v4p1-flash-low-pithy` — the same with thinking on,
  stopped after 2 days: ~17k tokens and ~2 minutes a day.
- `ai-search-v12-kimi-k3-off-pithy` — prompt v12, Kimi K3, thinking off:
  11/11/16 against v12 Opus's 13/13/17. On `2026-10-25` it spent the whole
  10k `max_tokens` and wrote no ranking.
- `ai-search-v12-kimi-k3-low-pithy` — Kimi K3, thinking on (`AI_EFFORT=low`,
  32k `max_tokens`): 13/15/18, 32s a day (70s at most) against Opus's 13s.
- `ai-search-v12-glm-5p3-low-pithy` — GLM 5.3, thinking-only (Fireworks
  rejects `disabled`): 9/10/16, 19s a day. Left the Pick out of its ranking
  on `2026-10-09`.
- `.part1.log` / `.part2.log` — a run made in two halves, the second with
  `--resume`.
