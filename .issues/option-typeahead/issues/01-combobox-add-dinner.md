# 01 — Type-ahead Option picker on the Add-a-dinner form

Status: done
Type: AFK

## Parent

[PRD: Type-ahead Option picker on the Log](../PRD.md)

## What to build

Build the shared `OptionCombobox` component and use it to replace the native
`<select>` Option picker in the Log's add-a-dinner form — delivering type-ahead
Option selection end-to-end.

`OptionCombobox` is a hand-rolled, accessible combobox with no third-party
library, following the pattern the app already uses for the Catalog Tag input.
Opening it shows every **Active Option**; typing narrows the list by
case-insensitive substring match; the list is flat and alphabetical, and each
row indicates the Option's kind (**Home meal** or **Restaurant**), reusing the
Tonight rows' kind treatment rather than inventing a new one. It supports ↑/↓
to move a highlight, Enter to select the highlight, Escape to close, and
click/tap to select a row. After a pick the input shows the Option's name;
re-focusing re-opens the list for another search; a clear ("×") control resets
the pick; blurring with text that matches no Option reconciles the field back
to the last valid pick. A "No matches" row shows when nothing matches — there
is no Option-creation affordance.

`getOptionChoices()` is changed to return **Active Options only**, so Archived
Options never appear in the picker. The dinner edit form (issue 02) will rely
on seeding its display name from the Log entry, so dropping Archived rows from
this query is safe.

The add-a-dinner form opens with no Option selected (a search placeholder) and
blocks submit with an inline "Pick an Option" error, alongside the existing
date check.

`OptionCombobox` gets a React Testing Library test suite (prior art:
`app/tonight-screen.test.tsx`).

## Acceptance criteria

- [x] `OptionCombobox` opens showing every Active Option, flat and
      alphabetical, each row indicating Home meal / Restaurant kind
- [x] Typing filters the list by case-insensitive substring match
- [x] ↑/↓ moves the highlight, Enter selects it, Escape closes the list, and
      clicking/tapping a row selects that Option
- [x] After a pick the input shows the Option name; the "×" control clears the
      pick; re-focusing re-opens the list
- [x] Blurring with text that matches no Option reconciles the field to the
      last valid pick
- [x] A "No matches" row renders when nothing matches; there is no create
      affordance
- [x] The picker is an accessible combobox — combobox/listbox/option roles,
      `aria-activedescendant`, visible focus
- [x] `getOptionChoices()` returns Active Options only; Archived Options never
      appear in the picker
- [x] The add-a-dinner form opens with no Option selected and blocks submit
      with an inline "Pick an Option" error
- [x] RTL tests cover `OptionCombobox` behavior — open, filter, keyboard,
      click, clear, blur-reconcile, no-match, archived-excluded — modelled on
      `app/tonight-screen.test.tsx`
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green, and
      `pnpm build` passes with no env vars set

## Blocked by

- None — can start immediately
