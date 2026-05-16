# 05 — Pick = log and the Log screen

Status: ready-for-agent
Type: AFK

## Parent

[PRD: Pick Me a Dinner — v1](../PRD.md)

## What to build

The write path that makes the ranking mean something, plus the Log screen.

Add the **"Pick tonight"** action to each Tonight row — a one-tap server action
that inserts a `dinner_log` row with `eaten_on = today`. It upserts on
`(option_id, eaten_on)`, so a double-tap is a harmless no-op. The picked row
briefly marks "Logged ✓" in `--success`, then the list re-sorts. Picking a
second Option the same evening adds a second Log entry — a multi-Option Dinner.
Each Tonight row also offers a secondary **"Log another date"** path: a date
picker (defaulting to today) that allows a past date (backfill) or a future date
(a Planned dinner).

Build the **Log screen**: a compact, capped **"Upcoming"** strip on top
(future-dated entries, soonest first) so Planned dinners never bury today; below
it, reverse-chronological past history grouped by date — a date with more than
one entry renders as one Dinner with multiple entries. Every entry is editable
and deletable **inline**: the row expands in place into a form to change the
Option, change the date (`eaten_on`, including moving an entry between past
history and Upcoming), edit the note, or delete the entry.

An edit that would collide with an existing `(option_id, eaten_on)` is rejected
with an inline error under the date field, input preserved — never silently
merged. Deletes use the §17 inline-confirm pattern.

Cover the §17 states for Log (loading placeholder rows; empty → "No dinners
logged yet — pick one on Tonight →"; date-conflict inline error; edited row
collapses with a quiet "Saved").

## Acceptance criteria

- [ ] "Pick tonight" logs a `dinner_log` row for today in one tap; the row marks
      "Logged ✓" and the list re-sorts
- [ ] A double-tap on "Pick tonight" is a no-op (upsert on `(option_id,
      eaten_on)`)
- [ ] "Log another date" allows a past date (backfill) and a future date (a
      Planned dinner); future entries are excluded from the Tonight ranking
- [ ] The Log screen shows a capped Upcoming strip above reverse-chronological
      history grouped by date; multi-entry dates render as one Dinner
- [ ] Any Log entry can be edited inline (Option, date, note) or deleted; an
      edit violating `UNIQUE(option_id, eaten_on)` shows an inline error with
      input preserved
- [ ] Delete uses the inline-confirm pattern; Log §17 states are covered
- [ ] Server-action tests: pick inserts for today; double-tap no-op;
      log-for-another-date past + future; edit Option/date/note; delete; the
      UNIQUE-conflict rejection

## Blocked by

- Issue 04 — Tonight: ranked list
