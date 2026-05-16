# Pick Me a Dinner — v1 Plan (canonical)

A small personal web app to help decide what's for family dinner. Supports
restaurants and home-cooked meals, keeps a log of past **and planned** dinners,
tags every option, and surfaces a "smart" variety-driven suggestion list.

Status: **canonical** — merged source of truth. Pre-implementation, greenfield.
This plan supersedes `old/initial-sketch-grill-me.md` and
`old/initial-sketch-office-hours.md`, which are kept only as historical source
material. It uses the office-hours plan as its base, with four user-directed
overrides folded in (hosting, future-dating, Google Places, editable history).

---

## 1. Problem & shape

Deciding what the family eats for dinner is recurring nightly friction. The hard
part is *choosing* — and choosing badly because you can't remember what you've
already eaten this week or which restaurants are in play. This app removes that
friction. It is **not** an oracle and **not** a meal planner: the human stays
the decider; the app puts the right context in front of them fast.

> "A sharp tool to do one job: help me pick family dinner every night. I am
> still picking, and I need context about what we as a family have eaten
> recently and possible restaurants to do so."

The signature feature is **explainable dinner memory** — every ranked option
carries one plain-English reason for where it sits ("No fish in 18 days").
Restaurants and home-cooked meals are first-class equals in one catalog and one
log.

Small by intent: ~4 screens, 4 tables, one interesting algorithm. Resist growth
into recipes / grocery lists / nutrition / weekly planning.

## 2. Platform & stack

- Responsive web app — phone-primary (dinner is picked in the kitchen ~5pm),
  desktop first-class too (catalog management, ordering-out research).
- **Next.js (App Router) + TypeScript + Drizzle ORM + PostgreSQL + Tailwind.**
- Server actions make `pick = log` a one-liner.
- Single-household app. Access gated by a single shared app password — no user
  accounts, no user table.

## 3. Hosting & deployment  *(override — self-hosted, not Railway)*

- **Self-hosted on Kubernetes.** The repo ships a **Dockerfile**; k8s
  manifests / secrets are wired up separately by the operator.
- **Image build/publish:** a GitHub Actions workflow
  (`.github/workflows/build.yml`) builds the image and pushes it to GHCR
  (`ghcr.io/<owner>/pick-me-a-dinner`) on push to `main` and on tags. Deploying
  is pointing k8s at a new image tag — no build happens on a laptop.
- The container entrypoint **just runs the Next.js app** — it does not migrate.
  **Schema migrations are applied out of band by the administrator** (e.g.
  `drizzle-kit migrate` run by hand against the DB before/around a deploy). The
  repo still generates and version-controls migration files; applying them is
  an operator step, not an app-startup step.
