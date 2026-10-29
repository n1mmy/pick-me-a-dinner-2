# 10 — Weekday counts leave the snapshot (prompt v15)

Status: ready-for-agent
Type: AFK

## Parent

[Spec: Backtest the AI ranking, then decide](../PRD.md) ·
[Plan: simplifications](../../../plans/simplifications-2026-10-29.md), step 5

## Why

The `weekdays` counts are the Interval story one field over. They give every
row a cheap true sentence; the model reads habits into flat counts (issue 02,
finding 7: "Mazra called a Wednesday, Thursday, Friday and Saturday regular
on four different days"); a strict weekday test was added in v10 and removed
in v11, and the claim rate rose again on the 40-day run (issue 03: 4.4 a day,
"Chili's #8 because their one visit fell on a Sunday"). Every Log date
already carries its weekday, so a real habit (Societea on ten of twelve
Tuesdays) is still findable. The move that worked for the Interval — delete
the summary, leave the dated history — is the same move here.

## What to do

See the plan, step 5: the field and `weekdayCountsOf` out of
`lib/snapshot.ts`; the `weekdays` sentence out of `SNAPSHOT_EVIDENCE`;
"the counts bear out" becomes "the Log bears out" in `RATIONALE_RULES`;
the field name out of the Prepared vocabulary list; both prompt versions
`"15"`; the snapshot tests; ADR-0012's fourth amendment line and in-place
rewrite.

## Read (billed)

One Opus 5.5 AI-search run of v15 on the original 20 days, compared against
`ai-search-v13-opus-5-5-pithy.json` through `backtest-compare`. Twenty billed
calls, about three dollars. Approved in the grilling of 2026-10-29; state the
count before running, per `CLAUDE.md`. Read for: weekday claims on counts of
one or two gone from the top 10; the swim Tuesdays still top-5 hits; hit@N
within v13's noise floor. The local-model read queues behind the v13 and v14
runs in the other worktree and is not a gate here.

## Acceptance

- [ ] No `weekdays` in `lib/`.
- [ ] ADR-0012 states the current facts: `eaten`, `daysSinceLast`,
      `recentGaps`, per Option and per Tag.
- [ ] The Opus run is recorded as `ai-search-v15-opus-5-5-pithy.{json,log}`
      and its read is a comment below.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` pass.
