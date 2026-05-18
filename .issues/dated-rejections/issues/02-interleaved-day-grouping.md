# 02 — Pure module: interleaved day-grouping of the Log

Status: done
Type: AFK

## Parent

[PRD: Dated Rejections on the Log](../PRD.md)

## What to build

Rework `lib/dinner-grouping.ts` — the pure module the Log screen and the Option
detail page both depend on for grouping — so it groups **Log entries** *and*
**Rejections** by date together.

Given a newest-first **Log**, the Rejection list, and today's date, the module
produces per-date records — each carrying that date's Log entries and that
date's Rejections — split into Upcoming (`date > today`) and History
(`date <= today`), Upcoming soonest-first and History newest-first. A date with
only Rejections (no **Dinner**) still forms a record. The existing Dinner
grouping and the "Today / Tomorrow / Yesterday / Fri, May 16" date label
behavior are preserved.

The module stays pure — no React, no DB — and gets full unit coverage with
hand-built fixtures (prior art: the existing `lib/dinner-grouping.test.ts`).

This slice is the module and its tests only. The Log screen rendering that
consumes it is issue 05.

## Acceptance criteria

- [x] Log entries and Rejections sharing a date are grouped into one per-date
      record
- [x] A date with only Rejections produces its own record
- [x] The Upcoming / History split is exact at the today boundary
- [x] Upcoming is soonest-first; History is newest-first
- [x] The existing date-label behavior is unchanged
- [x] Full unit tests cover the above, modelled on `lib/dinner-grouping.test.ts`
- [x] The module is pure — no React or DB import
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green, and
      `pnpm build` passes with no env vars set

## Blocked by

- None — can start immediately
