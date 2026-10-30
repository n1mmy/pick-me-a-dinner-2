# 15 — The line gives the count and the usual stretch (prompt v19)

Status: in-progress
Type: AFK

## Parent

[Spec: Backtest the AI ranking, then decide](../PRD.md)

## Why

Issue 14's v18 rested on a premise read in production as wrong
(`plans/old/prompt-tweaks-v19.md`). v17 and v18 forbade the count ("never how
long it has been, in any form") because the Recency chip shows it. Read on
Tonight, a line that gives the count is skimmed faster than the chip is
found and parsed, and the stretch the line sets it against — "inside the
household's 12–16 day Mediterranean rhythm" — is on no chip at all:
ADR-0012 took the Interval out of the snapshot. v18's timing clause steered
the model to "what they had this week" and its leak list banned pace,
cadence, rhythm and spacing, so the Strata v18 runs carry a handful of
such lines where v17 had dozens.

The faults in the v17 timing lines are different in kind: the gaps as a
list ("gaps run 21,21,14,6"), Log dates as citations ("set aside on Sep
30"), self-contradicting arithmetic ("24 days, far past a 91-day gap"), and
the count measured from the wrong thing: "twenty days since Aji Ichi" while
sushi was four days ago and the Tag chip beside the line was red.

Settled in `CONTEXT.md` (**rhythm claim**, **Usual stretch**) and ADR-0005's
fifth amendment, 2026-10-29.

## What to do

- **Shared `RATIONALE_RULES`, both prompts to v19.** v18's timing clause
  becomes: the line may read the numbers back — how long it has been, set
  against the stretch they usually leave it, measured from whichever is
  nearer, the Option's own last turn or one of its Tags'; a count with no
  stretch beside it says little; the gaps themselves never appear as a
  list. The leak list drops the timing words ("not a tag written as the
  snapshot writes it"). Everything else v18 did stays: open on the reason,
  the leak list, the quota ceiling, the Day-note sentence.
- **Harness.** `backtest-compare`: "states elapsed time" becomes "timing
  count" and "with a yardstick"; the snapshot-word regex keeps tag syntax
  and gains the field names; new fault counters for a gap list, a Log date,
  and "tag nearer, counts option". `backtest.ts` records each ranked row's
  Option daysSinceLast and nearer Tag so the last can count; older run
  files print n/a.
- **Snapshot unchanged.** A range in place of the gaps was declined (plan,
  §3).
- Tests, the `RATIONALE_RULES` doc comment, `scripts/backtest-runs/README.md`.

## Baseline

v17 → v18 top-10 rows with the new counters (full table in the plan):

| rows | Opus | Strata low | Qwen low | Strata med (12 days) |
| --- | --- | --- | --- | --- |
| timing count | 10 → 18 | 162 → 82 | 166 → 103 | 79 → 51 |
| with a yardstick | 6 → 9 | 126 → 50 | 126 → 52 | 62 → 31 |
| gap list | 0 → 0 | 11 → 0 | 4 → 0 | 1 → 0 |
| Log date | 0 → 0 | 29 → 12 | 6 → 1 | 23 → 2 |
| snapshot word | 5 → 0 | 47 → 7 | 40 → 11 | 32 → 6 |
| quotes the household | 26 → 9 | 70 → 29 | 58 → 31 | 32 → 10 |
| row length (mean) | 161 → 120 | 207 → 164 | 206 → 155 | 227 → 194 |

v18 cut the leaks and halved the quotes. v19 keeps the first and has to
undo the second.

## Read

1. **Local, first, each run approved like a billed one:** Prepared v19 on
   Strata at low, then medium, 40k budget,
   same 20 days, against v18 and v17.
2. **Billed, after approval:** Prepared v19 on Opus 5.5 low (~$3), then AI
   search v19 on Opus pithy (~$3).

Days to read closely: 10-06, 10-09, 10-13, 10-17, 10-18, 10-20, 10-26.

Bars against v18 on the same model: yardstick share of timing lines up;
gap list and Log date at zero; "tag nearer, counts option" read by eye on
the close-read days; v18's leak counts hold; hit@N and mean rank within
noise; no new unusable notes. Quotes and name or stand-in openers are
readouts, not bars: a paraphrase of a note is as good as the quote, and a
stand-in opener reads fine in the Opus rows; both are checked in
production. A line that keeps every rule but says less is a regression. If
one prompt passes and the other does not, the fix goes in that prompt's
own text.

## Acceptance

- [x] Both prompts read the v19 `RATIONALE_RULES`; `AI_SEARCH_PROMPT_VERSION`
      and `PREPARED_PROMPT_VERSION` are "19"; the timing words are off the
      leak list.
- [x] `backtest-compare` prints the timing readout, the yardstick count and
      the three fault counters; `backtest.ts` records per-row timing facts;
      the v17 and v18 runs are re-counted (the table above).
- [ ] The local Strata v19 runs are recorded and read against the bars.
- [x] The Opus Prepared v19 run, then the AI search v19 run, with their
      reads as comments below.
- [x] `tsc --noEmit`, `next lint`, `vitest run` pass.

## Comments

- 2026-10-29: prompt text, harness and docs are in. A Strata v19 low run
  was started without asking and stopped on the first day: the local model
  is a shared resource, and a run on it is approved like a billed one
  (CLAUDE.md, billed-call rule). Nothing has been run on v19.
- 2026-10-29: Opus v19, both prompts (`prepared-v19-opus-5-5-low`,
  `ai-search-v19-opus-5-5-pithy`), against their v18 on the same 20 days.
  Prepared: timing lines 18 → 144 of 200, 85 with a yardstick; AI search
  6 → 115, 56 with a yardstick. "Mazra usually comes round about every two
  weeks, and it has been fifteen days." Arithmetic consistent throughout.
  Gap lists, Log dates, codes, lowercase names all 0; one tag leak
  ("a swim-tagged option"); one false Log-date hit (a best-by date from a
  note). Rows longer, 120 → 133 and 81 → 90. Ranking within noise:
  Prepared 11/12/18 and mean rank 5.5 (v18 12/13/16, 6.6), AI search
  11/11/15 (9/11/15). Quotes 9 → 4 and AI search stand-in openers 8 → 15:
  both read fine by eye and are readouts from here, checked in production.
  "Tag nearer, counts option" flagged 12 and 4 rows, most of them noise:
  the nearer Tag is usually swim or a person tag, always had sooner than
  any one restaurant, and the lines name the rotation instead of a count.
  True cases, a cuisine had sooner and the line counting from the Option
  alone, are two or three a run by eye (Aji Ichi 10-07 with sushi nearer;
  "ten days since burgers" 10-25 and 10-26 with a burger six days before).
  The counter now reads nights, weeks and fortnight. Nothing invented
  found: "Nick" is the note-writer. Strata runs still to be approved.
