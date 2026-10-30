# Rank-only rankings: measure how much a Prepared ranking varies

Grilled 2026-10-30 (`/grill-with-docs`). This adds a backtest ranker that
sends the Prepared note prompt with the text parts taken out: the model
returns codes in rank order, with no rationale and no brief. It also adds
the options to run a ranker N times and a script that measures how far
the N rankings differ. Tonight is unchanged. There is no `CONTEXT.md`
change and no ADR: all of this is eval tooling, not domain language.
Writing the rationales and brief in a second call, after a ranking-only
call, is a possible later production change. It waits on what this work
finds.

## Why

Two runs of the same prompt on the same model and days differ. These are
the saved pairs, measured on 2026-10-30:

| Pair (20 days) | Same #1 | Top-5 shared | Pick's rank change, mean (capped) |
|---|---|---|---|
| Prepared v14 Opus 5.5 low | 16/20 | 3.95 | 2.7 |
| Prepared v15 Opus 5.5 low | 16/20 | 4.20 | 2.6 |
| Qwen 3.8 dense v19 low | 9/20 | 2.95 | 3.9 |

- **Opus** keeps its top 5 stable (rank movement about 1 place) and
  reshuffles the tail (5–7 places).
- **Qwen** moves about 2 places even inside its top 5. Its #1 differs on
  more than half the days.
- **Noise vs prompt changes:** one or two runs per prompt version can't
  tell a prompt change apart from this noise.

What a rank-only answer saves, assuming the reasoning stays the same
length:

- **Opus:** about 75% of a ~20s day, since the rationales and brief are
  ~80% of its output.
- **Qwen 3.8 dense:** about 15% of a 4–6 minute day, since reasoning is
  ~85% of its output.

So for the local model, the speed has to come from the reasoning
settings. That is why thinking off is an arm.

Today nothing sets `temperature` or `seed`, so every run samples at the
server's default.

The local model now is Qwen 3.8 dense on the llama.cpp server
(`.env.backtest.qwen`). New code and docs call it "the local model". The
server is named only beside a measurement taken on it.

## Step 1: share the Prepared prompt's blocks, with the production text pinned

Today the stored note's input hash covers `buildPreparedSystemPrompt()` and
`buildPreparedUserMessage()` (`lib/prepared-notes.ts:57`). If either
changes by a byte, every unfrozen note reads out of date, and the sweep
rewrites up to seven of them on the local model. So the guard comes
before the refactor.

