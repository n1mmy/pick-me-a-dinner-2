# 04 — Rejection server actions + Log Rejections query

Status: ready-for-agent
Type: AFK

## Parent

[PRD: Dated Rejections on the Log](../PRD.md)

## What to build

The server layer for managing dated **Rejections** — actions and a query, no
UI (the UI is issues 05 and 06).

Three `authedAction`-wrapped server actions — thin DB writes, consistent with
`logForDate` / `updateLogEntry` / `deleteLogEntry`:

- **Create a dated Rejection** `(optionId, rejectedOn, reason)` — insert a
  `rejections` row; an empty or whitespace-only reason is stored as `null`; an
  invalid date is rejected; a `(option_id, rejected_on)` collision (`23505`) is
  returned as the inline error "Already rejected for that date"; a malformed or
  stale Option id (`22P02` / `23503`) is returned as "That option is no longer
  available". Returns an `ok` / `error` result.
- **Update a Rejection** `(id, { optionId, rejectedOn, reason })` — same
  validation and collision handling.
- **Delete a Rejection** `(id)` — delete the row by id (the row is gone
  entirely, so it stops feeding AI search — ADR-0006).

Each action revalidates `/`, `/log`, and `/catalog/[id]`: a Rejection dated
today changes Tonight's suppression, the Log renders it, and the Option detail
page shows it.

A Log-screen Rejections query: every Rejection joined to its Option (name,
kind), ordered newest `rejected_on` first — the counterpart of `getLog`.

A `.db.test.ts` covers the duplicate-`(option_id, rejected_on)` collision on
both create and update — the inline error is returned, not thrown. Prior art:
`app/log/actions.db.test.ts`.

## Acceptance criteria

- [ ] Create / update / delete dated-Rejection actions, all
      `authedAction`-wrapped, rejecting an unauthenticated caller
- [ ] Create and update store an empty/whitespace reason as `null` and reject
      an invalid date
- [ ] A duplicate `(option_id, rejected_on)` on create or update returns the
      inline "Already rejected for that date" error rather than throwing
- [ ] A malformed or stale Option id returns "That option is no longer
      available"
- [ ] Delete removes the `rejections` row entirely
- [ ] Each action revalidates `/`, `/log`, and `/catalog/[id]`
- [ ] A Log-screen Rejections query returns Rejections joined to their Option,
      newest `rejected_on` first
- [ ] A `.db.test.ts` covers the create and update collision paths, modelled on
      `app/log/actions.db.test.ts`
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green, and
      `pnpm build` passes with no env vars set

## Blocked by

- [01 — Schema: a Rejection is unique per Option per date](./01-rejection-uniqueness.md)
  — the `(option_id, rejected_on)` constraint must exist for the collision path
