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

The run files are git-ignored: they stay on the machine that made them, and
the run list below records what each one showed.

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
- `strata-v13` — Prepared note prompt v13 on Strata, with traces, over 18 of
  the 20 days (stopped during `2026-10-25` when v14 landed; `2026-10-25` and
  `2026-10-26` missing): 10/10/16, mean rank 5.8, 44/90 never-eaten top-5
  slots. 138 of its 180 top-10 rows were resolved by name — the rank written
  as the number — which is the shape v14's letter codes refuse.
- `strata-v14` — Prepared note prompt v14 on Strata, with traces, over the
  first 11 days (`2026-10-02` … `2026-10-15`; stopped when v15 landed):
  5/6/9, mean / median rank 5.8 / 5, 32/55 never-eaten top-5 slots,
  too-soon days 2 (`2026-10-11`, `2026-10-15`). Every reply used the letter
  codes; none was refused.
- `strata-v15` — Prepared note prompt v15 on Strata, with traces, over the
  first ten days (`2026-10-02` … `2026-10-14`) in two `--resume` parts:
  6/6/6, mean / median rank 6.9 / 2, 30/50 never-eaten top-5 slots. It
  skipped the brief on `2026-10-08`, `2026-10-09` and `2026-10-10`; the rows
  scored anyway. Strata cuts the model's thinking at 75% of `max_tokens`
  (15k of the 20k budget) with "I have thought about this long enough",
  every day of this run hit that cap, and on those three days it landed
  before the brief was planned.
- `strata-v15-xhigh-40k`, `-medium-40k` and `-low-40k` — the same on Strata
  at each `LOCAL_AI_REASONING_EFFORT`, with `LOCAL_AI_MAX_TOKENS=40000` (a 30k
  thinking cap), run a day at a time across the three: the three days that
  lost the brief, then `2026-10-02`, and stopped there. 0/2/4, 1/1/4 and
  2/3/3, mean rank 7.0, 6.8 and 5.5, against `strata-v15`'s 2/2/2 and 7.0
  on the same four days. No run hit the cap or skipped the brief. xhigh,
  the model's default, wrote 24–30k tokens and took ~15 minutes a day;
  medium 7–15k and ~6 minutes; low 8–16k and ~7 minutes.
- `prepared-v13-opus-5-5-low` — the Prepared note prompt v13 sent to Opus 5.5
  instead of Strata (`--claude`, effort low): 10/11/17 against v13 AI
  search Opus's 10/12/16, ~22s and ~2k output tokens a day. Its
  `-reasoning/` files are thinking summaries, on the 11 days it thought. On
  `2026-10-09` and `2026-10-16` it wrote rank positions in the number
  column; every row was resolved by name.
- `prepared-v14-opus-5-5-low` and `-run2` — the same on prompt v14 (letter
  codes), two identical runs: 9/11/16 and 12/13/14, mean / median rank
  6.7 / 4 and 6.5 / 3, too-soon days 3 and 2. They differ by 3 days at hit@3,
  2 at hit@5 and 2 at hit@10, wider than earlier pairs, and the Pick's rank
  swings by 15 or more on single days (`2026-10-18` #18 / #3, `2026-10-19`
  #19 / #2, `2026-10-21` #6 / #21); the #1 is the same on 16 of 20 days.
  Every reply used the letter codes; none was refused. ~21s and ~1.7k output
  tokens a day, thinking on 8 days in each.
- `prepared-v15-opus-5-5-low` and `-run2` — the same on prompt v15 (weekday
  counts out of the snapshot), two identical runs: 11/13/17 and 10/13/14,
  mean / median rank 5.0 / 3 and 9.0 / 3, too-soon days 3 and 1. The mean
  moves on the tail: `2026-10-12` #5 / #20, `2026-10-15` #6 / #22,
  `2026-10-21` #13 / #33. Averaged per pair, v15 (10.5/13/15.5) is level
  with v14 (10.5/12/15). The #1 is the same on 16 of 20 days. ~20s and
  ~1.7k output tokens a day, thinking on 12 and 9 days.
- `ai-search-v16-opus-5-5-pithy` and `ai-search-v17-opus-5-5-pithy` —
  prompts v16 and v17 (the rationale rules as one statement; v17 with the
  elapsed-time and name rules back as a clause each), Opus 5.5, pithy:
  10/13/15 and 10/12/18, mean rank 7.8 and 6.0, against v15's 12/12/17 and
  6.0. The read is on `.issues/ai-ranking-backtest/issues/13`: v16 restated
  the days-since number in 91 of 200 top-10 rows, v17 in 6; v17 ships.
- `prepared-v17-opus-5-5-low` — the Prepared note prompt v17 on Opus 5.5
  (`--claude`, effort low), in two parts (`--resume` for the last two days):
  11/11/16, mean / median rank 6.5 / 2, too-soon days 1 — level with v15.
  Elapsed-time rows 3 of 200 and weekday leads down against both v15 runs;
  rows opening with the name 132 and rows using the snapshot's words (pace,
  rhythm, spacing) 48, both up, the second from the folded-away vocabulary
  bullet. ~22s and ~1.9k output tokens a day, thinking on 16 days.
