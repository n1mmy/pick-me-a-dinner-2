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
side, the text counts (top-10 rows that give a timing count, and how many
of those with a yardstick beside it; rows with a gap list, a Log date, a
snapshot word, a code, a name written lower case; rows that count the
Option's days while a Tag was had sooner; rows opening with the name or a
stand-in for it, quoting the household, naming a weekday; the same for the
briefs; mean row length; usable-note coverage per run), the Pick's rank per
day, top-N overlap, hit flips, top-5 occupancy per Option, never-eaten
slots, and the Pick's row in each run. The counts are the definitions every
prompt version is read against (issues 14 and 15). The timing count is a
readout, not a fault, from v19 on: the count is wanted with the usual stretch
beside it (`CONTEXT.md`, rhythm claim). The code and lowercase-name counters
are heuristics (a run file carries no codes and no list of the household's
names), and the tag-nearer counter needs the per-row timing facts run files
carry from issue 15 on (older files print n/a); the compare prints their
rows for the eye.

Measure how far repeats of one setup differ with
`npx tsx scripts/backtest-spread.ts <run.json>…`: it groups the files by
model, thinking and prompt version, and reports per day and per arm the #1
agreement, top-3 and top-5 overlap, Kendall tau, the Pick's rank range, and
hits with their range across runs, counted on the days every run has.

The mean rank caps each day's rank at 15 (`RANK_CAP` in
`scripts/backtest.ts`): a Pick ranked past #15, or left unranked, counts as
#15. The tail's order does not matter, so one unlikely Pick ranked deep (West
Coast Cafe on `2026-10-16`, #30 to #32 for Strata and the Score) cannot
outweigh a run's top rows. Hits and the median are uncapped. The means in the
run list below were recorded before the cap and stand as written;
`backtest-compare.ts` recomputes the capped mean for any saved run.

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

- `strata-v17-low-40k`, `-medium-40k` and `-xhigh-40k` — Prepared note
  prompt v17 on Strata at each effort with a 40k budget, with traces: low
  11/11/13, mean / median rank 7.8 / 2 on all 20 days; medium and xhigh
  stopped short of the 20 (xhigh at 14). Read in issue 14 and re-counted
  in issue 15.
- `strata-v18-low-40k` and `-medium-40k` — the same on prompt v18: low
  7/9/11, mean / median rank 9.9 / 6 on all 20 days, behind its v17 at
  every hit level; medium 2/4/11 and 7.5 / 8 over 13 days. `qwen3.8-v18-low`
  — Qwen 3.8 dense on v18 at low: 7/7/12, 8.2 / 6, two days unusable.
  `prepared-v18-opus-5-5-low` — v18 on Opus 5.5 low: 12/13/16, 6.6 / 3.
  `ai-search-v18-opus-5-5-pithy` — AI search v18 on Opus pithy: 9/11/15,
  6.7 / 4. The text counts of all of them against v17, with the issue 15
  counters, are the baseline table in `plans/old/prompt-tweaks-v19.md`: v18 cut
  the leaks (gap lists, Log dates, tag syntax, codes, lowercase names) and
  halved the quotes, with every row shorter.
- `strata-v19-low-40k` — Prepared note prompt v19 (the count and the usual
  stretch, issue 15) on Strata at low with a 40k budget, with traces, on the
  same 20 days: stopped during its first day, before approval. Rerun with
  `--resume` once approved.
- `prepared-v19-opus-5-5-low` and `ai-search-v19-opus-5-5-pithy` — v19 on
  Opus 5.5, Prepared at low and AI search pithy, on the same 20 days:
  11/12/18, mean / median rank 5.5 / 3, and 11/11/15, 7.7 / 2. The read is
  issue 15's comment: the count-and-stretch line is the norm (144 and 115
  timing lines of 200, 85 and 56 with a yardstick), leaks at zero, rows
  longer, ranking within noise of v18.
- `prepared-v21-qwen3.8-low-r1` … `-r5` — Prepared note prompt v21 on Qwen
  3.8 dense at low, five repeats (`--repeat=5`), ~230s and ~9.5k tokens a
  day. Read with `backtest-spread.ts`: 7.8 / 10.0 / 16.0 (runs 7–9, 9–12,
  15–17), capped mean rank 6.2 (5.5–6.6); run pairs agree on the #1 on 7.0
  of 20 days, share 3.0 of their top 5, tau 0.57. That spread is the noise
  floor: a prompt change has to move more than about 2 hits, or a place of
  mean rank, to show on one run.
