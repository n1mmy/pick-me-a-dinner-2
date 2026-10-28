# 03 — Prompt v11: the prompt states evidence, the model weighs

Status: needs-triage
Type: AFK

## Parent

[Spec: Backtest the AI ranking, then decide](../PRD.md)

## Why

Two v10 Opus runs (issue 02, comments of 2026-10-28) read the same way: the
wording measures moved a lot (elapsed-time flags 44–51 → 10–15, bb.q out of
the top 5, reasons leading with notes and orders) and the ordering measures
barely moved or went backwards (never-eaten top-5 slots 52 → 45, Aji Ichi
11 → 13 top-5 days, hit@5 16 → 13–14). The model quoted a rule and ranked
against it in the same row ("it sits at half its usual stretch", Mazra #3 on
10-15). The Interval fix for Aji was absorbed by a new frame — "the sushi
staple when Ninja is too soon" — that both v10 runs state outright.

The grill of 2026-10-28 settled the direction (`/grill-with-docs`):

- **General means across Options.** No prompt rule, example, or evaluation
  target is written for a named Option. The app stays one Household's
  instrument (ADR-0002).
- **The AI ranks the whole list** (ADR-0005 and ADR-0011 unchanged); every
  ranked row carries a reason, tail rows in a few words, because output
  tokens are the wait.
- **The prompt says what each kind of data is evidence of and stops.**
  Weighing is the model's (ADR-0005 amended). The thresholds ("in play from
  two-thirds"), "being due is not being wanted", the novelty placement rule,
  the weekday-habit test, and every example drawn from this Household's Log
  are gone. The one statement kept about the Interval is that it is a median
  of the Household's own gaps, so falling short of it is ordinary.
- **Rejections are listed per Tag as well as per Option** in the snapshot,
  same rows, reason included (ADR-0006 amended). A "too recent" under
  `sushi` reaches every sushi Option; the model still judges the reason.
- **The harness is for reading a prompt change.** `backtest-compare` now
  opens with each day's top 10 and brief from both runs, the Pick marked,
  the flags as markers on their rows. The numeric acceptance test in issue
  02 is context, not a target.

## What changed

- `lib/snapshot.ts`: each entry in `tags` carries `rejections` (date, Option
  number, reason; newest first) when any Option carrying the Tag has one.
  Tags are read from the Catalog as it stands, not from the row's copy.
  Backtest mode cuts them to before the anchor day like the block.
- `lib/ai-search.ts`: `SNAPSHOT_EVIDENCE`, `RECENCY_THROUGH_HABITS` and
  `RATIONALE_RULES` replace `TIMING_FACTS_DESCRIPTION`, `CADENCE_RHYTHM`,
  `DAY_OF_WEEK_RHYTHM`, `STANDING_REASONS_AND_TRIGGERS`, `NOVELTY_RULE` and
  `RATIONALE_LEAD`. Pithy mode never asks for an empty reason: a weak pick
  gets three to six words. `AI_SEARCH_PROMPT_VERSION` is "11". The pithy
  system prompt is 1,530 words, from 2,577.
- `lib/prepared-note.ts`: shares the three blocks; keeps its own output
  contract (name column, brief last) and the vocabulary rule, without the
  Household-drawn examples. `PREPARED_PROMPT_VERSION` is "11", so every
  stored note regenerates.
- `scripts/backtest-compare.ts`: the read section, first.
- `CONTEXT.md`: Interval loses its thresholds; Rejection says a too-soon
  reason speaks for the Tags. ADR-0005 and ADR-0006 carry amendment lines.

## Acceptance

Read, not scored: an Opus 5.5 pithy run of v11 on the twenty v9/v10 days,
compared day by day against `ai-search-v10-opus-5-5-pithy` and `-run2`
through the read section. What to look for:

- [ ] A Tag's too-soon Rejection is read against the other Options of its
      kind: no top-5 row whose reason makes one Option the stand-in for
      another the Household just turned down as too recent.
- [ ] No ranked row with an empty reason; the Pick's row always says
      something.
- [ ] No row that quotes a rule it then ranks against — there are no rules
      left to quote.
- [ ] Rarities well past their Interval that the Household did eat
      (10-10, 10-16) are not pushed down by a rule; wherever they land, the
      reason is about the evening or the Option, not a policy.
- [ ] The flags (elapsed, weekday claim on flat counts, timing-only) stay
      at or under v10's.
- [ ] hit@5 not below the Score baseline's 8/20 by less than the noise
      floor — the floor check, not the goal.

The Strata run of v11 follows, compared the same way against `strata-v10`.
Which days and which model for later runs: decided per run.

## Comments
