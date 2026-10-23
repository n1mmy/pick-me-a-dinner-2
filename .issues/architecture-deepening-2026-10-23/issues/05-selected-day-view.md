# 05 — Selected-day view: Tonight takes one value

Status: ready-for-agent
Type: AFK

## Parent

[Plan: Architecture deepening (2026-10-23)](../../../plans/architecture-deepening-2026-10-23.md)

## What to build

`tonightForDay` is deep, but its output is taken apart in `app/page.tsx` and
rebuilt inside `app/tonight-screen.tsx`: suppressions go from a `Map` to arrays
to 13 props to `SuppressedRows`, and `pickerView` re-derives each row's tag from
which array it came from. The Selected day is re-derived in the client too.

- **The view.** `tonightForDay` returns one Selected-day view:
  - whether it is today, the day label and heading, and the date writes go to
    (`undefined` for today);
  - Tonight's dinner;
  - the rows, each suppressed one already tagged picked / rejected / closed,
    with the Rejection's id and reason on a rejected row;
  - the Last notes.
- **The screen.** `app/page.tsx` hands the view to `TonightScreen`, whose props
  drop from 13 to about four: the view, the Prepared note, the quick-add
  sources, whether search is enabled. Remove the `SuppressedRows` re-bundle,
  the parallel `rejectedTonight` / `rejectedRows` props, the six `isToday ?
  undefined : selectedDay` repeats, the three `dayLabel` computations, and the
  `"tonight"` string compare in `app/tonights-dinner-block.tsx:92`. Use issue
  04's ranking function for the Prepared and AI search orders.
- **Out of scope.** Don't split `app/tonight-screen.tsx` into files or rework
  `Picker`'s other props.
- **Tests.** Convert `app/tonight-screen.test.tsx` to build its input with
  `tonightForDay` from Options, Log entries, and Rejections. Delete, don't
  port, tests of prop combinations production can't produce (e.g.
  `rejectedRows` with no matching `rejectedTonight`).

Read `DESIGN.md` first; nothing visual should change.

## Acceptance criteria

- [ ] `lib/tonight-day.test.ts` covers the view: tagged rows, Rejection id and
      reason, day label and write date for today, past, and future
- [ ] `TonightScreen` takes the view instead of the separate Selected-day,
      dinner, row, suppression, and Last note props
- [ ] `app/tonight-screen.test.tsx` builds every input through `tonightForDay`
      (one helper), with no hand-built suppression props
- [ ] `/browse` on the dev server: Tonight on today, a Picked day, a future
      day, and a day with Closed and Rejected Options, each at 1280px and
      375px against `DESIGN.md`, with a seeded Prepared note (moved from
      Prepared notes issue 05; if no browser is available, say so in Comments)
- [ ] `corepack pnpm typecheck`, `lint`, `test`, `build` all green

## Blocked by

- Issue 04 (the ranking function)
- Issue 03 (a Picked Option can no longer also be Rejected, which the view
  relies on)

## Comments
