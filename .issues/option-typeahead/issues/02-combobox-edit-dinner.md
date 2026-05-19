# 02 — Type-ahead Option picker on the Edit-a-dinner form

Status: done
Type: AFK

## Parent

[PRD: Type-ahead Option picker on the Log](../PRD.md)

## What to build

Use the `OptionCombobox` component (built in issue 01) in place of the native
`<select>` in the Log's edit-a-dinner form, so editing a **Log entry**'s
Option is type-ahead like adding one.

The picker opens **pre-filled** with the entry's current Option, so editing
only changes what the Household means to change.

Because `getOptionChoices()` now returns **Active Options only**, a Log entry
logged against a since-**Archived** Option has no matching list row. The
picker still displays that Option as its current value — the displayed name is
seeded from the Log entry itself, not from the choices list — but the Archived
Option is absent from the dropdown. Switching away from it cannot be undone
within the picker; Cancel restores the entry's original Option.

The existing date field, note field, and inline edit/delete behavior are
unchanged.

## Acceptance criteria

- [x] The edit-a-dinner form uses `OptionCombobox` in place of the `<select>`
- [x] The picker opens pre-filled with the entry's current Option
- [x] A Log entry on a since-Archived Option still shows that Option as the
      picker's current value, with its name seeded from the entry
- [x] That Archived Option does not appear in the dropdown list
- [x] Cancel leaves the entry's original Option unchanged
- [x] The existing date field, note field, and inline edit/delete behavior are
      unchanged
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green, and
      `pnpm build` passes with no env vars set

## Blocked by

- [01 — Type-ahead Option picker on the Add-a-dinner form](./01-combobox-add-dinner.md)