- `rank-v21-qwen3.8-low-r1` … `-r5`, `rank-v21-qwen3.8-off-r1` … `-r5`,
  `rank-v21-qwen3.8-off-t0-r1` and `-r2` — the rank-only ranker (prompt v21
  with the brief and rationales taken out, codes alone), since removed
  (`plans/old/remove-rank-only.md`). At low: ~220s and ~9.1k tokens a day,
  no cheaper, since reasoning is the cost; 8.4 / 10.6 / 14.2, mean rank 6.6,
  #1 agreement 7.9, top-5 3.1, tau 0.54, so no steadier or better than with
  text. Thinking off: ~40s a day but 6.0 / 8.0 / 13.0, 8.0, tau 0.40.
  Thinking off at temperature 0: steady (#1 on 19 of 20, tau 0.98) and worst,
  5.5 / 8.0 / 10.0, 9.0, so the spread is not just sampling. The `-day22`
  and `-probe` files, and five Opus 5.5 rank-only repeats of `2026-10-22`
  (2–3s, 91 tokens), were single-day probes. All are in `removed-setups/`.

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
- `prepared-v22-<model>-low` — Prepared note prompt v22 on four Fireworks
  models through the `LOCAL_AI_*` path (`LOCAL_AI_BASE_URL` the
  OpenAI-compatible `https://api.fireworks.ai/inference/v1`,
  `LOCAL_AI_REASONING_EFFORT=low`, `LOCAL_AI_MAX_TOKENS=40000`), on the
  same 20 days. `glm-5p3-flash` 7/7/11, mean / median rank 7.8 / 7, 17s
  and ~2.2k tokens a day; `deepseek-v4p1-flash-1017` 12/13/15, 5.3 / 2,
  68s and ~15.5k; `qwen3p8-2p4t-a95b` 11/13/17, 5.0 / 3, 43s and ~7.4k;
  `qwen3p8-max` 10/12/18, 5.3 / 3, 43s and ~6.5k. Against v21 Qwen 3.8
  dense low (7.8 / 10.0 / 16.0 over five repeats) the three larger models
  sit at or above its range at hit@3, inside it at hit@10. Fireworks cuts
  the Qwen 3.8 thinking short ("I have to give the solution based on the
  reasoning directly now") on 16 of 20 days in each run; three days (Max `2026-10-09`
  and `2026-10-11`, 2.4T `2026-10-18`) came back unavailable and scored on
  the `--resume` retry.
- `prepared-v22-qwen3.8-low` — the same prompt on local Qwen 3.8 dense at
  low (`.env.backtest.qwen`), one run: 8/9/14, mean / median rank 7.0 / 6,
  58/100 never-eaten top-5 slots, ~270s and ~9.6k tokens a day. Against
  its v21 repeats (7–9 / 9–12 / 15–17, mean rank 5.5–6.6, 42–51
  never-eaten slots) it is inside the range at hit@3 and hit@5, below it at
  hit@10, mean rank and never-eaten slots. v22's fix (a condition read at
  its newest word) is a case these 20 days do not exercise, so the run
  checks nothing broke; the Fireworks gains above are the models.
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

TypeSafe's Jev 1.14 (`scripts/typesafe-eval.ts`), a System One model that
answers typed questions with probabilities and writes no prose, so it is
scored on its ranking alone: no rationale, no brief, and every text count
reads n/a. One request a day, `jev-1.14.0` pinned, answers every arm. The
TypeSafe API bills input tokens only ($0.042 per million); every run below
together cost about $0.38. Each day's exact request and response is in the
run's `-reasoning/<day>.txt`, so any answer can be resent.

