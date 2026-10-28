# 04 — One meaning of "decided": a flag on the Selected-day view

Status: ready-for-agent
Type: AFK

## Parent

[Prepared notes: pre-landing review](../../../plans/prepared-notes-review.md)
— finding I8, the remaining layer;
[Code review 2026-10-23](../../../plans/code-review-2026-10-23.md) — Spec
(c)5 and Architecture deepening (a)3.

## What to build

`CONTEXT.md` **Day decision** and the architecture plan's decision 1 say a
date is decided when it has any Log entry, Archived Options included. The
sweep and `preparedNoteFor` agree (`getDecidedDates`, `db/queries.ts:293`).
The screen does not:

- `app/tonight-screen.tsx:160` sets `decided = tonightsDinner.length > 0`.
- `app/prepared-brief.tsx:34` sets `decided = eaten.length > 0`.

Both read the rendered dinner, and `lib/tonights-dinner.ts:63` drops
Archived Options from it. On a date whose only Pick is of a since-Archived
Option, the note is correctly frozen but Tonight renders picker mode with
the brief open, no comparison line, and no decided block.

Carry one `decided: boolean` on `SelectedDayView` (`lib/tonight-day.ts:123`),
computed in `tonightForDay` from the day's `dayEntries` before any
Archived filter. `TonightScreen` and `PreparedBrief` read that flag; the
brief's `eaten` prop stays for the comparison lines, which can be empty on a
decided date whose Picks are all Archived — then the brief still starts
collapsed and the block shows the label only.

What the decided block itself shows for an Archived Pick is out of scope: it
has no row to render, and `CONTEXT.md` does not say. Note the gap in
Comments if it bites.

## Acceptance criteria

- [ ] `lib/tonight-day.test.ts`: `decided` is true for a day whose only Log
      entry is of an Archived Option, false for a day with none
- [ ] `app/tonight-screen.test.tsx`: on such a day the screen is in decided
      mode and the brief starts collapsed behind "Read the note"
- [ ] No remaining `length > 0` test of the rendered dinner decides the
      mode or the brief; `grep -n "decided =" app/` finds only the view read
- [ ] `corepack pnpm typecheck`, `lint`, `test`, `build` all green

## Blocked by

- Nothing. Fourth in the review's suggested order.
