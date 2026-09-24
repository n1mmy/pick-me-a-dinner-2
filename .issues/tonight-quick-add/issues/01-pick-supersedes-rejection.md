# 01 — A Pick supersedes that date's Rejection

Status: ready-for-agent
Type: AFK

## Parent

[PRD: Add an Option from Tonight](../PRD.md)

## What to build

The domain rule from `CONTEXT.md` (**Pick**, **Rejection**): picking an Option
on a date it carries a Rejection removes that Rejection.

Both `dinner_log` insert paths get it — `pickTonight` and `logForDate` in
`app/log/actions.ts`. In each, insert the Log entry and delete any `rejections`
row for the same `(option_id, date)` in **one transaction**, so a failure never
leaves the Rejection deleted without the Pick (or the reverse). The
`rejections_option_rejected_on_unique` constraint means there is at most one
row to delete.

`pickTonight`'s `onConflictDoNothing` stays: an already-logged Option re-Picked
still clears a lingering same-date Rejection. `logForDate`'s duplicate error
stays as it is; on that error nothing is deleted.

Revalidate whatever `deleteRejection` revalidates as well as the dinner views,
so the Rejected disclosure and the Log's Rejection rows update.

## Acceptance criteria

- [ ] `pickTonight` on a date with a Rejection of that Option creates the Log
      entry and deletes the Rejection
- [ ] `logForDate` does the same for past, present, and future dates
- [ ] A Rejection of the same Option on a *different* date is untouched
- [ ] A Rejection of a *different* Option on the same date is untouched
- [ ] If the Log insert fails, the Rejection survives (transactional)
- [ ] DB tests in `app/log/actions.db.test.ts` cover the above
- [ ] On Tonight, Picking a Rejected Option from the Option detail page drops it
      from the Rejected disclosure
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green