- `qwen3.8-v13` — Prepared note prompt v13 on Qwen 3.8 dense (27B, Q4_K_M,
  llama.cpp; `.env.backtest.qwen`), with traces, over the first eight days
  (`2026-10-02` … `2026-10-12`): 5/6/7, mean rank 4.8, against Strata v13's
  4/4/6 and 7.3 on the same days. 8–11 minutes a day at ~49 tok/s. It drafts
  the whole ranking in its reasoning, ~20k tokens, so it needs
  `LOCAL_AI_MAX_TOKENS=40000`: at Strata's 20k both days tried were cut off
  before the reply. Stopped when the prompt moved to v14.
- `qwen3.8-v14` — the same on prompt v14 (letter codes), over the first
  eleven days (`2026-10-02` … `2026-10-15`), in three `--resume` parts:
  6/7/8, mean rank 6.7, median 2, against Strata v14's 5/6/9 and 5.8 on the
  same days. Its misses are deliberate in the traces, not misread codes: on
  `2026-10-09` it read "back late" with an old "jen not here, save it"
  Rejection and put Mazra at #19. 6–11 minutes a day. Stopped when the
  prompt moved to v15.
- `qwen3.8-v15` — the same on prompt v15, on all 20 days in four
  `--resume` parts, at the server's default reasoning effort (`xhigh`):
  6/8/14, mean rank 9.6, median 7, against v15 Prepared Opus's 11/13/17 and
  10/13/14; behind its own v14 on the eleven days both ran (4/5/8 and 9.2
  against 6/7/8 and 6.7). Mazra is its standing miss, #19 on `2026-10-22`
  in the middle of its usual gap. `2026-10-08` came back unavailable once,
  at 25k tokens with a well-formed draft in the trace, and scored on the
  `--resume` retry (#7). 6–12 minutes a day.
- `qwen3.8-v17-low`, `-medium` and `-xhigh` — the same on prompt v17 at each
  `LOCAL_AI_REASONING_EFFORT`, on all 20 days, run a day at a time across
  the three: 11/14/17, 7/8/15 and 9/11/13, mean / median rank 6.8 / 3,
  9.1 / 7 and 9.6 / 5, against v17 Prepared Opus's 11/11/16 and 6.5. Low is
  level with Opus at hit@3 and ahead at 5 and 10; xhigh, the default, is
  ahead of its v15 run (6/8/14). Mazra is no longer the miss: #1–#3 on
  `2026-10-09` and `2026-10-22` at every effort. The too-soon days are the
  shared misses (Ninja Sushi `2026-10-18`, Leftovers `2026-10-21`, out of
  every top 10). No day unavailable or briefless. Low 2.5–4.5 minutes a
  day, medium 3–5, xhigh 6–10.

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

Three of the hits above are artefacts. Through prompt v13 the snapshot
numbered Options `1..N`, so a model that wrote its rank position where the
number belonged produced a valid row, and a ranking written that way read as
the Catalog in alphabetical order; the Pick scored a hit whenever it sat early
in the alphabet. `strata-v9` on `2026-10-02`, `strata-v12` on `2026-10-08`
(every row `rank|number|name|rationale`) and
`ai-search-v12-glm-5p3-low-pithy` on `2026-10-08` are such days, each counted
as hit@5; GLM's `2026-10-10` and `strata-v9`'s `2026-10-14` were the same
shape without the hit. From v14 Options carry letter codes, so a rank written
as a code resolves to nothing and the reply is refused instead (ADR-0013,
`.issues/ai-ranking-backtest/issues/05`). The `catalogOrder` flag stays as
the sentinel.
