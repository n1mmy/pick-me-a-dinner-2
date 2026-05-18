# 01 — Concentrate Postgres-error translation and the action-result type

Status: ready-for-agent
Type: AFK

## What to build

The `try { write } catch { map a SQLSTATE code to an inline message }` shape
is re-implemented across the mutating Server Actions, and the
`{ ok: true } | { ok: false; error: string }` result type is declared three
times. This slice concentrates that scattered, shallow logic so the
SQLSTATE-to-message decision lives in one place.

- A new module `lib/action-result.ts` exports the shared `ActionResult` type
  (`{ ok: true } | { ok: false; error: string }`) and the `trimToNull`
  form-field helper. The identical local copies in `app/catalog/actions.ts`
  and `app/log/actions.ts` are removed and import the shared ones.
- A new `pgErrorMessage(error, messages)` is added to `lib/pg-error.ts`,
  building on the existing `pgErrorCode`. It translates an *expected* Postgres
  driver error into an `ActionResult` failure, or re-throws any code the
  caller did not list. The `messages` map is keyed by failure *concept*, not
  raw code, so callers never branch on a SQLSTATE string themselves:
  - `duplicate` — a `23505` unique-constraint violation.
  - `missingOption` — a `22P02` invalid-uuid or a `23503` foreign-key
    violation (a malformed or stale Option id).
  - `restricted` — a `23503` read as an `ON DELETE RESTRICT` (e.g. an Option
    with Log history). When both `restricted` and `missingOption` are
    supplied, `restricted` wins for `23503`.
  Each key is optional; a write passes only the failure modes it can hit.
- `app/catalog/actions.ts` and `app/log/actions.ts` are refactored onto both
  helpers: every mutating action keeps its `try/catch` shape, but the catch
  body becomes a single `pgErrorMessage(error, { … })` call. No raw SQLSTATE
  string literal remains in those two files. The inline messages are exactly
  the ones in use today (e.g. "Already logged for that date", "In your log —
  archive instead", "That option is no longer available").

Decided design: the **middle** depth. Keep the `try/catch` in each action —
do **not** introduce a `dbWrite(thunk, messages)` wrapper that restructures
every action body. This is a lean personal app; the wrapper is more machinery
than the locality win justifies.

Out of scope: `app/log/rejection-actions.ts` is consolidated and moved in
issue 04, which adopts these same shared helpers as part of that work — do not
edit it here.

## Acceptance criteria

- [ ] `lib/action-result.ts` exports `ActionResult` and `trimToNull`; the
      local copies in `app/catalog/actions.ts` and `app/log/actions.ts` are
      removed in favour of imports
- [ ] `pgErrorMessage(error, messages)` is added to `lib/pg-error.ts`,
      translating `23505` / `22P02` / `23503` per the concept-keyed map and
      re-throwing any unlisted code
- [ ] Every mutating action in `app/catalog/actions.ts` and
      `app/log/actions.ts` maps its expected errors through `pgErrorMessage`;
      no raw SQLSTATE string literal remains in either file
- [ ] No `dbWrite` / thunk-wrapper abstraction is introduced — each action
      keeps its `try/catch`
- [ ] Behaviour is unchanged: `app/catalog/actions.db.test.ts` and
      `app/log/actions.db.test.ts` pass with the same inline messages
- [ ] A unit test covers `pgErrorMessage` — each concept mapping and the
      re-throw of an unlisted code
- [ ] No `CONTEXT.md` or ADR changes are needed
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green, and
      `pnpm build` passes with no env vars set

## Blocked by

- None - can start immediately
