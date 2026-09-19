# 02 — Recording Closed days on the Restaurant form

Status: done
Type: AFK

## Parent

[PRD: Closed days](../PRD.md)

## What to build

The Household's way in: a Closed-days control on the Restaurant branch of
`OptionForm`, the server-action plumbing behind it, and a read-only line on the
Option detail page.

**The control.** Seven toggle chips in one row — `S M T W T F S`, Sunday first
to match the `0` = Sunday indexing. This takes `DESIGN.md`'s documented
**"Closed-day toggles (2026-09-19 exception to control height)"**: the chips sit
below the 44px floor because seven 44px targets plus gaps overrun a 375px
viewport, and wrapping to two lines or stacking into seven rows destroys the
week-shape the control is read by. Size them to fill the row's width evenly.

Do not render it on the Home-meal branch at all — a Home meal never has Closed
days.

**Accessibility.** Each toggle needs `aria-pressed` and an accessible name
carrying the **full** day name and what the state means — a bare "S" is useless
to a screen reader and ambiguous between Saturday and Sunday even visually,
which is why the accessible name does the work the label cannot.

**The actions.** `OptionFormValues` gains the field. `createOption` and
`updateOption` normalize what they receive to a deduped, ascending set of
integers in `0`–`6`, dropping anything else — a server action is reachable from
any caller, so the form's shape is not a guarantee. A Home meal writes `[]`
regardless of what the payload says.

**The detail page.** `app/catalog/[id]/page.tsx` shows the Closed days as one
line among the Option's fields ("Closed Sundays and Mondays"). Catalog **list**
rows do not show them — they are tight, and the Catalog list is not where you
ask a question about one Restaurant.

Editing on the detail page needs no extra work:
`app/catalog/[id]/option-controls.tsx:120` already reuses `OptionForm` inline,
so the control appears there as soon as it exists (ADR-0007).

## Acceptance criteria

- [ ] The Restaurant form shows seven Closed-day toggles in a single row,
      Sunday first; the Home-meal form shows none
- [ ] Each toggle carries `aria-pressed` and an accessible name naming the full
      day and its state
- [ ] Every toggle is keyboard-reachable with a visible focus ring
- [ ] The toggle row is **hand-measured at 375px** and fits on one line without
      wrapping or horizontal scroll
- [ ] Closed days round-trip through create and update, verified in
      `app/catalog/actions.db.test.ts`
- [ ] Out-of-range, duplicate, and non-integer values are normalized away rather
      than stored
- [ ] A Home meal stores `[]` even when the payload carries days
- [ ] Editing a Restaurant from the Option detail page shows and saves Closed
      days, updating the page in place
- [ ] The Option detail page renders a Closed-days line; Catalog list rows do
      not
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green

## Blocked by

- Issue 01 (needs the column and `OptionFormValues`' backing field)

## Comments

- Ralph: all gate commands and every other acceptance criterion passed. The
  "hand-measured at 375px" criterion was not verified against an actual
  375px viewport — no browser is available in the Ralph worker or
  orchestrator worktrees. Verified instead by inspecting `ClosedDayToggles`
  (`app/catalog/option-form.tsx`): the row is a plain `flex` container with
  no `flex-wrap`, and each chip is `flex-1` with a single-character label, so
  the seven chips can only ever divide the row's available width evenly —
  there is no fixed pixel width for a 375px viewport to overrun, and nothing
  forces a wrap or a horizontal scrollbar. Recommend an actual hand-held
  check before treating the visual claim as verified in production.
