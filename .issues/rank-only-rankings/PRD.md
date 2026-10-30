# Spec: Rank-only rankings and run-to-run spread

Status: ready-for-agent

**Vocabulary.** The terms in [`CONTEXT.md`](../../CONTEXT.md) govern this
spec: **Option**, **Option code**, **Pick**, **decided**, **Score**,
**Prepared note**, its **brief** and **Prepared ranking**, and **AI
rationale**. "The local model" is whatever serves `LOCAL_AI_*`. A server
is named only beside a measurement taken on it.

**Background.** The backtest is
[`.issues/ai-ranking-backtest`](../ai-ranking-backtest/PRD.md), and its
run files are described in
[`scripts/backtest-runs/README.md`](../../scripts/backtest-runs/README.md).
The build plan, with files listed per step, is
[`plans/rank-only-rankings.md`](../../plans/rank-only-rankings.md).

---

## Problem Statement

Two backtest runs of the same Prepared note prompt, on the same model and
days, give different rankings.

- **Opus 5.5:** the #1 differs on 4 of 20 days, and the Pick moves by up
  to 20 places on a single day.
- **Qwen 3.8 dense:** the #1 differs on 11 of 20 days, and only about 3
  of the top 5 are shared.

The saved runs have one or two repeats per prompt version. The gap
between them is as large as most differences between versions, so a
prompt change can't be told apart from noise.

Repeating runs is slow and costly:

- **Local model:** a Prepared note takes 4–6 minutes a day, and the
  server is shared.
- **Opus:** about 20 seconds a day, and it is billed.

Most of an Opus answer is the rationales and the brief, which the
backtest doesn't score. Nothing sets the sampling temperature, so some of
the spread may just be sampling and not the model being unsure.

## Solution

**A rank-only backtest ranker.** It sends the Prepared note prompt with
the text parts taken out, so the model returns Option codes in rank order
and nothing else. It shares every other block with the Prepared prompt,
so a change to the evidence wording reaches both.

**New options for the eval run:**
- run a backtest N times over the same days;
- set the sampling temperature;
- turn thinking off, on the local model and on Claude.

**A spread script.** It reads the saved runs of one setup (rank-only or
with-text), measures how far they differ day by day and in aggregate,
and can write one averaged ranking from them, scored like any other run.

The production Prepared note, Tonight, and the input hash of a stored
note are unchanged.

## User Stories

1. As the developer tuning the Prepared prompt, I want to see how much two
   runs of the same prompt differ, so that I can tell whether a prompt
   change moved the ranking or the noise did.
2. As the developer, I want a ranking-only answer, so that a backtest day
   costs a fraction of the time and money and I can afford repeats.
3. As the developer, I want the ranking-only prompt to share every block
   it can with the Prepared prompt, so that a finding about one still
   holds for the other.
4. As the developer, I want to set the temperature and turn thinking off,
   so that I can separate sampling noise from the model being unsure.
5. As the developer, I want to run the same backtest N times with one
   flag and resume it in chunks, so that a long sweep fits under the
   two-hour limit for background runs.
6. As the developer, I want to see which Options hold their place across
   runs and which drift, so that I learn where the ranking is fragile.
7. As the developer, I want an averaged ranking of N runs scored against
   the Picks, so that I can see whether averaging cheap runs beats one
   run.
8. As the developer, I want the existing with-text runs read the same way,
   so that rank-only and with-text spread can be compared.
9. As the Household, I want my stored Prepared notes left current through
   this work, so that nothing rewrites them because a prompt was split
   into parts.

## Implementation Decisions

### The production prompt is pinned

- **Pinned first:** the Prepared system prompt and user message are
  pinned in file snapshots before anything is refactored. A stored note's
  input hash covers both, so one changed byte makes every unfrozen note
  out of date, and the local model then rewrites them.
- **Small differences:** one is allowed only with a stated reason. It
  shows as a snapshot diff in the commit and bumps the prompt version.

### The ranking-only prompt

- **Built from the Prepared prompt's blocks:**
  - the opening;
  - the snapshot description;
  - what the snapshot is evidence of;
  - the recency framing;
  - the ranking paragraph's body (every candidate, exactly once, tick
    each off);
  - the data-not-instructions line.
- **Left out:** the brief, the rationale paragraphs, and the rationale
  rules.
- **Its own output format:** one code per line, best first, nothing else.
- **Its own user message:** the same lean snapshot and candidate
  checklist, without the brief's line.