- `jev-1.14.0-noul-r1` … `-r5` and `jev-1.14.0-choice-r1` … `-r5` — TypeSafe's
  Jev (`scripts/typesafe-eval.ts`), ranking only: one request a day over the
  snapshot as JSON without its codes, ~30k input tokens, 0.3s, ~$0.0013.
  Its two arms answer in the same request: a Noul per candidate ("Will the
  Household eat X for dinner on the evening of `today`?") and one Choice
  over every candidate in an order shuffled by the date. Read with
  `backtest-spread.ts`: Noul 7.2 / 9.8 / 14.6, capped mean rank 6.9, #1
  agreement 16.8 of 20, tau 0.90, never-eaten top-5 slots 2–5 of 100;
  Choice 8.8 / 11.6 / 14.6 (runs 8–10, 10–13, 14–15), 6.2, #1 agreement
  13.0, tau 0.89, never-eaten slots 25–27. Against Qwen v21's five
  (7.8 / 10.0 / 16.0, 6.2, tau 0.57) the Choice is level, and steadier.
  The deterministic Score on the same days (`score-baseline`) is 4/8/12,
  8.3. Jev answers to two decimals, so ties are common: the Pick's rank sat
  in a tie on 9 to 13 days a run, broken in the Catalog's alphabetical
  order; breaking every tie against the Pick moves r1 and r2 of the Choice
  to 9/11/14 and 8/10/15. The Noul probabilities sum to 3.6–4.3 a day: an
  order, not a calibrated chance of one dinner.
- `jev-1.14.0-history-noul` and `-choice` — the same, once, on the 90
  decided days with a stored Qwen 3.8 Prepared note (`2026-07-12` …
  `2026-10-30`; `backtest-stored.ts` gives the list), against those notes
  (`stored-notes`) and the Score (`score-history`), all 89 scorable: Score
  17/32/49, 8.7; stored notes 32/41/57, 7.7; Noul 24/34/57, 7.9; Choice
  27/38/58, 7.7. Day by day the Choice beats the stored note's Pick rank on
  35, loses on 35, ties on 19; the Noul 32 / 39 / 18. Level with Qwen at
  hit@3 on the 20 days, the Choice is 5 behind the notes on the 90. The Noul
  puts no Option never eaten in the 90 days in any top 5 (0 of 445 slots),
  against the notes' 38, the Choice's 41 and the Score's 91, but has the
  most too-soon days: 5, against the notes' 1. Up to 32.8k input
  tokens a request on the latest days, near the 32k a question may read.
- `jev-1.14.0-s2-history-noul` and `-choice` — the same 90 days with
  `--state=2` (`jevStateByOption`): no dates, every event "N days ago",
  each Option's notes, Rejections and Tag recency under its name, the count
  set against its recent gaps in code (`soonerThanEveryRecentGap`,
  `longerThanEveryRecentGap`), and the last week's dinners in place of the
  Log. Half the tokens (≤15.9k a request) and worse everywhere: Noul
  22/34/58, 8.3; Choice 23/34/57, 8.0, against state 1's 24/34/57, 7.9 and
  27/38/58, 7.7. On the 20 days the means (Noul 7.5, Choice 7.4) fall
  outside state 1's five-run ranges (6.8–7.0, 6.0–6.4). Too-soon days did
  not fall (Noul 5, Choice 6), and never-eaten top-5 slots rose for the
  Noul (0 to 5) while they fell for the Choice (41 to 20). Day by day
  against state 1: Noul better on 21, worse on 37; Choice 32 and 39.
- `jev-1.14.0-history-rerank-<arm>` — the state 1 history answers ranked
  again offline (`scripts/typesafe-rerank.ts`, no call), each with no fitted
  weight, a tie broken by the Score: Noul 24/35/59, 7.8 and Choice
  28/41/60, 7.3 with the tie-break alone; the mean of the Noul's and the
  Choice's ranks 28/40/61, 7.3; the Choice's and the Score's 32/43/67, 6.7;
  all three 37/54/70, 6.0, against the stored notes' 32/41/57, 7.7. All
  three lead the notes in July–September (24/37/50 against 20/27/40) and in
  October (13/17/20 against 12/14/17), and beat the notes' Pick rank on 42
  days, lose on 23, tie on 24. The control, the notes' ranks averaged with
  the Score's the same way, is 25/37/63, 7.3: the gain is not the Score's
  alone. Too-soon days stay at 5, against the notes' 1; never-eaten top-5
  slots 0 of 445.
- `jev-1.14.0-q2-history-noul`, `-choice` and `-choice-avg` — questions v2
  on the same 90 days: the Choice asked in three orders in one request
  (`choice` in v1's order, `choice_2` and `choice_3` shuffled afresh), and
  `choice-avg` ranked by the mean of the three. 90 requests, 2.36M input
  tokens (≤33.5k a request), $0.099. Noul 23/33/55, 8.3; Choice 25/39/55,
  8.0; Choice averaged 26/41/56, 7.7 — the single arms a little under v1's
  with no change to them, so the averaging's gain sits inside a run's
  noise. The orders agree at tau 0.90, as two runs do (0.89), and on the
  top answer on 42 of 90 days; the Option listed first draws 0.018 on
  average against 0.028 over every place, so no first-place lean shows
  here. Averaging cuts tied values from 26 to 19 a day. Ranked again
  (`-q2-history-rerank-<arm>`): all three, Noul + Choice + Score, 35/54/69,
  6.2, against the first run's 37/54/70, 6.0; with the averaged Choice in
  its place 36/52/70, 6.1. Too-soon days 5. v2 is not kept: the eval is
  back at v1 and the re-rank has no averaged arm, so the run is read here;
  each day's v2 request is in its `-reasoning/` to resend (`choice_2` and
  `choice_3` were shuffled by `<today>/2` and `<today>/3`).
- `jev-1.14.0-s3-history-noul` and `-choice` — the same 90 days with
  `--state=3` (`jevStateLean`): state 1's facts and arrangement, dates and
  the whole Log kept, with the copies taken out as `leanSnapshot` takes them
  out for the LLM rankers — a Log or Rejection row keeps its date, name and
  note or reason, not the Option's kind and Tags, and the Tags lose their
  Rejection lists, which were `notTodayRejections` filed again per Tag.
  60k chars drop to 33k; ≤19.4k input tokens a request (mean 15.7k against
  state 1's 25.5k), 1.41M in all, $0.059. Worse on both arms: Noul
  21/34/53, 8.4 and Choice 19/30/56, 8.4, against state 1's 24/34/57, 7.9
  and 27/38/58, 7.7; day by day against state 1 the Noul is better on 24,
  worse on 42, the Choice 26 / 50. Too-soon days 7 (Noul) and 5; never-eaten
  top-5 slots 0 and 8. Ranked again (`-s3-history-rerank-<arm>`): all three
  36/48/65, 6.6, against state 1's 37/54/70, 6.0, better on 17 days and
  worse on 44. Two state 1 runs differ by about 0.4 in mean rank and 2 or 3
  hits at a level (`history` against `q2-history`), so the Choice's loss is
  outside that and the Noul's at its edge.
- `jev-1.14.0-s4-history-noul` and `-choice` — the same 90 days with
  `--state=4` (`jevStateLeanByOption`): state 3 with each candidate's own
  dinners (date and note) and Rejections (date and reason) under its name,
  newest first, so a Noul reaches one Option's past in one hop, the whole
  dated Log kept beside it for the view across Options; the flat Rejection
  list goes (a Rejection of an Option that is no candidate today is dropped).
  ≤25.1k input tokens a request (mean 19.8k), 1.79M in all, $0.075. The
  Noul recovers and passes state 1: 22/39/59, 7.7, against 24/34/57, 7.9;
  better on 44 days, worse on 34. The Choice recovers to level: 27/36/58,
  8.0, against 27/38/58, 7.7; better on 39, worse on 34. Too-soon days 7 on
  both arms, against state 1's 5 and 4; never-eaten top-5 slots 0 and 17.
  Ranked again (`-s4-history-rerank-<arm>`): all three 38/47/68, 6.3,
  against 37/54/70, 6.0; better on 31 days, worse on 36, tied on 22, and
  level in both halves (26/33/47 against 24/37/50 in July–September,
  12/14/21 against 13/17/20 in October). Inside a run's noise, at three
  quarters of the tokens.
- `jev-1.14.0-s5-history-noul` and `-choice` — the same 90 days with
  `--state=5` (`jevStateLeanByOptionTaggedLog`): state 4 with the Option's
  Tags back on each Log row, to test whether those were the copies state 3
  lost by. ≤28.2k input tokens a request (mean 22.3k), 2.01M in all, $0.084.
  Level with state 4, not above it: Noul 22/36/57, 7.9 (against state 4's
  22/39/59, 7.7; better on 23 days, worse on 30), Choice 24/34/57, 8.1
  (against 27/36/58, 8.0; 28 / 35). Against state 1 the Choice is 36 days
  better and 35 worse, the Noul 38 / 38. Too-soon days 7 and 6; never-eaten
  top-5 slots 0 and 16. Ranked again (`-s5-history-rerank-<arm>`): all
  three 34/49/69, 6.4, against state 4's 38/47/68, 6.3 and state 1's
  37/54/70, 6.0; 26 days better than state 4, 24 worse, 39 tied.
- `jev-1.14.0-s6-history-noul` and `-choice` — the same 90 days with
  `--state=6 --long-context` (`jevStateWithOptionHistory`): state 1 whole,
  every copy kept, plus each candidate's dinners and Rejections under its
  own name as in state 4; past the 32k a question may read, so sent with
  the `TypeSafe-Danger-Zone-Long-Context` header. ≤42.8k input tokens a
  request (mean 32.7k), 2.94M in all, $0.124; no call slower than 0.4s. The
  best single arms so far: Noul 25/41/58, 7.6 (better than state 1 on 41
  days, worse on 26; than state 4 30 / 27), Choice 27/37/62, 7.8 (41 / 35
  against state 1; 42 / 33 against state 4). Too-soon days 7 on both;
  never-eaten top-5 slots 0 and 17. Ranked again
  (`-s6-history-rerank-<arm>`): all three 40/52/70, 6.0, level with state
  1's 37/54/70, 6.0 (27 days better, 29 worse, 33 tied) and ahead of state
  4's 38/47/68, 6.3 (34 / 25); against the stored notes 44 / 27 / 18. By
  half: 26/35/49 in July–September, 14/17/21 in October.
- `jev-1.14.0-s6-history-r2-noul` and `-choice` — state 6 again, the same
  request each day, as the control for state 7. Noul 26/40/60, 7.6 and
  Choice 30/37/60, 7.5, against the first run's 25/41/58, 7.6 and 27/37/62,
  7.8; day by day the Noul is better on 26 and worse on 24, the Choice
  35 / 27. All three 39/52/69, 6.1 against 40/52/70, 6.0 (21 / 21 / 47).
  So state 6 holds, and two runs of one shape differ by 0 to 0.3 in mean
  rank and up to 4 hits at a level. Too-soon days 5 and 6, against the
  first run's 7 and 7: that count moves by 2 between identical runs.
- `jev-1.14.0-s7-history-noul` and `-choice` — `--state=7 --long-context`
  (`jevStateWithOptionAndTagHistory`): state 6 with each Tag's dinners
  (date and Option) under the Tag and, under each candidate, the days since
  each of its Tags was had — the timing facts one hop from the question.
  ≤53.9k input tokens a request (mean 41.7k), 3.75M in all, $0.158; the
  slowest call 1.0s. Worse than both state 6 runs: Noul 29/37/58, 7.8
  (against them 31 / 38 and 28 / 38 by day), Choice 22/35/60, 7.9 (28 / 40
  and 26 / 43). The Choice's never-eaten top-5 slots went from 17 to 56:
  with a Tag's dinners laid out, an Option never eaten under a Tag long
  unhad rises. Too-soon days 5 on both arms, no better than state 6's
  second run. All three 39/47/67, 6.3, worse than either state 6 run on 19
  days to 33 and 18 to 32.

What the Jev runs say:

- **It ranks, and clearly better than the Score.** Both arms beat the
  deterministic Score on both day sets, at every hit level and on mean rank.
- **Over 90 days the Choice is level with Qwen's stored notes, except at the
  top.** Mean rank 7.7 each, hit@10 58 against 57, and the Pick ranked
  higher on as many days as lower (35 / 35); hit@3 is 27 against 32, and on
  October's 27 days 8 against 12. The 20 days alone flattered it: there it
  sat level with Qwen v21 at hit@3, a property of that set.
- **It is steadier than Qwen, not fixed.** Two identical runs differ, but
  five agree on the order at tau 0.89–0.90 against Qwen v21's 0.57.
- **The two arms trade errors.** The Choice gets more Picks into the top
  rows; the Noul is the most conservative, with no never-eaten Option in a
  90-day top 5 at all. Both let a too-soon Option into the top 5 more often
  than the notes do (4 and 5 days against 1): timing is where Jev is weak,
  as its docs warn about dates and arithmetic.
- **Doing the timing in code did not fix that, and cost ranking.** State 2
  (precomputed "N days ago", gap comparisons, the Log cut to the last week)
  was worse on every view and left the too-soon days where they were.
- **Smaller is not better by itself: the repeated copies were doing work,
  and not through the Tags.** State 3 took out only what `leanSnapshot`
  takes out for the LLM rankers — the Option's kind and Tags on every Log
  and Rejection row, and the Rejections filed again under each Tag — and
  both arms lost, the Choice clearly (19/30/56 against 27/38/58, worse on
  50 days to 26). The ready explanation, that the Tags beside each date let
  "sushi three days ago" be read off the Log in one hop, did not hold:
  state 5 put the Tags back on the rows and gained nothing over state 4.
  What the copies did is open — the Rejections filed under each Tag with
  their reasons, the kind on each row, or several small things together.
  State 2's loss has the same copies in it, so it is not the Log cut alone.
- **Each Option's history under its own name recovers the loss, and gives
  the Noul a little more.** State 4 adds a candidate's dinners and
  Rejections under its own entry, Log kept: the Noul passes state 1 on mean
  rank and hit@5 and wins 44 days to 34, the Choice returns to level day by
  day (39 / 34), and the three-way mean is level with state 1 (38/47/68,
  6.3 against 37/54/70, 6.0; 31 days better, 36 worse) at three quarters of
  the tokens. Too-soon days rose to 7 on both arms.
- **The 32k limit is not a wall: long context showed no cost at 43k.** State
  6 keeps all of state 1 and adds the per-Option history, sent with the
  long-context header, and both arms are the best yet — the Noul 7.6 and
  the Choice 7.8, each better than state 1 on 41 days — while the calls
  stayed at 0.4s. The three-way mean is level with state 1 (40/52/70, 6.0)
  and ahead of state 4. So the Log need not be trimmed for size, and there
  is room to add what the notes have and Jev lacks. The two findings read
  together: the per-Option history is worth its tokens, the copies state 3
  took out were too, and the shape to carry forward is state 6, with the
  header, or state 4 inside the default limits. A second state 6 run
  reproduced it (Noul 7.6 again, Choice 7.5), so its gain over state 1 is
  outside what two runs of one shape differ by.
- **More timing state did not fix the timing, and cost the Choice.** State
  7 laid each Tag's dinners out under the Tag and put each candidate's Tag
  recency beside it, the facts a too-soon call needs in one hop, and
  too-soon days stayed at 5, the same as state 6's second run; that count
  moves by 2 between identical runs, so none of the shapes has moved it.
  Meanwhile the Choice put never-eaten Options into 56 of 445 top-5 slots
  against 17: a Tag long unhad lifts every Option under it, eaten or not.
  Both arms lost to both state 6 runs day by day. The timing fix is not
  more state; it is the Score's place in the mean, or a timing judgment
  of its own combined in code.
- **The probabilities give an order, not a confidence.** They come to two
  decimals, so the Pick sits in a tie on about half the days (broken
  alphabetically, worth up to a hit or two at each level); the Noul's sum
  to about 4 a day; the Choice's top answer is 0.09–0.23, so no day reads
  as a sure thing.
- **It is fast and cheap but near its context limit.** 0.3s and about
  $0.0013 a day, against minutes on the local model. The limit that binds
  is 32k tokens for the state plus any one question (the 64k a whole
  request may hold is far off: the 38 questions add about 6.5k). State 1's
  requests reached 32.8k input tokens on the newest days; that is the whole
  request, so the state plus the Choice stood near 29k, with a few weeks'
  room at the 131 tokens a day the Log adds. State 4 is the trim that costs
  nothing so far: 25.1k a request, about 22k a question, growing 84 a day.
  Past the limit is the long-context header (262k, same price, slower and
  less accurate by the docs).
- **Combined with the Score, it ranks best of anything so far.** The mean
  of the Noul's, the Choice's and the Score's ranks, with no weight to fit,
  is 37/54/70 and 6.0 on the 90 days, and leads in both halves of them,
  against the best one alone (the Choice, 28/41/60) and the notes'
  32/41/57. A second run gave 35/54/69 and 6.2, so it holds. The three
  disagree in different places; the too-soon days do not go away.
- **Asking the Choice in more orders buys nothing worth keeping.** Jev
  showed no lean toward the first option here, the orders agree as closely
  as two runs, and inside the three-way mean the averaged Choice changes
  nothing (36/52/70 against 35/54/69). The Score's tie-break already does
  what the averaging's fewer ties would.
- **It cannot be the Prepared note.** With no prose, the most it could take
  over is an order: the Score's place, or the order under an LLM's prose.

Not tried: state 4 with the Rejections filed under each Tag as well, to
see whether those were the copies state 3 lost by; a second run of state 4;
a too-soon Noul of its own ("Has the Household had this, or its cuisine,
more recently than they would choose to again?") combined in code with
state 6's ranking; judgments broken down (due, ruled out by a Rejection, pointed at by the Day
note) and combined in code, which needs weights; Jev reordering an LLM's
shortlist.

## Jev as a reader of the stored notes

`scripts/typesafe-judge.ts` has Jev judge instead of rank: for each row of a
night's stored Prepared note, is the AI rationale reasonable for that Option
on that evening? One request a night (two past the request limit), every
row among the day's candidates, with the line and what each judgment needs
of the Option's facts inside its own question. Eight questions a row
(`JUDGE_VERSION` 4): does the line give a length of time, and does it match
the Option's or a Tag's days since last; does it give a usual stretch, and
does it match the recent gaps; does it state something the facts contradict;
does it carry the snapshot's own terms; its stance (for tonight, against,
neither — a Choice); and, on a night with a Day note, does it go against it.
Code turns the answers into flags at 0.7 / 0.3 (`flagRow`): wrong timing,
wrong stretch, contradicts the facts, snapshot's words, against the Day
note, a top-5 row arguing against its Option, a row past #10 arguing for it;
an answer between the thresholds is counted as unsettled, never a flag. Two
code checks ride along as a yardstick — the compare script's leak regexes,
and the count written in the line against the facts — and the report ends
with the agreement tables and every row where the judge and the code
disagree. Each night's exact request and response is in
`jev-1.14.0-judge-reasoning/<day>.txt`. All four runs below are on the same
90 noted days (3,212 rows) and together cost $0.51.

- `jev-1.14.0-judge-q1` — questions v1, `2026-10-22` alone. The words
  question asked "Is `line` written the way one person in the Household
  would say it to another?" and read nearly every line as no (0.06–0.26 on
  a night with no leak): the lines are notes about the household, not talk
  between them. Rewritten to ask the observable thing, whether the line
  carries the record's own terms.
