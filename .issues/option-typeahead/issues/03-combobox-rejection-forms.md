# 03 — Type-ahead Option picker on the Rejection forms

Status: done
Type: AFK

## Parent

[PRD: Type-ahead Option picker on the Log](../PRD.md)

## What to build

Use the `OptionCombobox` component (built in issue 01) in place of the native
`<select>` in the Log's rejection forms, completing the rollout — all of the
Log's Option pickers then share one type-ahead control.

The add-a-rejection form and the edit-a-rejection form **share a single form
component** (and one Option `<select>`), so replacing the picker there covers
both:

- Adding a **Rejection** — the picker opens with no Option selected and blocks
  submit with an inline "Pick an Option" error, alongside the existing date
  check.
- Editing a Rejection — the picker opens pre-filled with the Rejection's
  current Option.

The Log surfaces only Rejections of Active Options, so the edit case has no
Archived-Option subtlety. The existing date field, optional reason field, and
inline edit/delete behavior are unchanged.

## Acceptance criteria

- [x] The shared rejection form uses `OptionCombobox` in place of the
      `<select>`, covering both adding and editing a Rejection
- [x] Adding a Rejection opens with no Option selected and blocks submit with
      an inline "Pick an Option" error
- [x] Editing a Rejection opens the picker pre-filled with the Rejection's
      current Option
- [x] The existing date field, optional reason field, and inline edit/delete
      behavior are unchanged
- [x] All of the Log's Option pickers — add-a-dinner, edit-a-dinner, and the
      rejection add/edit form — now use the shared `OptionCombobox`
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green, and
      `pnpm build` passes with no env vars set

## Blocked by

- [01 — Type-ahead Option picker on the Add-a-dinner form](./01-combobox-add-dinner.md)
