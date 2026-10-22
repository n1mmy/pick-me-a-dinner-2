# 06 — Decided-day comparison

Status: ready-for-agent
Type: AFK

## Parent

[Spec: Prepared notes](../PRD.md)

## What to build

On a date with Log entries, the brief block shows where the frozen note ranked
what was actually eaten.

- A small pure helper takes the frozen ranking and the date's Log entries and
  returns one line per entry: "The note ranked {name} #{n}" from the entry's
  1-based position in the ranking, or "The note didn't rank {name}".
- `app/prepared-brief.tsx` renders those lines on a decided date, styled per
  `DESIGN.md` (issue 04). Out of date is never shown on a decided date.

## Acceptance criteria

- [ ] Helper unit tests: ranked at #1, ranked mid-list, not ranked, multiple
      Log entries in one date, empty ranking
- [ ] Screen test for decided mode: comparison lines render, no out-of-date
      marker
- [ ] On the dev server with the loop forced on: Pick, and the note stops
      regenerating on the next tick; remove the Pick, and it regenerates (if
      the worker can't run this, say so in Comments for a human check)
- [ ] `corepack pnpm typecheck`, `lint`, `test`, `build` all green

## Blocked by

- Issue 05

## Comments