- `jev-1.14.0-judge-q2` — v2 on the 90 days, 3.39M input tokens, $0.14.
  Flagged 500 rows (15.6%): wrong timing 156, contradicts 144, snapshot's
  words 112, Day note 11, top row against 23, tail row for 85. Of the 156
  wrong timings about 140 were never-eaten rows ("Never tried, no
  history"), which the timing question counted as a time it then could not
  match — a question fault, fixed in v3. The count check's parser also
  missed numbers written as "one hundred and ninety-one" (241 false
  mismatches), fixed in code.
- `jev-1.14.0-judge-q3` — v3: the never-eaten case, the word "tag" named as
  a leak, each Tag's last dinner in the facts (so "Korean was four days ago
  via Kukje" can be checked), and the contradiction asked as the
  citation-check cookbook's three-way Choice (borne out / contradicted / not
  covered). 3.79M tokens, $0.16. Wrong timing fell to 15 and the words
  flags rose to 379, but the Choice flagged 280 rows against v2's 144, and a
  sample of the 185 new ones had about one real contradiction in four: the
  Choice put its probability on "contradicted" for anything slightly off,
  and its "no history when it has" clause fired on every never-eaten row
  with an old Rejection.
- `jev-1.14.0-judge` — v4, the run to read: the contradiction back as a
  Noul with "something the facts do not speak to" named in its false
  criterion, and the usual stretch asked on its own against the recent
  gaps. 4.90M tokens (49k–63k a night, 0.3–0.5s), $0.21. Flagged 673 rows
  (21.0%), 200 of the 900 top-10 rows, 57 rows with two flags: wrong
  timing 14, wrong stretch 113, contradicts 101 (77 of them flagged by v2
  too), snapshot's words 391, Day note 9, top row against 24, tail row for
  78. By month (rows / flagged): July 319 / 63, August 964 / 208,
  September 963 / 182, October 966 / 220 — flat across prompt versions.
  Words against the regexes: both 360, Jev only 31, regexes only 215.
  Timing against the count check, on the 2,838 rows with a count: both
  wrong 9, Jev only 3, code only 26, both fine 2,800.