- **Parsing:** the reply is read like a Prepared reply. A line that isn't
  a code is skipped, a repeated Option keeps its first place, and an
  empty reply or `NONE` is no answer. A ranking that names under 90% of
  the candidates is refused. A `code|text` line is tolerated.
- **Version:** there is no separate counter. The prompt version covers
  both prompts.

### The eval options

- **Output:** `note` (the default) or `rank`.
- **Temperature:** a number, sent only when given.
- **Thinking:** off, or the reasoning effort.
  - **Local model:** off sends the chat-template switch that disables
    thinking, and no effort.
  - **Claude:** off disables thinking. Claude refuses a temperature
    while thinking is on, so the eval refuses that combination up front.
- **No seed** is ever sent: repeats must be free to differ.
- **Repeat N:** runs the whole day list N times, one run after another,
  each into its own numbered run file. Resume skips finished files and
  continues a partial one.
- **What a run file records:** its output, temperature and thinking. The
  default file name is built from output, prompt version, model,
  thinking and temperature.
- **Production:** the local-model client takes the same options, and
  production passes none of them, so the request it sends is unchanged.

### The spread script

- **Arms:** run files are grouped into arms by output, model, thinking,
  temperature and prompt version. An old file without these fields reads
  as a with-text run at the default temperature, with its effort as its
  thinking.
- **Per day, across an arm's runs:**
  - the share of run pairs that agree on the #1;
  - top-3 and top-5 overlap;
  - Kendall rank correlation over the Options both runs ranked;
  - the Pick's median and lowest-to-highest rank;
  - and, for the averaged top 10, each Option's mean rank and range.
- **Per arm:** hit@3/5/10 and the capped mean rank, as a mean with its
  range across the runs, plus the per-day measures averaged.
- **The averaged ranking:**
  - It orders Options by mean rank. An Option missing from a run counts
    at that day's candidate count.
  - A tie goes to the Option ranked above the other in more runs, then
    to name order. Run files don't carry the Score, so name order stands
    in for the Score tie-break the grilling chose.
  - It is written as a run file of its own, scored against the Picks,
    and readable by the existing two-run comparison.
- **Matching:** Options are matched by name, because run files carry no
  ids.

## Testing Decisions

A good test here checks what a run produces: the text of a prompt, the
fields in a request, the rows read from a reply, a number in the spread
report. It never checks how the code is arranged. Every test is a unit
test with no network and no database.

The seams:

- **The prompts (existing seam):** file snapshots of the production
  prompt and message, and assertions that the rank-only prompt contains
  the shared blocks and none of the brief or rationale text.
- **The reply parsers (existing seam):** the rank-only parser beside the
  Prepared parser's cases.
- **The client's request (existing seam, mocked `fetch`):** with no
  options the body equals today's, and each option adds only its own
  field.
- **The backtest args (existing seam):** `--repeat` is parsed and
  checked.
- **The spread script (new seam):** in-memory run records, covering the
  pairwise measures, arm grouping of old and new files, and the averaged
  order and its hits.

Prior art: `lib/prepared-note.test.ts`, `lib/ai-search.test.ts` for row
parsing, and `scripts/backtest.test.ts`.

Verification:

- The gate (type check, lint, unit tests) passes.
- Run on the saved Opus v14 pair, the spread script reproduces the
  measured 16/20 same #1 and the 3.95 top-5 overlap.
- The production prompt snapshots don't change, or each change is named.

## Out of Scope

- AI search.
- Tonight, the sweep, stored notes, and anything that changes the input
  hash.
- A fixed seed.
- A production ranking-only or two-call Prepared note.
- Any change to `CONTEXT.md` or a new ADR: this is eval tooling.
- Choosing N or the first sweep's arms. That is a usage decision, made
  from the probe numbers and approved before the sweep runs.

## Further Notes

**Approved probe calls (2026-10-30).** Six single-day calls, run once the
tooling is in:
- **The arms:** rank-only at low effort, rank-only with thinking off, and
  rank-only with thinking off at temperature 0.
- **The models:** each arm once on the local model (Qwen 3.8 dense) and
  once on Opus 5.5, billed at a few cents.
- **Why temperature 0 goes with thinking off:** Claude requires it, and
  Qwen's own guidance warns against greedy decoding while thinking.

**Not yet approved:**
- Any sweep, on either model. The local model is a shared resource under
  the billed-call rule.
- Running the with-text prompt N times, which is about 8 hours on the
  local model at N=5.

**The production follow-up.** If rank-only is stable, the next question
is whether the Prepared note should become two calls: a rank-only call,
then rationales and brief written for that fixed order. That is a change
to ADR-0011, and it isn't decided here.
