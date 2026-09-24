# 02 — Tonight's typeahead lists every active Option

Status: done
Type: AFK

## Parent

[PRD: Add an Option from Tonight](../PRD.md)

## What to build

Today `pickerView` (`lib/picker-view.ts:132`) builds the typeahead `choices`
from the picker rows only, so Options Picked, Rejected, or Closed on the
**Selected day** never match. Widen the candidates to every active Option and
say why each suppressed one is off the list.

**Candidates.** Picker rows plus `closedTonight`, `rejectedTonight`, and the
Options in Tonight's dinner, each carrying a `suppression`: none, `"closed"`,
`"rejected"`, or `"picked"` (reuse the `Suppression` type from
`lib/day-suppressions.ts`). An Option both closed and rejected reads as
rejected, matching the disclosures' precedence.

**Row labels.** A muted suffix after the name, day-aware like the disclosures'
headings:

- closed → `· closed Mondays` (the Selected day's weekday name)
- rejected → `· rejected tonight` / `· rejected Friday`
- picked → `· already picked`

**Selecting.**

- Unsuppressed → Picks immediately, as now.
- Picked → not selectable (`aria-disabled`, skipped by ↑/↓).
- Closed or Rejected → does **not** Pick. The dropdown closes and an inline
  confirm (`app/confirm-pair.tsx`) appears under the search box: "Aji Ichi is
  closed Mondays — Pick anyway / Cancel" or "You rejected Aji Ichi tonight —
  Pick anyway / Cancel", with the Option's name linking to its detail page.
  Pick anyway calls the normal Pick; issue 01 clears the Rejection
  server-side, so the client does no Bring back of its own.

The `OptionListbox` markup and `useComboboxKeyboard` contract are shared with
`OptionCombobox` (Log / detail forms). Extend them so the label and the disabled
state are optional and the other callers are unaffected.

## Acceptance criteria

- [ ] Typing the name of a Restaurant closed on the Selected day shows it, with
      the closed note
- [ ] Typing a Rejected Option's name shows it, with the rejected note
- [ ] Typing a Picked Option's name shows a non-selectable `already picked` row
      that ↑/↓ skip
- [ ] Selecting a Closed or Rejected row opens the inline confirm; Cancel leaves
      everything unchanged; Pick anyway Picks it (and for a Rejected one, it
      leaves the Rejected disclosure)
- [ ] Unsuppressed rows still Pick on select, and Enter with nothing highlighted
      still runs AI search
- [ ] Notes are day-aware for a non-today Selected day
- [ ] `OptionCombobox` on the Log and detail pages behaves as before
- [ ] Component tests in `app/tonight-screen.test.tsx` /
      `app/option-combobox.test.tsx` cover the new rows and the confirm
- [ ] Matches `DESIGN.md` (muted text token, inline confirm, focus ring)
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green

## Blocked by

- Issue 01 — Pick anyway on a Rejected row relies on the server clearing the
  Rejection