What the judge runs say, read row by row against the facts sent:

- **The count check is sound.** On 2,800 of 2,838 rows Jev and the parser
  agree the line's count matches a fact, and the 9 they both call wrong are
  wrong: "Eighty-seven-day gap" written where the count belongs, "Ninety-five
  days" for 195, a Mazra line counting "eighteen days" past a dinner the
  note knew was served by the PTA. The 26 the code alone calls wrong are
  lines counting from a Rejection ("rejected yesterday") or another Option
  ("twelve days since pasta" on West Coast Cafe), which Jev reads rightly.
- **The words check reaches what the regexes cannot, and misses dates.**
  Jev's own 31 are tags as written — "with sonia: rice", "peruvian",
  "a change from med, thai, and mexican" — and a line of three counts in a
  row. The regexes' 215 are mostly "the swim tag" / "no tags" phrasing,
  where Jev sits at 0.4–0.7 and is counted unsettled, and calendar dates
  ("the Oct 10 rejection", "the June 30 date night", "the 10/4 rejection"),
  which it reads at about 0.55 though the criterion names them.
- **The stretch check is not reliable.** About one wrong-stretch flag in
  three is real (K-Grill's "single gap of twenty-eight" with no gaps; Mollie
  Stone's "thirteen-to-nineteen" with a 49 left out). The rest are
  "a reasonable gap" or "rare" read as a stated stretch, and right ranges
  read as wrong — "its normal two-week gap" against 10, 17, 14, 15; "their
  shortest gap of fourteen" against 36, 14, 28, 21. Comparing a range to a
  list of numbers is the weak spot the model's docs name; a parser for the
  line's range, as for its count, would do it in code.
- **The contradiction check is about half right, and worth it at that.**
  Real hits: "thirty-nine days sits comfortably between its usual gaps of
  thirteen and nineteen"; a "one hundred and fifty-five" Peruvian gap that
  exists nowhere; "Helen's fried rice was six days ago via Societea" when
  it was thirteen, at Thai Nakorn; "no standing notes or tags" on an Option
  with three Tags and a note; Societea "both landed yesterday" at three
  days. The misses are a date a day off ("the rejection from four days ago"
  at five), a Rejection the line calls one-off that Jev calls standing, or
  a judgment phrased as fact. Both the Noul forms beat the three-way Choice.
- **The stance against the rank is a readout nothing else gives.** The 24
  top-5 rows whose line argues against its Option are real: "#3 … making two
  in a row feel repetitive", "#4 … it feels more like a tomorrow pick",
  "#5 … Not ruled out, just not the cleanest fit tonight". The 78 tail
  rows arguing for theirs ("#13 … Korean is generally due") are the mirror.
- **The Day note check works at the top of its range only.** 9 flags on the
  253 rows that had a note: "Helen gets her fried rice" on a "No helen and
  konal" night at 0.90 and a fried-chicken place "for helen" at 0.89 are
  right; the 0.70–0.78 flags are rows that agree with the note or do not
  touch it.
- **It is fast and cheap, and at the request limit.** 0.3–0.5s and about
  $0.002 a night, against minutes for the note itself; the longest night
  reached 62.9k of the 64k tokens a request may carry, so the script now
  splits a night past about 49k into two requests.

Not tried: the brief; a parser for the line's stretch to check it in code
as the count is; whether a Rejection the line sets aside was standing or
one-off; the judge's flags as a gate on what Tonight shows, or as a tie-break
between two notes for one night.
