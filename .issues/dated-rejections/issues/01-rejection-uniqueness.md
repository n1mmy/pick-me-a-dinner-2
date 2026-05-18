# 01 — Schema: a Rejection is unique per Option per date

Status: done
Type: AFK

## Parent

[PRD: Dated Rejections on the Log](../PRD.md)

## What to build

A `UNIQUE(option_id, rejected_on)` constraint on the `rejections` table, with
its Drizzle migration applied out-of-band per the deploy model.

The constraint enforces ADR-0008's decision that the same **Option** cannot be
rejected twice for one date. Once manual entry exists, the old guarantee that
"a rejected Option leaves the picker, so it cannot be re-rejected the same day"
no longer holds — ADR-0006's note that no such constraint was needed is
superseded by ADR-0008.

Adding the constraint is safe against existing data: live rejecting cannot
produce a same-day duplicate, so no `rejections` table — dev or prod — can hold
a conflicting pair when the migration runs.

This slice is the schema only. The server actions that surface the resulting
`23505` collision as an inline error are issue 04.

## Acceptance criteria

- [x] `rejections` carries a `UNIQUE(option_id, rejected_on)` constraint,
      defined in the Drizzle schema
- [x] A new Drizzle migration adds the constraint and applies cleanly against
      the existing dev database
- [x] The startup schema-version check recognizes the new migration
- [x] A second `rejections` row with the same `(option_id, rejected_on)` fails
      at the database
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green, and
      `pnpm build` passes with no env vars set

## Comments

The dev database already carried `rejections_option_rejected_on_unique` and
4 recorded migrations — a prior loop iteration applied migration `0003` before
its worktree was discarded. `pnpm db:migrate` therefore reported the constraint
already exists rather than re-creating it; the migration SQL is correct and the
dev DB is in the intended end state (journal entries 4 = applied migrations 4,
so the startup schema-version check passes). A duplicate `(option_id,
rejected_on)` insert was verified to fail with Postgres `23505`.

## Blocked by

- None — can start immediately