- **Startup schema check.** On boot the app compares the migration files
  bundled in the image against the `__drizzle_migrations` table in the DB. If
  the DB is behind, it logs a loud, specific error ("DB schema N migrations
  behind — run drizzle-kit migrate") and exits non-zero, so the pod crash-loops
  visibly instead of serving pages that 500 on missing columns.
- **Postgres connection:** plain (no `sslmode=require`) — the DB sits behind
  shared trusted infrastructure.
- **Env vars:** `DATABASE_URL`, `APP_PASSWORD`, `APP_SECRET`, `APP_TZ`,
  `GOOGLE_PLACES_API_KEY` (optional). Injected from k8s Secrets — never baked
  into the image, never committed. `.env.example` carries placeholders only.
- **Transport:** TLS terminated at the ingress; the app trusts
  `X-Forwarded-Proto` so `Secure` cookies work behind the proxy.
- **Backup:** rely on the infrastructure's Postgres backups; optionally a
  periodic `pg_dump` for peace of mind.

## 4. Authentication & security  *(HMAC-signed cookie, no lockout)*

Threat model: keep anonymous people on the internet out. Infrastructure is
trusted; this app is not a high-value target.

- **Password:** plaintext `APP_PASSWORD` env var. Login compares the submitted
  value with `crypto.timingSafeEqual` (constant-time). No hashing.
- **Session cookie:** on a correct password, establish a session with the
  **`iron-session`** library — a sealed (encrypted + signed) cookie keyed by
  `APP_SECRET`. The cookie cannot be forged or read without the secret, and an
  embedded TTL (~180 days) means a copied cookie self-expires rather than
  replaying indefinitely until the secret is rotated.
  - Cookie flags (set by `iron-session`): `HttpOnly`, `Secure`,
    `SameSite=Lax`, `Path=/`, `ttl` / `Max-Age` ~180 days.
- **No lockout, no rate limit.** Wrong password → inline error, nothing else.
  Personal app, trusted infra.
- **Route gating:** Next.js middleware validates the cookie on every route
  except `/login` and static assets.
- **Security headers** (via `next.config` / middleware): `Strict-Transport-
  Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`
  (+ CSP `frame-ancestors 'none'`), `Referrer-Policy: no-referrer`, a baseline
  CSP.
- **CSRF:** `SameSite=Lax` + same-origin checks on mutations. Next.js Server
  Actions carry CSRF protection by default.
- No logout UI in v1 — clearing the cookie is sufficient.

## 5. Data model

```
items
  id              uuid pk
  name            text
  kind            enum('home','restaurant')
  url             text null          -- menu / delivery / recipe link
  notes           text null
  active          boolean default true   -- inactive = hidden from Tonight +
                                          -- default Catalog list; still shown
                                          -- in Log history
  created_at      timestamptz
  -- restaurant-only, all nullable, populated manually or by Places autofill:
  address         text null
  phone           text null
  lat             double precision null
  lng             double precision null
  google_place_id text null
  maps_url        text null

tags
  id              uuid pk
  name            text               -- app trims + lowercases every tag on
                                      -- input; UNIQUE INDEX on lower(name)
                                      -- enforces case-insensitive uniqueness
                                      -- (no citext extension needed)

item_tags
  item_id         uuid fk -> items  ON DELETE CASCADE
  tag_id          uuid fk -> tags   ON DELETE CASCADE
  pk (item_id, tag_id)

dinner_log
  id              uuid pk
  item_id         uuid fk -> items  ON DELETE RESTRICT   -- see lifecycle rules
  eaten_on        date               -- may be PAST or FUTURE (see §6);
                                      -- multiple items per date allowed
  note            text null
  created_at      timestamptz
  UNIQUE (item_id, eaten_on)          -- the SAME item can't be logged twice on
                                      -- one date; DIFFERENT items on one date
                                      -- is fine — that's a real dinner
```

`dinner_log` is the single source of truth for all recency. Per-item recency =
most recent **non-future** `eaten_on` for that item. Per-tag recency = most
recent **non-future** `eaten_on` across all items carrying that tag (via the
`item_tags` join). See §7 for why future rows are excluded.

### Lifecycle rules

- **Deactivate, don't delete logged items.** An item with any `dinner_log` row
  cannot be hard-deleted (`ON DELETE RESTRICT` enforces this). The Catalog
  screen offers "Archive" → sets `active = false`; archived items vanish from
  Tonight and the default Catalog list but still render in Log history. An item
  with zero log rows may be hard-deleted.
- **`pick = log` appends; multiple items per date are allowed.** A real dinner
  is sometimes two restaurants, or takeout plus some home cooking. Tapping "Pick
  tonight" inserts a `dinner_log` row for today; picking another item the same
  evening adds a second row. The only thing blocked is logging the *same* item
  twice on one date: `pick = log` upserts on `(item_id, eaten_on)`, so an
  accidental double-tap is a harmless no-op.
- **Tags are merged, never deleted.** The Tags screen exposes rename and merge
  only. A typo tag is fixed by renaming or merging it into the right one.
  (`ON DELETE CASCADE` on `item_tags.tag_id` exists only so a merge's final
  `DELETE tag B` stays clean.) The whole merge runs in a **single transaction**
  so a mid-merge failure can't leave partial state.
- **Tag edits are not retroactive.** Per-item and per-tag recency are computed
  from an item's *current* tags, not the tags it had when a past dinner was
  logged. This is intentional and simplest; revisit only if it feels wrong in
  practice.

## 6. Dinner log: today, the past, and planned dinners  *(future-dating override)*

The log is fully editable history **and** a lightweight planning surface.

- **One-tap pick.** "Pick tonight" on the Tonight screen logs an entry with
  `eaten_on = today`. This is the common path and stays one tap.
- **Log for another date.** Both the Tonight row action and the Log screen
  offer a "different date" path with a date picker (defaults to today). Pick a
  **past** date to backfill a dinner you forgot to log, or a **future** date to
  plan ahead ("Thursday: El Comal").
- **Future entries are plans.** A `dinner_log` row with `eaten_on > today` is a
  planned dinner. It is shown in the Log screen's "Upcoming" section and is
  **excluded from the ranking** until its date arrives (see §7) — a plan for
  Friday should not make Friday's dish look "recently eaten" today.
- `UNIQUE (item_id, eaten_on)` applies to past, present, and future rows alike.

### Editing & correcting history  *(explicit requirement)*

Any logged entry — past, today, or upcoming — is fully editable on the Log
screen. The user can:

- **Change the item** (mis-tapped, or the plan changed).
- **Change the date** (`eaten_on`) — including moving an entry between the past
  history and the Upcoming section.
- **Edit the note.**
- **Delete the entry** entirely (e.g. a plan that didn't happen, or a pick the
  family didn't actually eat).

Edits that would violate `UNIQUE (item_id, eaten_on)` — e.g. changing an
entry's date onto a date that item is already logged for — are rejected with an
inline error rather than silently merged.

## 7. Suggestion engine — variety / anti-repetition

The Tonight list is the full active catalog (after filters), sorted **descending**
by a score combining two signals: **anti-repeat** (per-item recency) and
**variety enforcer** (per-tag recency). Higher score = more "due", floats to the
top.

**Future rows are excluded.** All recency in this section is computed only from
`dinner_log` rows with `eaten_on <= today` (local). Planned/future dinners do
not influence the ranking until their date arrives.

**Where it runs.** Computed in TypeScript, not SQL. For a personal catalog (tens
of items, hundreds of log rows) the dataset is tiny. The Tonight server
component fetches `items` (active), `item_tags`, and the non-future `dinner_log`
rows, and computes scores in a pure, unit-testable function.

**Core helper, with explicit null handling:**

```
CAP = 60                       // days; also the substitute for "never"

daysSince(date | null):
    if date is null:  return CAP            // never eaten / never used
    return min( CAP, todayInDays - date )   // capped so "never" can't dominate
```

`eaten_on` is a SQL `date` (no timezone). Before subtraction, both `eaten_on`
and "today" are converted to integer **epoch-days in the app's local timezone**
(`APP_TZ`, e.g. `America/Los_Angeles`) so "today" is the household's calendar
day, not the server's UTC day. `lastEaten(item)` and `lastTagUse(t)` are the
per-item / per-tag recency dates from §5; both return `null` when the item / tag
has never appeared in a non-future `dinner_log` row.

**Score:**

```
itemScore(item):
    anti_repeat = daysSince(lastEaten(item))           // 0..CAP

    tagDays     = [ daysSince(lastTagUse(t)) for t in tags(item) ]
    variety     = tagDays.length === 0
                    ? anti_repeat                      // tagless item: variety
                                                       // term mirrors anti-repeat
                    : mean(tagDays)                    // 0..CAP

    return  W_ITEM * anti_repeat
          + W_TAG  * variety
```

Both terms are in the same unit (capped days, 0..CAP), so they combine cleanly.

**Starting weights** (live in one `ranking.config.ts`, tuned by feel):

```
W_ITEM = 1.0      // anti-repeat
W_TAG  = 1.0      // variety enforcer
```

A favorite term is **not in v1** — no `W_FAV`, no `favoriteBonus` stub: a
function that exists only to be multiplied by zero is premature abstraction.
When added later it is a third term expressed in the same capped-day unit
(e.g. `min(CAP, totalTimesEaten * k)`), never a raw count. Defer until there is
real log data to tune against.

**Explanation chip** — one per row, derived deterministically from the score:

- If the item **has tags** AND `W_TAG * variety >= W_ITEM * anti_repeat` (tag
  term dominates, ties included): the chip names the **single tag with the
  largest `daysSince`** → "No fish in 18 days".
- Otherwise (item term dominates, **or the item has no tags**): the chip names
  the item's own recency → "Last had 28 days ago". A tagless item always uses
  this branch — it has no tag to name, so the tag branch is never reached for
  it even on a score tie.
- The "Family favorite · ..." chip variant is deferred with the favorite term.

The chip is a **product requirement**: if the ranking can't explain itself in
one plain-English line, it isn't done.

**"Overdue" tag styling.** A tag chip renders in the accent color when
`daysSince(lastTagUse(t)) >= OVERDUE_THRESHOLD` (`= 14`, in `ranking.config.ts`).
Purely visual; does not affect the score.

**Cold start.** With zero non-future `dinner_log` rows, every item scores
`(W_ITEM + W_TAG) * CAP` — a flat tie. Tonight then falls back to ordering by
`items.name` until enough history exists to differentiate.

## 8. Google Places integration  *(restaurant autofill override)*

- The Catalog **add/edit restaurant** form has a "Search Google" box. Selecting
  a result autofills `name`, `address`, `phone`, `lat`, `lng`, `url` (website),
  `maps_url`, and `google_place_id`. All fields stay editable after autofill.
- If `GOOGLE_PLACES_API_KEY` is unset, the box is **hidden** and the form
  degrades cleanly to plain manual entry.
- **Places request failure** (network error, quota exceeded, 4xx/5xx from
  Google): the box shows an inline "Google search unavailable — enter details
  manually" notice and the manual fields stay fully editable, so a save still
  works. The Places fetch carries a timeout so the box can't hang on a flaky
  network.
- Home meals have no Places integration — just the manual form with an optional
  `url` for a recipe link.

## 9. Screens

1. **Tonight** (home, primary) — ranked active catalog. Each row: name, quiet
   Home/Restaurant badge, one explanation chip, tag chips showing per-tag
   recency ("fish 18d", overdue tags in accent color), a one-tap "Pick tonight"
   action, and a secondary "log for another date" path (§6). Sticky filter
   zone: All/Home/Restaurant segment + tri-state tag filter chips.
   **Empty state:** zero items → a short "Add your first meals →" prompt linking
   to Catalog.
2. **Log** — an **"Upcoming"** section pinned on top (future-dated entries,
   soonest first), then reverse-chronological past history, grouped by date; a
   date may carry more than one entry. Every entry is editable and deletable
   (§6 — change item, date, note, or remove).
3. **Catalog** — add/edit home meals and restaurants; attach tags inline; the
   restaurant form carries the Google Places search box. Archive action. The
   desktop-heavy screen.
4. **Tags** — lightweight: autocomplete + rename/merge. No taxonomy management.
5. **Login** — single password field.

### Tag filtering (tri-state)

The Tonight filter bar uses tappable tag chips, each cycling
**off → include → exclude → off**. Include = show only items carrying that tag;
exclude = hide items carrying it. The kind segment and the tag filters **AND
together** — an item must satisfy the kind filter *and* all include tags *and*
none of the exclude tags. A hint line states the active filter in words.

## 10. Non-goals (explicit — protect the wedge)

No recipes. No ingredient lists or grocery lists. No nutrition / calorie
tracking. No AI / LLM suggestion. No forward *weekly* meal planning (single
future-dated entries are in scope; a planning calendar/grid is not). No
per-family-member preference modeling. No opening-hours / live-availability
integration. No real multi-user accounts. No per-dinner rating. If a feature
pulls toward "meal planner," it is out.

## 11. Open / deferred

- **Tag-entry UX** — default: a chip/token input with autocomplete over existing
  tags plus create-new. Confirm after real tagging.
- **Tag recency on a brand-new item** — a new meal tagged "pasta" inherits
  "pasta last used 9 days ago" from the log. Treated as correct; confirm it
  feels right after a couple weeks, or raise `W_ITEM` vs `W_TAG`.
- **Tag-hygiene aggressiveness** — how often merge is actually needed is a feel
  call after a few weeks of free-form tagging.

## 12. Success criteria

- Opening "Tonight" on a phone and picking a dinner takes under 15 seconds.
- Every ranked row shows a correct, plain-English explanation chip.
- The same log and catalog are visible and editable from phone and desktop.
- After ~2 weeks of use, the variety enforcer visibly surfaces neglected
  categories.
- The user actually opens it most evenings.

## 13. Next steps

1. **Seed the real catalog first** (see below) — before any code.
2. Scaffold: Next.js + TypeScript + Tailwind; add Drizzle + Postgres; write the
   4-table schema and first migration.
3. Build **Catalog** (need item + tag entry before anything is testable);
   import the seed list. Wire Google Places autofill into the restaurant form.
4. Build **Tonight** with the v1 ranking algorithm and explanation chips.
   Reference the approved wireframe (below).
5. Add the **pick = log** server action, the "log for another date" path, and
   the **Log** screen with the Upcoming section and full edit/delete.
6. Add the tri-state tag filters and the **Tags** rename/merge screen.
7. Add the shared-password gate. Build the Dockerfile with an app-only
   entrypoint (no migration step); deploy to k8s.
8. Dogfood for two weeks; tune `W_ITEM` / `W_TAG` by feel.

### Data import (replaces the hand-seed assignment)

There is a **database from a prior version of this app** carrying real catalog
+ log history. That data — not a fresh hand-seed — is the v1 starting point. It
already supplies what the hand-seed was for: it fuels the ranking (no cold
start) and is real evidence on free-form tagging (see "tag finding" below).

The prior app was Prisma-backed with three tables — `Meal`, `Restaurant`,
`Dinner` — holding 7 meals, 21 restaurants, 67 dinners (2026-01-22 → 2026-05-14).
Schema inspection confirmed the import is clean: **no orphan dinners** (every
`Dinner` has exactly one of `mealId`/`restaurantId` set), **no duplicate
`(item, date)` pairs** (the §5 `UNIQUE(item_id, eaten_on)` constraint will not
be violated), and **no restaurant has both `orderUrl` and `menuUrl`** set.

Write the import as a **one-off script**, not an ongoing feature. It runs
inside a **single transaction**: any failure rolls back entirely, leaving the
DB untouched, so after fixing the offending row the script is simply re-run
from scratch. It targets a fresh empty DB, so no upsert / idempotency
machinery is needed.

**Mapping:**

| Prior | v1 |
|---|---|
| `Meal` | `items`, `kind='home'` |
| `Restaurant` | `items`, `kind='restaurant'` |
| `Dinner` | `dinner_log` |
| `*.id` (text cuid) | fresh `uuid`; keep an old→new id map to rewire FKs |
| `name`, `notes`, `createdAt` | `name`, `notes`, `created_at` |
| `hidden` | `active = NOT hidden` (inverted) |
| `Restaurant.phoneNumber` | `items.phone` |
| `Restaurant.orderUrl` / `menuUrl` | `items.url = coalesce(orderUrl, menuUrl)` — never both populated, so no loss |
| `Meal`/`Restaurant.tags` (`text[]`) | normalized into `tags` + `item_tags`; lower + trim each tag, dedupe across all items |
| `Dinner.date` | `dinner_log.eaten_on` |
| `Dinner.notes` | `dinner_log.note` |
| `Dinner.type` + `mealId`/`restaurantId` | `dinner_log.item_id` (the mapped item). `Dinner.type` itself is **dropped** — redundant with `items.kind`. |

**Import-time defaults for fields the prior schema lacks:**

- `dinner_log.created_at` — prior `Dinner` has no `createdAt`; set it to the
  dinner's `date` at local midnight (`APP_TZ`), so it stays historically
  sensible rather than collapsing to import time.
- Restaurant `address` / `lat` / `lng` / `google_place_id` / `maps_url` — no
  prior data; import as `null`. Backfill later via Places autofill (§8) if
  wanted.
- `Meal` has no URL field; home items import with `url = null`.

**Tag finding (premise 4 — confirmed).** The 19 distinct prior tags show **no
case/spelling drift** — free-form tagging converged. The Tags screen's
rename/merge tooling is therefore low-priority for v1. Note the tag set also
includes per-person / context tags (`helen: burger`, `sonia: pizza`, `swim`)
alongside cuisines; these import as ordinary free-form tags and the variety
engine treats them like any other — no conflict with the "no per-person
preference *modeling*" non-goal (§10).

## 14. Approved wireframe

The "Tonight" dashboard layout was wireframed during the office-hours session:

- HTML: `~/.gstack/projects/n1mmy-pick-me-a-dinner-2/designs/mockup-20260515/tonight-wireframe.html`
- Phone render: `designs/mockup-20260515/tonight-phone.png`
- Desktop render: `designs/mockup-20260515/tonight-desktop.png`

It establishes: explanation chip directly under each name; quiet Home/Restaurant
badges; tag chips carrying per-tag recency with overdue tags in accent color; a
sticky filter zone with the All/Home/Restaurant segment and tri-state tag chips;
a calm warm palette with thin dividers and no nested cards.

## 15. Testing

Test framework: **Vitest** — fast, TypeScript-native, the standard for
Next.js + TS. **No browser E2E in v1**; the three cross-component flows
(pick→log, login→gated route, log-edit date conflict) are verified by hand
until a Playwright suite is added in a follow-up. Coverage target: every pure
function and every server action has a test.

**Pure logic (§7) — unit tests, the highest-value coverage:**

- `daysSince(date | null)` — `null` → CAP; normal `today - date`; capped when
  older than CAP; a guard for a future date (should never reach it).
- Epoch-day conversion in `APP_TZ` — SQL `date` → epoch-day, and correctness
  across a DST boundary.
- `lastEaten` / `lastTagUse` — most-recent non-future row; future rows
  excluded; `null` when there is no history.
- `itemScore` — tagged (`variety = mean(tagDays)`), tagless
  (`variety = anti_repeat`), and cold start (every item ties at
  `(W_ITEM + W_TAG) * CAP`).
- `explanationChip` — tag branch names the largest-`daysSince` tag; item branch
  names item recency; **a tagless item always uses the item branch** (explicit
  regression guard for the §7 rule).
- Overdue styling triggers exactly at `daysSince >= OVERDUE_THRESHOLD`.
- Tonight sort: descending by score, with the cold-start name fallback.

**Server actions / integration tests:**

- `pick = log` — inserts a row for today; a double-tap is a no-op upsert;
  log-for-another-date with a past and a future date.
- Log edit/delete — change item, date, note, delete; an edit that violates
  `UNIQUE(item_id, eaten_on)` is rejected with an inline error.
- Catalog — archive sets `active = false`; hard-delete is blocked by
  `ON DELETE RESTRICT` for a logged item and allowed for an unlogged one.
- Tags — rename; merge runs in one transaction; a mid-merge failure rolls back.
- Tri-state tag filter — off → include → exclude cycle; the kind segment and
  the tag filters AND together.
- Auth — correct password establishes the session; wrong password → inline
  error; middleware redirects an unauthenticated / expired request to `/login`.
- Places — autofill populates the fields; key unset hides the box; a request
  failure shows the fallback notice (§8).

**Import script (§13):**

- Mapping correctness — `hidden → active` inverted, `orderUrl` / `menuUrl`
  coalesced into `url`, tags normalized and deduped, `created_at` set to the
  dinner's date at local midnight.
- The whole import rolls back on any failure (single transaction).

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | not run (optional) |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | outside voice skipped by user |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 9 issues, 0 critical gaps, 0 unresolved |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | not run (optional) |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | not run (optional) |

Eng review (2026-05-15) resolved 9 issues across 10 decisions: D1 iron-session
auth, D2 GHCR build workflow, D3 startup schema check, D4 tagless chip-rule fix,
D5 tag normalization left as-is, D6 Places failure fallback, D7 single-transaction
import, D8 dropped the `W_FAV` term, D9 Vitest test section added, D10 no TODOS.md.

- **UNRESOLVED:** 0 — every review question was answered.
- **VERDICT:** ENG CLEARED — ready to implement. CEO and Design reviews are
  optional and were not run.
