# 06 — Day decisions: test that a Pick's write is atomic, or record that it isn't

Status: ready-for-agent
Type: AFK

## Parent

[Code review 2026-10-23](../../../plans/code-review-2026-10-23.md) —
Architecture deepening (a)2. Architecture issue 03
(`.issues/architecture-deepening-2026-10-23/issues/03-day-decisions.md`) is
`needs-info` on this criterion.

## What to build

`addPick` and `editLogEntry` (`lib/day-decisions.ts:51`, `:65`) each run an
insert or update and then `deleteRejectionOf` inside one `db.transaction`.
The old Proxy test (`app/log/actions.db.test.ts` at `b74dcea:356-411`) made
the Rejection delete fail **after** the Log insert and checked the insert
was rolled back. Its replacements in `lib/day-decisions.db.test.ts` all fail
on the **first** statement (a duplicate insert, a colliding update, a
refused Rejection), so they still pass with `db.transaction` removed. Issue
03's argument that no reachable state fails after the delete has the order
backwards: the delete is the last statement, and the case that matters is
the delete failing after the insert has landed.

Pick one of the two ways forward and do it:

- **Keep one injection test at module level** (preferred). Make
  `deleteRejectionOf` throw on its first call through a `vi.spyOn` or a
  module mock, call `addPick` for an Option with a Rejection on that date,
  and assert the Log entry was not inserted and the Rejection is still
  there. One test, for `addPick`; `editLogEntry` shares the helper and the
  shape.
- **Or record that atomicity is no longer tested**: a Comment on
  architecture issue 03 saying so and why, and the criterion rewritten to
  match. Only if the injection genuinely can't be done without a Proxy over
  `db`.

Either way, architecture issue 03 leaves `needs-info`.

## Acceptance criteria

- [ ] `lib/day-decisions.db.test.ts` has a test that fails when
      `db.transaction` is removed from `addPick`, **or** issue 03 records
      that atomicity is untested and its rollback criterion says so
- [ ] Architecture issue 03's `Status:` moved off `needs-info`
- [ ] `corepack pnpm typecheck`, `lint`, `test`, `test:db`, `build` all
      green

## Blocked by

- Nothing.
