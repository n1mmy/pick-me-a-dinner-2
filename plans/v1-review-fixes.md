# v1 Review Fixes — plan

Status: **agreed** — fix set triaged with the user during `/review` of branch
`ralph-1` (2026-05-16). Not yet implemented. This is the work to do before
`ralph-1` merges to `main`.

## Context

`/review` ran the full review army (testing, maintainability, security,
performance, data-migration, design specialists + Red Team) and cross-model
adversarial review (Claude + Codex) against the v1 build. It surfaced 2 P1s and
6 bugs. The user triaged every finding; this plan is the agreed subset, with
the user's modifications folded into each fix.

**In scope:** F1–F9 below.
**Out of scope (user decision):** B7 (no-op write reports success — too rare),
T1–T5 (missing negative-path tests — "don't overtest"), Codex-P2 (never-eaten
chip wording — user will tweak text later).
**Already done:** the unused `LogEntry` import in `db/queries.ts` was removed
during the review.

## Interpretation calls (flagged for review — correct me if wrong)

- **F1** uses an auth-by-default *wrapper* (`authedAction`) as the mechanism for
  "make authentication the default." Open to inline `await requireSession()`
  calls instead if you prefer.
- **F5 (B3)** — the ranking code *already* excludes archived options from
  per-tag recency (the carrier set is built from active options only). So this
  fix is mostly making that intentional + correcting the plan docs, which
  currently say the opposite.
- **F7 (B6)** keeps the *schema-behind* case as a hard startup exit (it's a
  deploy-ordering error, same class as a config error). Only the *DB-unreachable*
  case changes to no-exit. Say so if schema-behind should also go soft.
- **F9 (D1)** adds a new migration `0001` rather than regenerating `0000`, so
  the already-applied `0000` on the local dev DB stays valid.

---

## F1 — Auth by default for server actions (C1) — P1

**Problem.** `middleware.ts` gates routes, but `/login` is exempt and Next.js
dispatches a server action by its `Next-Action` ID regardless of which route the
POST hits. Action IDs ship in the public `/_next/static` chunks. An anonymous
user can POST to `/login` and invoke any action — mutating all data, burning the
Google Places key. Route gating cannot protect server actions; the check must
be in the action.

**Approach (user: invert it — auth is the default, login opts out).**

- New `lib/require-session.ts` — `requireSession()`: reads the iron-session via
  `getSession()`; on `!authenticated`, `redirect("/login")`.
- New `lib/authed-action.ts` — `authedAction(fn)`: a generic wrapper that runs
  `requireSession()` then `fn(...)`, preserving the signature.
- Wrap every server action in `app/log/actions.ts`, `app/catalog/actions.ts`,
  `app/catalog/places-actions.ts` with `authedAction`.
- `app/login/actions.ts` `login` stays **unwrapped** — the single, explicitly
  commented public action (it cannot authenticate; it is how a session starts).
- Middleware stays as-is, as defense-in-depth.

**Files:** `lib/require-session.ts` (new), `lib/authed-action.ts` (new),
`app/log/actions.ts`, `app/catalog/actions.ts`, `app/catalog/places-actions.ts`,
`app/login/actions.ts`.

## F2 — Build works without env vars; app still exits at runtime (C2) — P1

**Problem.** `db/index.ts` throws at module import when `DATABASE_URL` is unset.
`Dockerfile` runs `pnpm build` with no `DATABASE_URL` (`.env` is
`.dockerignore`d), so `next build` fails when it evaluates the data pages. The
GHCR image never builds.

**Approach (user: build must work env-free; the *running server* must still
exit if `DATABASE_URL` is unset).**

- `db/index.ts`: remove the import-time `throw`. Construct the `postgres()`
  client (lazy — it does not connect until first query). Importing the module
  no longer crashes a build.
- `app/page.tsx`, `app/catalog/page.tsx`, `app/log/page.tsx`: add
  `export const dynamic = "force-dynamic"` so `next build` does not try to
  pre-render (and thus query) them.
- Runtime guard: see F8 — the unified startup check exits non-zero if
  `DATABASE_URL` is unset (a configuration error).

**Files:** `db/index.ts`, `app/page.tsx`, `app/catalog/page.tsx`,
`app/log/page.tsx` (+ startup check in F8).

## F3 — Server-action input validation (B1 + B4)

**Problem.** `logForDate`/`updateLogEntry` catch only SQLSTATE 23505. A cleared
`<input type="date">` sends `""`; a malformed/stale `optionId` is a bad UUID
(22P02) or FK violation (23503). All currently surface as uncaught 500s instead
of the inline errors the forms are built for (plan §17).

**Approach.**

- Add a `YYYY-MM-DD` shape check; `logForDate`/`updateLogEntry` reject a
  blank/invalid `eatenOn` up front with `{ ok: false, error: "Pick a valid date" }`.
- Broaden the caught Postgres codes in the log + catalog actions: `22P02`
  (invalid uuid) and `23503` (stale option) → friendly inline errors, not 500s.
