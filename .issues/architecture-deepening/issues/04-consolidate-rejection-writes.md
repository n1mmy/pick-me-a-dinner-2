# 04 — Consolidate Rejection writes into one module (fixes the rejectOption 500)

Status: done
Type: AFK

## What to build

The `rejections` table is currently written by two divergent Server Action
modules. `app/log/rejection-actions.ts` holds `createRejection` /
`updateRejection` / `deleteRejection`, which handle the
`(option_id, rejected_on)` collision (`23505`) ADR-0008's unique constraint
introduced. `app/tonight-actions.ts` holds the live-Tonight `rejectOption`
(also wired into the Option detail page's controls) and `bringBackRejection`,
and `rejectOption` is a separate copy of the insert that **never got the
`23505` handling**. Consequence — a real bug: tapping **Reject** on the Option
detail page when a today-dated **Rejection** for that Option already exists
(or a double-tap race on Tonight's Reject) throws an uncaught 500.

Consolidate every Rejection-table write behind one module so the divergence
cannot recur.

- Create `app/rejection-actions.ts` (top-level, mirroring
  `app/tonight-actions.ts`). Remove `app/log/rejection-actions.ts`.
- The module exports the Rejection-write Server Actions: `createRejection`,
  `updateRejection`, `deleteRejection`, and the live-Tonight `rejectOption`. A
  private `recordRejection` core does the shared insert; `rejectOption`
  becomes "create a Rejection dated today" over that core, so it inherits the
  `23505` collision handling. **This is the bug fix.**
- `rejectOption` returns the shared `ActionResult` instead of `void`. The
  Tonight reject affordance (`app/tonight-row.tsx`) and the Option detail
  controls (`app/catalog/[id]/option-controls.tsx`) surface an `{ ok: false }`
  collision as an inline error instead of ignoring the result.
- Remove `bringBackRejection` — it is byte-identical to `deleteRejection`
  (delete a `rejections` row by id). Tonight's "Rejected tonight" disclosure
  in `app/tonight-screen.tsx` calls `deleteRejection`. **Bring back** stays
  the user-facing affordance name (it is a `CONTEXT.md` term) — only the
  Server Action is shared, so no glossary change.
- `app/tonight-actions.ts` is left holding only `aiSearchAction`, with the
  now-unused imports dropped.
- Every Rejection write revalidates one consistent set — `/`, `/log`,
  `/catalog/[id]`. This also fixes a latent staleness bug: today's
  `rejectOption` omits `/log`, so a Reject from Tonight leaves the Log
  screen's Rejection rows stale.
- The consolidated module adopts the shared `ActionResult`, `trimToNull`
  (`lib/action-result.ts`), and `pgErrorMessage` (`lib/pg-error.ts`) from
  issue 01.

The `.db.test.ts` for these actions moves to `app/rejection-actions.db.test.ts`
with corrected import paths, and gains coverage for the `rejectOption`
today-collision path — the 500 this issue exists to fix.

## Acceptance criteria

- [x] All `rejections`-table writes live in one module,
      `app/rejection-actions.ts`; `app/log/rejection-actions.ts` is removed
- [x] `rejectOption` returns `ActionResult` and handles a
      `(option_id, rejected_on)` `23505` collision as the inline "Already
      rejected for that date" — no uncaught 500
- [x] The Tonight reject affordance and the Option detail Reject control
      display a Rejection-write failure inline
- [x] `bringBackRejection` is removed; "Bring back" on Tonight calls
      `deleteRejection` and the Option returns to the picker as before
- [x] Every Rejection write revalidates `/`, `/log`, and `/catalog/[id]`
- [x] `app/tonight-actions.ts` contains only `aiSearchAction`
- [x] Rejection writes use the shared `ActionResult` / `trimToNull` /
      `pgErrorMessage`
- [x] The rejection-actions `.db.test.ts` is at
      `app/rejection-actions.db.test.ts` and covers the `rejectOption`
      today-collision path
- [x] "Bring back" remains the `CONTEXT.md` term — no glossary change; no ADR
      change
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green, and
      `pnpm build` passes with no env vars set

## Blocked by

- [01 — Concentrate Postgres-error translation and the action-result type](./01-concentrate-pg-error-translation.md)
  — the shared `ActionResult` and `pgErrorMessage` must exist first
