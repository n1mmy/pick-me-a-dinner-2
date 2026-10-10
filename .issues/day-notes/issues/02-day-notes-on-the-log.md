# 02 — Day notes on the Log

Status: ready-for-agent
Type: AFK

## Parent

[Spec: Day notes](../PRD.md)

## What to build

Show and edit Day notes on the Log screen. Depends on 01, which adds the
`day_notes` table, `setDayNote`, and the Day note line component.

- **Query.** A new query in `db/queries.ts` returns every Day note as
  `{ notedOn, note }`.
- **Grouping.** `groupByDay` (`lib/dinner-grouping.ts`) takes Day notes as a
  third input. Each `DayRecord` gains an optional `dayNote`. A date that has
  only a Day note forms its own record. Upcoming vs History placement uses the
  same date rule as Log entries and Rejections. A note-only Upcoming date
  counts toward `UPCOMING_CAP`.
- **Log UI.** In `app/log/log-screen.tsx`'s `DayGroup`, a date's Day note shows
  directly under the date header, above the entry and Rejection rows, using the
  Day note line from 01. It's editable in place and saves through the same
  `setDayNote`. A group without one gains a third borderless control, "+ Add a
  note", beside "Add a dinner" and "Add a rejection".
- **Empty state.** `isEmpty` counts Day notes along with Log entries and
  Rejections.

## Acceptance criteria

- [ ] `groupByDay` tests: a note-only date forms a record; a Day note attaches
      to a date that has entries or Rejections; notes on past, today, and future
      dates land in History or Upcoming correctly
- [ ] The Log query returns all Day notes (DB test)
- [ ] The Log shows a Day note under its date header and edits it in place
- [ ] "+ Add a note" appears only on groups without a Day note
- [ ] A Log holding only Day notes doesn't show "No dinners logged yet"
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green
