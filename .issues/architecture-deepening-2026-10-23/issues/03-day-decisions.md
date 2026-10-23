# 03 — Day decisions: one module owns Pick and Rejection writes

Status: done
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

- [x] DB test (red first): editing a Log entry onto an (Option, date) with a
      Rejection removes the Rejection
- [x] DB tests (red first): creating, rejecting, and editing a Rejection onto a
      Picked (Option, date) is refused with the message above, and writes
      nothing
- [x] Existing Pick-supersedes-Rejection DB tests pass, driven through the
      module rather than repeated per server action
- [x] The rollback test drives the module directly — no `db.transaction` Proxy
- [x] No server action writes to `dinner_log` or `rejections` directly —
      `app/log/actions.ts` and `app/rejection-actions.ts` only call the module
      (`grep` for `insert(dinnerLog`, `delete(rejections`, etc. under `app/`).
      Exempt and left alone: `scripts/import-prior-data.ts` (one-off import)
      and test fixtures
- [ ] `/browse` on the dev server: the refusal shows inline on the Option
      detail page and the Log screen (if no browser is available, say so in
      Comments)
- [x] `corepack pnpm typecheck`, `lint`, `test`, `test:db`, `build` all green

## Blocked by

- Nothing. Third in the plan's order only to keep the Prepared note work first.

## Comments

- Red first: the `updateLogEntry` gap and the three refusals (`createRejection`,
  `rejectOption`, `updateRejection`) were written as action-level DB tests
  against the old actions and failed on their assertions (`{ ok: true }`
  returned; two Rejections left behind). The refusal-message tests stay in
  `app/rejection-actions.db.test.ts`; the rule tests now live in
  `lib/day-decisions.db.test.ts` and drive the module.
- `lib/day-decisions.ts`: `addPick` (`repeat: "ignore" | "refuse"` for the
  one-tap and typed paths), `editLogEntry`, `removeLogEntry`, `addRejection`,
  `editRejection` (both return `"saved" | "already-picked"`), and
  `removeRejection`. Postgres errors still throw for the actions to translate
  with `pgErrorMessage`.
- Rollback: the `db.transaction` Proxy test is gone, not ported. No reachable
  state makes a write fail *after* its Rejection delete (a duplicate, a stale
  Option id, or a vanished entry each fails on the first statement), so the
  module tests instead check that a refused write (a typed duplicate Pick, an
  edit colliding with another entry, a refused Rejection) leaves both tables as
  they were.
- A stale `editLogEntry` / `editRejection` (the id is gone) stays a silent
  no-op, as before; `editLogEntry` then removes no Rejection.
- `/browse`: not run. Aside isn't available on Linux, and gstack's headless
  fallback has no Chromium installed (`ms-playwright` cache missing); installing
  it is a machine-wide download, so I left it. Dev mode also hit the container's
  inotify limit (ENOSPC). Checked in code instead: the Option detail page
  (`app/catalog/[id]/option-controls.tsx`) and the Log screen's Rejection form
  (`app/log/rejection-row.tsx`) both render `result.error` inline, on the path
  that already shows "Already rejected for that date". A human should confirm
  it on screen: Pick an Option today, then Reject it from its detail page and
  add a Rejection for it today on `/log`.
- Gate: typecheck, lint, test (509), test:db (126), and build all green.
