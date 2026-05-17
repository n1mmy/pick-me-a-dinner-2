# 02 — Option detail page: Log history section

Status: ready-for-agent
Type: AFK

## Parent

[PRD: Option detail page](../PRD.md)

## What to build

The **Log** history section of the **Option detail page**: the full eating
history of one **Option** in one place.

The section lists every realized **Log entry** for the Option (`eaten_on` today
or earlier) newest first, each showing its date and any note. The Option's
**Planned dinners** (Log entries dated after today) appear in their own group
*above* the realized history, so a plan is never buried. An Option with no Log
entries shows a quiet empty state. Each Log entry is editable and deletable
inline from the section, the same way the Log screen already allows.

This slice extracts two pieces of working code so the detail page reuses them
rather than duplicating:

- The realized-vs-Planned split, the group-by-date into **Dinners**, and the
  "Today / Tomorrow / Yesterday / Fri, May 16" date label — currently private
  inside the Log screen — move into a pure `lib/dinner-grouping.ts` module with
  no React or DB dependency. The Log screen is refactored onto it with its
  rendered behavior unchanged.
- The Log entry row and its inline edit form — currently private in the Log
  screen — are extracted into a shared component used by both the Log screen
  and the detail page's History section.

## Acceptance criteria

- [ ] `lib/dinner-grouping.ts` is a pure module providing the realized/Planned split, the group-by-date, and the date label
- [ ] `lib/dinner-grouping.test.ts` covers the exact today-boundary split, same-date grouping order, and the date labels
- [ ] The Log screen consumes `lib/dinner-grouping.ts`; its rendered behavior is unchanged
- [ ] The Log entry row and inline edit form are extracted into a shared component used by both the Log screen and the detail page
- [ ] The detail page History section lists the Option's realized Log entries newest first, each with date and note
- [ ] Planned dinners appear in a separate group above the realized history
- [ ] An Option with no Log entries shows a quiet empty state
- [ ] Log entries can be edited and deleted inline from the History section
- [ ] The full gate passes — `pnpm typecheck`, `lint`, `test`, `build`

## Blocked by

- [01 — Option detail page: core](./01-detail-page-core.md)
