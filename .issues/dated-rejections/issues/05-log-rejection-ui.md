# 05 — Log screen Rejection management UI

Status: ready-for-agent
Type: AFK

## Parent

[PRD: Dated Rejections on the Log](../PRD.md)

## What to build

The **Log** screen UI for dated **Rejections**, end to end. Visual styling is
`DESIGN.md`'s call.

- **Interleaved display.** The Log interleaves Rejections into its date-groups
  (consuming the issue-02 module): each date shows its **Dinner** and that
  date's Rejections; a Rejection-only date renders as its own group; Rejections
  read as visually distinct from Log entries; a Rejection's reason shows on its
  row. Future-dated Rejections (**Planned rejections**) appear in the "Upcoming"
  strip alongside Planned dinners.
- **Two add controls.** Separate "Add a dinner" (the existing form) and "Add a
  rejection" controls at the top of the Log. The rejection form takes an Option,
  a date (past, today, or future), and an optional reason, with a Cancel.
- **Inline-editable rejection row.** A rejection row component with inline edit
  and delete, mirroring `EntryRow` / `EntryEditForm`: Edit expands the row into
  a form (Option, date, reason); Delete uses the §17 inline-confirm. Built here
  for reuse by issue 06.
- **Per-date-group add controls.** Each date-group offers adding a Dinner or a
  Rejection into that date, with the date pre-filled to the group's date.
- **Suppression falls out of the date rule.** A Rejection added or edited to
  today's date drops its Option off Tonight via the issue-04 actions'
  revalidation — no new suppression code.
- A duplicate Rejection (add or edit) shows the inline "Already rejected for
  that date" error; a failed write is reported inline, never as a false
  success.

## Acceptance criteria

- [ ] The Log interleaves Rejections into reverse-chronological date-groups; a
      Rejection-only date forms its own group
- [ ] Future-dated Rejections appear in the "Upcoming" strip
- [ ] Rejections are visually distinct from Log entries and show their reason
- [ ] Separate "Add a dinner" and "Add a rejection" controls; the rejection
      form takes Option, any date, and an optional reason, with a Cancel
- [ ] Each date-group offers add-Dinner and add-Rejection with the date
      pre-filled
- [ ] Every Rejection is inline-editable (Option, date, reason) and deletable
      with an inline-confirm, regardless of age
- [ ] A duplicate Rejection on add or edit shows the inline error
- [ ] A Rejection added/edited to today drops its Option off Tonight; a
      past-dated one leaves Tonight unchanged
- [ ] A failed write is reported inline, not shown as success
- [ ] Add, edit, delete, and confirm controls are keyboard-operable with
      visible focus and adequate touch targets; action results are announced to
      assistive tech
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green, and
      `pnpm build` passes with no env vars set

## Blocked by

- [02 — Pure module: interleaved day-grouping of the Log](./02-interleaved-day-grouping.md)
- [04 — Rejection server actions + Log Rejections query](./04-rejection-actions.md)
