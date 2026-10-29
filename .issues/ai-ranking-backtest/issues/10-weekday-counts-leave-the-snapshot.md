# 10 — Weekday counts leave the snapshot (prompt v15)

Status: done
Type: AFK

## Parent

[Spec: Backtest the AI ranking, then decide](../PRD.md) ·
[Plan: simplifications](../../../plans/old/simplifications-2026-10-29.md), step 5

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

- [x] No `weekdays` in `lib/`.
- [x] ADR-0012 states the current facts: `eaten`, `daysSinceLast`,
      `recentGaps`, per Option and per Tag.
- [x] The Opus run is recorded as `ai-search-v15-opus-5-5-pithy.{json,log}`
      and its read is a comment below.
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test` pass.

## Comments

- Done. `weekdays` is gone as a snapshot field; the word survives in `lib/` only in the `closedDays` prompt bullet ("the weekdays it is shut"). Both prompt versions are `"15"`. `CONTEXT.md` needed no edit: **Prepared note**'s "weekday habits" reads as what the brief may say, and **AI rationale** already says "a weekday habit the Log bears out".
- **The v15 read** (Opus 5.5, default effort, the v13 20 days; 20 billed calls; `ai-search-v15-opus-5-5-pithy.{json,log}`, compared against v13 with `backtest-compare`):
  - **Numbers, within the noise:** hit@3 10 → 12, hit@5 12 → 12, hit@10 16 → 17, mean rank 7.2 → 6.0, median 2 → 3. Too-soon misses 2 → 2; top-5 slots on never-eaten Options 50 → 51; same #1 on 18 of 20 days. The v12 → v13 swing on hit@3 was 13 → 10, so none of this is a signal.
  - **Swim Tuesdays hold:** 10-06 Taqueria #3 (v13 #2), 10-13 Thai Nakorn #1 (#2), 10-20 Societea #2 (#2). Real habits are still found from the dates: Societea is 9 of 11 eats on Tuesdays, Aji Ichi 8 of 25 on Mondays, Quiche 6 of 14 on Sundays, and v15 names each.
  - **Thin-count weekday claims change kind, not count.** Mechanical test, same for both runs: top-10 rows naming the evening's own weekday, for an Option eaten on that weekday ≤ 2 times before the day (counted from the Log). v13: 35 of 65; v15: 35 of 59. In v13 most were the counts read aloud: "both visits fell on a Monday", "Monday-only history", "eaten here only on Thursdays", "one of their two meals of it fell on a Sunday", about 20 habit claims. In v15 those are mostly gone, and two kinds take their place: **"open on <weekday>"** (Tadu Ethiopian, 12 of the 35, from its `closedDays`), and evening-fit ("suits a quiet Monday"). Habit claims on two eats or fewer that remain: Tadu "the one evening it reliably works" / "fits their Monday orders" / "Monday is one of its dinner nights" (Mon 2 of 2, three days); Mazra "a Friday Mazra habit" (Fri 2 of 13); Aji Ichi "a Friday regular" (Fri 2 of 25); Atlas "a frequent Sunday order" (Sun 2 of 16, Fri 5); Pasta "shown up on recent Saturdays" (Sat 2 of 3). That is about seven. Flat counts are still over-read too: Ninja "Wednesday sushi is the household's steadiest habit" at Wed 4 of 17 against Thu 4 and Sat 4.
  - **What to watch:** the cheap true sentence moved from `weekdays` to `closedDays` ("open Thursdays"), mostly on Tadu, which is in the top 5 on 9 days having been eaten twice. That is not a ranking error the numbers show (v13 had it in the top 5 on 8 days), and `closedDays` stays because it explains a thin Log (ADR-0010). If a later read finds it crowding out better reasons, the prompt could say a candidate's being open needs no mention, as the Prepared prompt already does for closures. Not done here.
  - The local-model read of v15 is still queued behind the v13 and v14 runs in the other worktree, as the plan says.