- **Guard first:** in `lib/prepared-note.test.ts`, pin
  `buildPreparedSystemPrompt()` and `buildPreparedUserMessage()` (on the
  test file's fixture snapshot) with `toMatchFileSnapshot`. The files sit
  under `lib/__snapshots__/`, and the test is committed while the text is
  still as it is at HEAD.
  - A deliberate change then shows as a diff in the commit.
  - A small difference may be kept if it has a reason. Name it in the
    commit message and bump `PREPARED_PROMPT_VERSION`.
- **Then split `buildPreparedSystemPrompt` into named blocks** in
  `lib/prepared-note.ts`: the opening, the snapshot description, the
  imported `SNAPSHOT_EVIDENCE` and `RECENCY_THROUGH_HABITS`, the "two
  things" line, the ranking paragraph, the rationale paragraph, the brief
  paragraph, `RATIONALE_RULES`, the data-not-instructions line, and the
  output format. `buildPreparedSystemPrompt` joins them exactly as today.
- **The ranking paragraph** splits into its lead ("First, the ranking: ")
  and the body that both prompts share ("every candidate Option, best fit
  … write it.").
- **`candidateChecklist`** takes whether the brief line follows. The
  Prepared message keeps "Then line N+1, the last: brief|…"; the rank-only
  message ends after the codes.
- **The guard passes unchanged** after the split.

Commit this on its own.

## Step 2: the rank-only prompt and parser

Both go in `lib/prepared-note.ts`, next to the Prepared versions:

- **`buildRankSystemPrompt()`** has the opening, the snapshot description,
  `SNAPSHOT_EVIDENCE`, `RECENCY_THROUGH_HABITS`, the shared ranking body
  under its own lead ("Rank the candidates: "), the data-not-instructions
  line, and its own output format:
  - one line per Option, best first;
  - each line is the Option's code alone;
  - no rationale, no `|`, no numbering or bullets, no blank lines, and
    nothing before the first row or after the last.
  - It leaves out the "two things" line, the rationale and brief
    paragraphs, and `RATIONALE_RULES`.
- **`buildRankUserMessage()`** is the lean snapshot, then the checklist
  with no brief line.
- **`parseRankReply(text, { idByCode })`** reads each trimmed line as a
  code. A line of the form `G|…` is tolerated, and its code is read. It
  works like the Prepared parser:
  - a line that doesn't resolve to a code is skipped;
  - a repeated Option keeps its first row;
  - `NONE` or no rows at all returns `null`.
  - It returns `AiRankingRow[]` with `reason: ""`.
  - It reads a bare code with `toCode`, which `lib/ai-search.ts` already
    exports.
- **Version:** there is no separate counter. A rank-only run records
  `PREPARED_PROMPT_VERSION`, and a wording change to either prompt bumps
  it.

Tests:

- The rank-only system prompt contains every shared block and none of
  the brief or rationale text.
- The rank-only user message ends with the codes.
- The parser:
  - reads bare codes and `G|…`;
  - skips a line that isn't a row;
  - keeps the first of a repeat;
  - returns `null` for `NONE` and for an empty reply.

## Step 3: rank output, temperature, thinking off, and repeats in the eval

**The local-model client** (`createPreparedNoteClient`) gains three
optional settings. Production passes none of them, so its request is
unchanged:

- **`output: "note" | "rank"`**, default `note`. With `rank` it uses the
  rank-only prompt, message and parser, and returns
  `{ brief: "", ranking }`. `MIN_RANKED_SHARE` and the "only a natural
  `stop` is a whole answer" rule still apply.
- **`temperature?: number`**, sent as `temperature` when set.
- **`thinking?: false`**, which sends
  `chat_template_kwargs: { enable_thinking: false }` and no
  `reasoning_effort`.
- **No seed** is ever sent: repeats have to be free to differ.

Tests: with no new settings, the request body equals today's. With each
setting, its field appears in the body.

**`scripts/prepared-note-eval.ts`**:

- **New flags:**
  - `--output=rank|note` (default `note`);
  - `--temperature=<n>`;
  - `--thinking=off`, which overrides `LOCAL_AI_REASONING_EFFORT`;
  - and `--effort` already exists for `--claude`.
- **The Claude path:**
  - With `--thinking=off` it sends `thinking: { type: "disabled" }`.
  - With `--temperature` it sends `temperature`. A temperature without
    `--thinking=off` is refused with a message, because the API rejects
    it.
  - With `--output=rank` it sends the rank-only prompt and message and
    parses with `parseRankReply`.
- **`meta` gains:**
  - `output` (`note` | `rank`);
  - `temperature` (the number, or `default`);
  - `thinking` (the effort, or `off`).
- **The default run file name:**
  `scripts/backtest-runs/<prepared|rank>-v<version>-<model>-<thinking>[-t<temp>].json`.
  The model name loses a leading `claude-`. Examples:
  - `rank-v20-qwen3.8-low.json`
  - `rank-v20-opus-5-5-off-t0.json`
  - `prepared-v20-qwen3.8-low.json`
  - This replaces the `strata-v…` default.
- **Doc comment:** the comment at the top says "the local model". The line
  "Strata is free to call, so the billed-call rule does not apply" is
  wrong and is replaced: a single call is a probe, and a sweep waits for
  approval (`CLAUDE.md`).

**`scripts/backtest.ts`**:

- **`--repeat=N`** goes into `parseBacktestArgs` / `BacktestArgs`, and
  `runBacktest` runs the day list N times, one whole run after another.
  - The run files are `-r1` … `-rN` (each with its own `-reasoning/`
    directory), and repeat `i` writes `meta.repeat: "i/N"`.
  - With `--resume`, a finished file is skipped and a partial one is
    resumed. That way a sweep can be split into chunks that each fit
    under the two-hour background limit.
- **Empty reasons on a rank run:** for a run whose `meta.output` is
  `rank`, `scoreDay`'s empty-top-10 count and `printDay`'s reason lines
  are skipped. A rank-only row is meant to have no reason.

## Step 4: `scripts/backtest-spread.ts`

`npx tsx scripts/backtest-spread.ts <run.json>… [--averaged]`. It is
offline and reads saved run files only.

**Arms:**

- Files are grouped into arms by `meta`: `output` (an old file without it
  counts as `note`), `model`, `thinking` (or the old `effort`),
  `temperature` (or `default`), and `promptVersion`.
- With-text runs are read like any other. That includes the existing
  `qwen3.8-v19-low` family and the Opus v14 and v15 pairs.
- Options are matched by name, because run files carry no ids or codes.
- A day counts for an arm when at least two of its files have it `ok`.

**What it reports, for each arm:**

- **Per day:**
  - the share of run pairs that agree on the #1;
  - the mean top-3 and top-5 overlap;
  - the mean Kendall tau-b over the Options both runs ranked;
  - the Pick's median and lowest-to-highest rank;
  - and for each Option in the averaged top 10, its mean rank and
    lowest-to-highest rank (which Options sit firmly, which drift).
- **Per arm:**
  - hit@3/5/10 and the capped mean rank (from `summarize` in
    `scripts/backtest.ts`), each as a mean with its lowest and highest
    across the runs;
  - the per-day measures above, averaged over the days;
  - the number of runs and days.

**`--averaged`** writes one run file per arm that has two or more runs,
`<arm>-averaged-n<N>.json`:

- **Ordering:**
  - each day lists the Options by mean rank across the runs;
  - an Option missing from a run counts at that day's candidate count;
  - a tie goes to the Option that ranked above the other in more runs,
    then to name.
  - In the grilling the last tie-break was Score order. But the run files
    don't carry the Score, and the script stays offline, so name order
    stands in for it. Ties that survive both earlier steps are rare at
    N ≥ 3.
- **Scoring:** the Picks and their candidate flags, `pickTiming` and
  `candidates` come from the source records. Ranks, hits and `bestRank`
  are recomputed. `tooSoonMisses` is empty, since that needs the day's
  Rejections, which a run file doesn't carry.
- **`meta`:** the arm's fields plus `averagedFrom: N` and the source
  paths, so the averaged list counts as an arm of its own.
- **Compatibility:** `backtest-compare.ts` reads the averaged file like
  any run. Its text counters read zero there.

Tests in a new `scripts/backtest-spread.test.ts`, on small in-memory
records:

- Kendall tau-b on identical, reversed and partly overlapping rankings.
- Top-k overlap and #1 agreement.
- Arm grouping, including an old file with no `output`, `thinking` or
  `temperature`.
- The averaged order: mean rank, the missing-Option rank, both
  tie-breaks.
- The averaged file's hits from the Picks.

## Step 5: the probes, then the sweep proposal

The six probe calls are approved (2026-10-30). Each is one day, with
`--days=2026-10-22`, and writes a `-probe` file:

| Arm | Qwen 3.8 dense (`.env.backtest.qwen`) | Opus 5.5 (`--claude`, billed, a few cents) |
|---|---|---|
| rank, thinking `low` | `--output=rank` at `LOCAL_AI_REASONING_EFFORT=low` | `--output=rank --effort=low` |
| rank, thinking off | `--output=rank --thinking=off` | `--output=rank --thinking=off` |
| rank, thinking off, temperature 0 | `--output=rank --thinking=off --temperature=0` | the same |

- **Temperature 0 is always paired with thinking off.** Claude refuses a
  temperature when thinking is on. Qwen's own guidance warns that greedy
  decoding with thinking on can loop.
- **Recording:** for each probe, record its latency, output tokens,
  reasoning length, rows ranked against candidates, and the Pick's rank.
  These go in the run list in `scripts/backtest-runs/README.md`, with a
  note on whether the llama.cpp server took `enable_thinking: false`
  (whether the reasoning came back empty).
- **Then a proposal, not a run:** propose the first sweep from the probe
  numbers: arms × N × 20 days, in hours on the local model and dollars
  on Opus, in chunks under the two-hour limit. N is chosen then. Running
  the full prompt N times (the with-text arm), needed to compare
  variance with the rank-only prompt, is a separate approval: about 8
  hours on the local model at N=5.

## Verification

Run the gate from `docs/agents/ralph.md`, as `npx tsc --noEmit`,
`npx next lint` and `npx vitest run` (there's no `pnpm` on this
worktree's `PATH`). Then:

- `npx tsx scripts/backtest-spread.ts` on the saved
  `prepared-v14-opus-5-5-low` pair reproduces the 2026-10-30 figures
  above: same #1 on 16/20 days, top-5 overlap 3.95.
- `git diff lib/__snapshots__/` is empty after step 1, or each line of it
  is named in a commit message.

## Out of scope

- AI search (its prompt and `scripts/ai-search-eval.ts`).
- Any change to Tonight, the sweep, the stored note, or the input hash
  beyond what step 1 pins.
- A fixed seed.
- A production rank-only or two-call Prepared note: a candidate for later,
  judged on this work's numbers.
- `CONTEXT.md` and ADR changes.
