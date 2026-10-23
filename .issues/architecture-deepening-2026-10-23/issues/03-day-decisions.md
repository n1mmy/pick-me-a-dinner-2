# 03 — Day decisions: one module owns Pick and Rejection writes

Status: ready-for-agent
Type: AFK

## Parent

[Plan: Architecture deepening (2026-10-23)](../../../plans/architecture-deepening-2026-10-23.md)

## What to build

`CONTEXT.md` (**Day decision**): an Option has a Pick or a Rejection on a date,
never both, and a Pick wins. Today only `pickTonight` and `logForDate` enforce
half of that, and the comment at `app/rejection-actions.ts:13` ("every write
to the `rejections` table lives in this one module") is false.

- **Module.** A new `lib/day-decisions.ts` owns every write to `dinner_log` and
  `rejections`: add a Pick (one tap, or a typed date), edit or delete a Log
  entry, create, edit, or delete a Rejection. Each runs in its own transaction.
- **The rule.**
  - A Pick removes the same Option's Rejection on that date — from
    `pickTonight`, `logForDate`, and `updateLogEntry` moving an entry (its
    date or its Option) onto that pair.
  - A Rejection of an Option already Picked on that date is refused with
    "Already picked for that date — remove the Pick first" — from
    `createRejection`, `rejectOption`, and `updateRejection` moving a Rejection
    onto that date.
- **Thin actions.** The server actions in `app/log/actions.ts` and
  `app/rejection-actions.ts` keep only the session, date parsing, error
  messages, and revalidation.
- **Code only.** No database trigger and no cleanup migration: a read-only check
  of the local prod copy (2026-10-23) found no (Option, date) with both.

Test-first: the `updateLogEntry` gap and each refusal are failing tests before
the module exists.

## Acceptance criteria

- [ ] DB test (red first): editing a Log entry onto an (Option, date) with a
      Rejection removes the Rejection
- [ ] DB tests (red first): creating, rejecting, and editing a Rejection onto a
      Picked (Option, date) is refused with the message above, and writes
      nothing
- [ ] Existing Pick-supersedes-Rejection DB tests pass, driven through the
      module rather than repeated per server action
- [ ] The rollback test drives the module directly — no `db.transaction` Proxy
- [ ] No server action writes to `dinner_log` or `rejections` directly —
      `app/log/actions.ts` and `app/rejection-actions.ts` only call the module
      (`grep` for `insert(dinnerLog`, `delete(rejections`, etc. under `app/`).
      Exempt and left alone: `scripts/import-prior-data.ts` (one-off import)
      and test fixtures
- [ ] `/browse` on the dev server: the refusal shows inline on the Option
      detail page and the Log screen (if no browser is available, say so in
      Comments)
- [ ] `corepack pnpm typecheck`, `lint`, `test`, `test:db`, `build` all green

## Blocked by

- Nothing. Third in the plan's order only to keep the Prepared note work first.

## Comments
