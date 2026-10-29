# 11 — Two sweep fixes: past midnight, and a date with no candidates

Status: ready-for-agent
Type: AFK

## Parent

[Spec: Backtest the AI ranking, then decide](../PRD.md) ·
[Plan: simplifications](../../../plans/simplifications-2026-10-29.md), step 6 ·
review item 3 in `plans/code-review-2026-10-28.md`

## Why

Two of the review's four sweep edge cases are a few lines each. The other two
— a date that fails every pass is retried every ten minutes, and a deploy
holds the in-flight date's claim for forty-five minutes — are accepted: a
skip counter and a SIGTERM handler are the machinery `CLAUDE.md`'s scope rule
warns against.

## What to do

`lib/prepared-notes.ts`:

- **Past midnight.** `runSweep` reads the eligible dates once and a pass can
  run for hours. At the top of each iteration, skip `day` if it is before
  `todaySqlDate(new Date(), timeZone)` — a fresh clock, not the sweep's
  `now` — so a generation that finishes after midnight never writes onto a
  date Tonight now treats as frozen.
- **No candidates.** `preparedNoteFor` reports a date with no candidates as
  `frozen`, mirroring the sweep's skip, instead of hashing an empty snapshot
  and reporting `out-of-date` forever.

Tests in `lib/prepared-notes.db.test.ts`.

## Acceptance

- [ ] Both tests pass under `pnpm test:db`, or the run is reported as not
      possible.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` pass.
