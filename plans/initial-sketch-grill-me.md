# Pick Me a Dinner — v1 Plan

A small personal web app to help decide what's for dinner. Supports
restaurants and home-cooked meals, keeps a log of past and planned dinners,
tags every option, and surfaces a "smart" variety-driven suggestion list.

Status: agreed plan, pre-implementation. Greenfield repo.

---

## 1. Platform & stack

- Responsive web app — desktop + mobile, single full-stack codebase.
- **Next.js + TypeScript + Prisma**, **PostgreSQL**.
- Self-hosted on Kubernetes. The repo ships a **Dockerfile only**; k8s
  manifests are wired up separately by the operator.
- Single-user app. Access gated by a **single app-level password** — no user
  accounts, no user table.

## 2. Authentication & security

Threat model: keep anonymous people on the internet out. Infrastructure is
trusted; this app is not a high-value target.

- **Password**: plaintext `APP_PASSWORD` env var. Login compares with
  `crypto.timingSafeEqual`. No hashing.
- **Sessions**: `iron-session` — encrypted + signed stateless cookie
  (AES-256-GCM), keyed by a 32+ byte random `SESSION_SECRET`.
  - Cookie flags: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`,
    `maxAge` ~30 days with rolling refresh.
- **Route gating**: Next.js middleware checks the session on every route
  except `/login` and static assets.
- **Rate limiting**: light in-memory per-IP throttle on the login POST
  (~20/min) to blunt scripted hammering. No lockout, no persistent counter.
- **Transport**: TLS terminated at the ingress. App trusts
  `X-Forwarded-Proto` so `Secure` cookies work behind the proxy.
- **Security headers** (via `next.config` / middleware): `Strict-Transport-
  Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`
  (+ CSP `frame-ancestors 'none'`), `Referrer-Policy: no-referrer`, a
  baseline CSP.
- **CSRF**: `SameSite=Lax` + same-origin checks on mutations. Next.js Server
  Actions carry CSRF protection by default.
- **Postgres connection**: plain (no `sslmode=require`) — DB is behind shared
  trusted infra.
- **Secrets**: `APP_PASSWORD`, `SESSION_SECRET`, `DATABASE_URL`,
  `GOOGLE_PLACES_API_KEY` injected from k8s Secrets — never baked into the
  image, never committed. `.env.example` carries placeholders only.

## 3. Data model

### `DinnerOption`
One table for both kinds of dinner.

- `id`, `type` — enum `RESTAURANT | HOME`
- `name`
- `notes` — free text
- `archived` — boolean (soft-delete flag)
- `createdAt`, `updatedAt`
- Tags — many-to-many to `Tag`
- Restaurant-only (nullable): menu/order URL, phone, address, `lat`, `lng`,
  `googlePlaceId`, Maps URL
- Home-only (nullable): recipe URL

### `Tag`
First-class entity.

- `id`, `name`
- Many-to-many join to `DinnerOption`

### `DinnerLogEntry`

- `id`, `date` — may be past **or** future (planning ahead)
- `dinnerOptionId` — FK, **always** references a `DinnerOption`
- `notes` — per-entry free text
- `createdAt`, `updatedAt`
- Multiple entries per date allowed. Fully editable. No rating field.

### Deletion semantics

Deleting a `DinnerOption` sets `archived = true` (soft-delete). Archived
options disappear from the suggestion list, search, and pickers, but past log
entries still resolve and display correctly.

## 4. Google Places integration (v1)

- The add-restaurant form has a "search Google" box. Selecting a result
  autofills name, address, `lat`/`lng`, phone, website, Maps URL,
  `googlePlaceId`.
- If `GOOGLE_PLACES_API_KEY` is unset, the box is hidden and the form
  degrades to plain manual entry.

## 5. Suggestion engine — variety / anti-repetition

Goal: avoid eating the same (or similar) thing repeatedly. Both "similarity"
and "recency" act as **penalties**.

For a candidate option `C`:

```
penalty(C) = Σ over past log entries D (date ≤ today) of  decay(D) × sim(C, D)
```

- `sim(C, D)` = **1** if `D` references the same option as `C`; otherwise the
  **Jaccard overlap** of their tag sets (`shared tags / total distinct tags`).
- `decay(D)` = exponential decay on age, **~1-week half-life** (configurable).
- Future-dated entries are **excluded** from the engine until their date
  arrives.
- Options are ranked **ascending** by `penalty` — never-eaten options have
  penalty 0 and naturally float to the top.
- Ranking is **deterministic** (no random jitter); ties broken by name.

## 6. Pages

| Route | Purpose |
|---|---|
| `/` (suggestions) | Full catalog ranked by variety score. Filters: type (restaurant/home), tag include/exclude, free-text name search. Each row shows a short reason ("last had 3 weeks ago", "similar to Tuesday's Thai"). |
| `/options/[id]` | Detail page: menu/order URL, phone, Maps link, tags, notes, and the option's own dinner history. A "Log dinner" button with a date picker (defaults to today; handles future planning). |
| `/options/new`, edit | Add / edit a dinner option. Restaurant form includes the Places search box. Inline quick-add reachable from the log flow. |
| `/log` | Chronological list of dinners. An "Upcoming" section pinned on top for future-dated entries, then past history descending. Inline editing of any entry. |
| `/login` | Password login. |

## 7. Deployment

- Repo ships a **Dockerfile** only.
- Container runs `prisma migrate deploy` on startup before the server boots.
- Env vars: `DATABASE_URL`, `APP_PASSWORD`, `SESSION_SECRET`,
  `GOOGLE_PLACES_API_KEY` (optional).

## 8. Open / deferred

- **Tag-entry UX** — TBD. Proposed default: a chip/token input with
  autocomplete over existing tags plus create-new.

## 9. Decisions explicitly rejected

- No per-dinner rating — suggestions run purely on recency + similarity.
- No password hashing — infra is trusted.
- No login lockout / persistent rate-limit counter.
- No k8s manifests or Helm chart in the repo.
- No free-text one-off log entries — every entry references an option.
- No effort level or ingredient list on home meals.