- `AddEntryForm`/`EntryEditForm`: guard a blank date client-side too (mirror
  `TonightRowItem.submitDate`'s `if (!dateValue) return`).

**Files:** `app/log/actions.ts`, `app/catalog/actions.ts`,
`app/log/log-screen.tsx`, `lib/local-day.ts` (date-shape helper).

## F4 — "Pick tonight" failure feedback (B2)

**Problem.** `tonight-row.tsx` sets "Logged ✓" optimistically; `pickTonight`
returns `void` with no failure path. A DB error flashes success while nothing
was written. Plan §17 requires "pick fails → inline message on the row."

**Approach.**

- `pickTonight` returns `LogActionResult`; catch FK/other errors → `{ ok: false }`.
- `tonight-row.tsx` `pick()`: await the result inside the transition; show
  "Logged ✓" only on success; on failure render an inline error and do not
  mark the row logged.

**Files:** `app/log/actions.ts`, `app/tonight-row.tsx`.

## F5 — Archived options do not affect ranking (B3)

**Problem (as triaged).** Codex flagged that archived options are excluded from
per-tag recency, which contradicts plan §5/§7 ("all options carrying that tag").
User decision: that exclusion is actually *desired* — archiving is rare and
should not move the ranking. So the code is fine; the plan docs are wrong.

**Approach.**

- Make the exclusion explicit: filter `getTonightData`'s `dinner_log` fetch to
  active options' rows (today the rows are fetched then silently dropped by the
  active-only carrier set) and add a clarifying comment.
- Correct `plans/v1-plan.md` §5 and §7, and `CONTEXT.md` if it states "all
  options," to say recency considers **active options only**.

**Files:** `db/queries.ts`, `plans/v1-plan.md`, `CONTEXT.md`.

## F6 — `resolveTagId` concurrency race (B5)

**Problem.** Concurrent same-tag creation: the second tx's
`onConflictDoNothing` returns nothing, its in-transaction SELECT cannot see the
first tx's uncommitted row, `existing.id` throws a TypeError → 500.

**Approach.** Replace the insert-then-select with `INSERT ... ON CONFLICT DO
UPDATE SET name = EXCLUDED.name RETURNING id` — always returns the row, no
second query, no race. (If Drizzle cannot cleanly target the `lower(name)`
expression index for the conflict, fall back to insert-nothing + select with an
`if (!existing)` guarded single retry.)

**Files:** `app/catalog/actions.ts`.

## F7 — Readiness endpoint instead of crash-loop on unreachable DB (B6)

**Problem.** `checkSchemaOnBoot` re-throws a DB connection error out of
`register()`; Next.js logs it but does not exit, so the server boots and serves
500s. User decision: do **not** crash-loop on a transient unreachable DB — a
fleet of restarting pods would thunder-herd the database. A configuration error
(`DATABASE_URL` unset) is different and *should* exit.

**Approach.**

- New `app/api/ready/route.ts` — a GET route handler that runs `select 1`;
  returns 200 if the DB is reachable, 503 if not. The k8s readiness probe points
  here; an unreachable DB marks the pod not-ready (no traffic, no crash-loop).
- Middleware: exempt `/api/ready` (a GET-only route handler — no server-action
  dispatch surface, so the exemption is safe, unlike `/login`).
- `checkSchemaOnBoot`: on a DB *connection* error, log a warning and return
  (do not exit) — readiness holds traffic until the DB is up. Keep the
  *schema-behind* case as a loud `process.exit(1)` (deploy-ordering error).
- Document for the operator (plan §3 / a comment) that the k8s readiness probe
  must target `/api/ready`.

**Files:** `app/api/ready/route.ts` (new), `middleware.ts`,
`lib/schema-check.ts`, `instrumentation.ts`, `plans/v1-plan.md` (§3 probe note).

## F8 — Unified startup config check (B8 + F2 runtime guard)

**Problem.** `today()` falls back to `"UTC"` when `APP_TZ` is unset → dinners
silently logged on the wrong calendar day. `DATABASE_URL`/`APP_SECRET`/
`APP_PASSWORD` only fail lazily on first use. There is no single boot-time
config gate.

**Approach.**

- New `lib/check-env.ts` — verifies `DATABASE_URL`, `APP_SECRET`,
  `APP_PASSWORD`, `APP_TZ` are set (and `APP_TZ` is a valid IANA zone). On any
  missing/invalid value: loud, specific error + `process.exit(1)`.
- Call it first in `instrumentation.ts` `register()`, before the schema check.
- This is the runtime guard F2 refers to: the build no longer needs env vars,
  but the running server exits non-zero on a configuration error.

**Files:** `lib/check-env.ts` (new), `instrumentation.ts`.

## F9 — Index on `option_tags.tag_id` (D1)

**Problem.** Postgres does not auto-index FK columns; `option_tags.tag_id` has
no covering index. Negligible at this scale, but cheap correct polish.

**Approach.** Add `index("option_tags_tag_id_idx").on(t.tagId)` to the
`optionTags` table in `db/schema.ts`; run `drizzle-kit generate` to produce a
new migration `drizzle/0001_*.sql`. The operator applies it out of band per
plan §3; the startup schema check covers the gap until then.

**Files:** `db/schema.ts`, `drizzle/0001_*.sql` (+ `drizzle/meta`).

---

## Suggested order

1. **F2 + F8 + F7** together — they all touch `instrumentation.ts` / startup
   and `lib/schema-check.ts`; build-unblocking comes first.
2. **F1** — independent; the security P1.
3. **F3 + F4** — both touch the log actions and the screens.
4. **F6**, **F9**, **F5** — independent, small.

## Testing

New pure logic and validation gets a light test where an existing test file
already covers that module (the action and lib test files exist). No broad
coverage expansion — per the triage, the existing-code test gaps (T1–T5) were
deliberately left out.

## Verify before merge

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green.
- `pnpm build` succeeds with **no** env vars set (F2).
- The three cross-component flows from plan §15 hand-verified.
