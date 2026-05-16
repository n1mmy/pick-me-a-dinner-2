# Pick Me a Dinner — v1 Plan (canonical)

A small personal web app to help decide what's for family dinner. Supports
restaurants and home-cooked meals, keeps a log of past **and planned** dinners,
tags every option, and surfaces a "smart" variety-driven suggestion list.

Status: **canonical** — merged source of truth. Pre-implementation, greenfield.
This plan supersedes `old/initial-sketch-grill-me.md` and
`old/initial-sketch-office-hours.md`, which are kept only as historical source
material. It uses the office-hours plan as its base, with four user-directed
overrides folded in (hosting, future-dating, Google Places, editable history).

> **Domain docs.** Project vocabulary lives in [`CONTEXT.md`](../CONTEXT.md) —
> use those canonical terms (Option, Log entry, Dinner, Planned dinner). The
> architecture decisions behind this plan are recorded in
> [`docs/adr/`](../docs/adr/): ADR-0001 unified `options` table, ADR-0002
> single shared password, ADR-0003 ranking computed in TypeScript.

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

## 4. Authentication & security  *(iron-session sealed cookie, no lockout)*

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
options
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

option_tags
  option_id       uuid fk -> options  ON DELETE CASCADE
  tag_id          uuid fk -> tags   ON DELETE CASCADE
  pk (option_id, tag_id)

dinner_log
  id              uuid pk
  option_id       uuid fk -> options  ON DELETE RESTRICT   -- see lifecycle rules
  eaten_on        date               -- may be PAST or FUTURE (see §6);
                                      -- multiple options per date allowed
  note            text null
  created_at      timestamptz
  UNIQUE (option_id, eaten_on)          -- the SAME option can't be logged twice on
                                      -- one date; DIFFERENT options on one date
                                      -- is fine — that's a real dinner
```

`dinner_log` is the single source of truth for all recency. Per-option recency =
most recent **non-future** `eaten_on` for that option. Per-tag recency = most
recent **non-future** `eaten_on` across all options carrying that tag (via the
`option_tags` join). See §7 for why future rows are excluded.

### Lifecycle rules

- **Deactivate, don't delete logged options.** An option with any `dinner_log` row
  cannot be hard-deleted (`ON DELETE RESTRICT` enforces this). The Catalog
  screen offers "Archive" → sets `active = false`; archived options vanish from
  Tonight and the default Catalog list but still render in Log history. An option
  with zero log rows may be hard-deleted.
- **`pick = log` appends; multiple options per date are allowed.** A real dinner
  is sometimes two restaurants, or takeout plus some home cooking. Tapping "Pick
  tonight" inserts a `dinner_log` row for today; picking another option the same
  evening adds a second row. The only thing blocked is logging the *same* option
  twice on one date: `pick = log` upserts on `(option_id, eaten_on)`, so an
  accidental double-tap is a harmless no-op.
- **No tag-management screen in v1.** Tags are created and changed only through
  the autocomplete token input when adding or editing a Catalog option (§9).
  There is no global rename or merge UI — the prior database's 19 tags showed
  zero case/spelling drift (§13), so that tooling addressed a problem the real
  data does not have. A tag left with no options simply stops appearing in the
  Tonight filter; it is harmless. A real rename need, if it appears after weeks
  of use, is a follow-up — not v1. (`ON DELETE CASCADE` on `option_tags` still
  applies, so hard-deleting an unlogged option cleans up its tag links.)
- **Tag edits are not retroactive.** Per-option and per-tag recency are computed
  from an option's *current* tags, not the tags it had when a past dinner was
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
- `UNIQUE (option_id, eaten_on)` applies to past, present, and future rows alike.

### Editing & correcting history  *(explicit requirement)*

Any logged entry — past, today, or upcoming — is fully editable on the Log
screen. The user can:

- **Change the option** (mis-tapped, or the plan changed).
- **Change the date** (`eaten_on`) — including moving an entry between the past
  history and the Upcoming section.
- **Edit the note.**
- **Delete the entry** entirely (e.g. a plan that didn't happen, or a pick the
  family didn't actually eat).

Edits that would violate `UNIQUE (option_id, eaten_on)` — e.g. changing an
entry's date onto a date that option is already logged for — are rejected with an
inline error rather than silently merged.

## 7. Suggestion engine — recency-driven ranking

The Tonight list is the full active catalog (after filters), sorted **descending**
by a score combining two signals — **per-option recency** (how long since this
exact option was eaten) and **per-tag recency** (how long since any option
carrying that tag was eaten). Higher score = more "due", floats to the top.

**Future rows are excluded.** All recency in this section is computed only from
`dinner_log` rows with `eaten_on <= today` (local). Planned/future dinners do
not influence the ranking until their date arrives.

**Where it runs.** Computed in TypeScript, not SQL. For a personal catalog (tens
of options, hundreds of log rows) the dataset is tiny. The Tonight server
component fetches `options` (active), `option_tags`, and the non-future `dinner_log`
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
day, not the server's UTC day. `lastEaten(option)` and `lastTagUse(t)` are the
per-option / per-tag recency dates from §5; both return `null` when the option / tag
has never appeared in a non-future `dinner_log` row.

**Score:**

```
optionScore(option):
    anti_repeat = daysSince(lastEaten(option))           // 0..CAP

    tagDays     = [ daysSince(lastTagUse(t)) for t in tags(option) ]
    variety     = tagDays.length === 0
                    ? anti_repeat                      // tagless option: variety
                                                       // term mirrors anti-repeat
                    : mean(tagDays)                    // 0..CAP

    return  W_OPTION * anti_repeat
          + W_TAG  * variety
```

Both terms are in the same unit (capped days, 0..CAP), so they combine cleanly.

**Starting weights** (live in one `ranking.config.ts`, tuned by feel):

```
W_OPTION = 1.0    // per-option recency weight
W_TAG    = 1.0    // per-tag recency weight
```

A favorite term is **not in v1** — no `W_FAV`, no `favoriteBonus` stub: a
function that exists only to be multiplied by zero is premature abstraction.
When added later it is a third term expressed in the same capped-day unit
(e.g. `min(CAP, totalTimesEaten * k)`), never a raw count. Defer until there is
real log data to tune against.

**Explanation chip** — one per row, derived deterministically from the score:

- If the option **has tags** AND `W_TAG * variety >= W_OPTION * anti_repeat` (tag
  term dominates, ties included): the chip names the **single tag with the
  largest `daysSince`** → "No fish in 18 days".
- Otherwise (option term dominates, **or the option has no tags**): the chip names
  the option's own recency → "Last had 28 days ago". A tagless option always uses
  this branch — it has no tag to name, so the tag branch is never reached for
  it even on a score tie. If the option has **never** been eaten (`lastEaten` is
  `null`), this branch reads **"Never eaten yet"** — never a false "Last had 60
  days ago".
- The "Family favorite · ..." chip variant is deferred with the favorite term.

The chip is a **product requirement**: if the ranking can't explain itself in
one plain-English line, it isn't done.

**"Overdue" tag styling.** A tag chip renders in the accent color when
`daysSince(lastTagUse(t)) >= OVERDUE_THRESHOLD` (`= 14`, in `ranking.config.ts`).
Purely visual; does not affect the score.

**Cold start.** With zero non-future `dinner_log` rows, every option scores
`(W_OPTION + W_TAG) * CAP` — a flat tie. Tonight then falls back to ordering by
`options.name` until enough history exists to differentiate.

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

v1 has **4 screens**: Tonight, Log, Catalog, Login. Tonight, Log and Catalog
are reachable from a persistent bottom navigation bar (3 destinations); Login
sits outside the authenticated gate. Per-screen layout detail and the approved
mockups are in §19; the shared visual system is §16.

1. **Tonight** (home, primary) — the ranked active catalog as a **flat, uniform
   list**. The uniform list is intentional: the app supplies context and
   ranking, the human scans the whole list — often for inspiration — and
   decides. Do **not** add lead-option prominence or collapse the long tail;
   surfacing every option is the point. Each row: name, quiet Home/Restaurant
   badge, one explanation chip, tag chips showing per-tag recency, a one-tap
   "Pick tonight" action, and a secondary "Log another date" path (§6).
   Tag-recency on a chip always shows as `Nd` days (e.g. "fish 18d"), capped at
   `60d+`; overdue tags render in the accent color. Hierarchy: name →
   explanation chip → tag chips. Sticky filter zone: All/Home/Restaurant
   segment + tri-state tag filter chips.
   **Empty state:** zero options → a short "Add your first meals →" prompt linking
   to Catalog.
2. **Log** — past and planned dinners. An **"Upcoming"** section sits on top as
   a compact, capped strip (future-dated entries, soonest first) so it never
   buries today; below it, reverse-chronological past history grouped by date —
   a date may carry more than one entry. Hierarchy per entry: date header →
   option name → note. Every entry is editable and deletable **inline** — the row
   expands in place into an edit form (§6: change option, date, note, or remove).
3. **Catalog** — add/edit home meals and restaurants; tags attached inline via
   an autocomplete token input; the restaurant form carries the Google Places
   search box. Add/edit happens **inline** — the row expands in place into the
   form, the same on phone and desktop. Hierarchy: Home and Restaurant
   sections, each row name → tag chips. Archive action, plus hard-delete for
   unlogged options.
4. **Login** — a quiet, centered single password field (§4). Wordmark reads
   **"Pick Me a Dinner"**; no marketing copy, no tagline.

### Tag filtering (tri-state)

The Tonight filter bar uses tappable tag chips, each cycling
**off → include → exclude → off**. Include = show only options carrying that tag
(chip shows a leading `+`); exclude = hide options carrying it (leading `−`, with
a strikethrough). The kind segment and the tag filters **AND together** — an
option must satisfy the kind filter *and* all include tags *and* none of the
exclude tags. A hint line states the active filter in words, and each chip's
accessible name announces its state ("pasta, included").

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
- **Tag recency on a brand-new option** — a new meal tagged "pasta" inherits
  "pasta last used 9 days ago" from the log. Treated as correct; confirm it
  feels right after a couple weeks, or raise `W_OPTION` vs `W_TAG`.
- **Tag rename / merge** — dropped from v1 entirely; there is no Tags screen
  (see §5, §9). The prior data showed no tag drift. If free-form tagging
  diverges after weeks of use, a lightweight rename is a follow-up.

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
3. Build **Catalog** (need option + tag entry before anything is testable);
   import the seed list. Wire Google Places autofill into the restaurant form.
4. Build **Tonight** with the v1 ranking algorithm and explanation chips.
   Reference the approved wireframe (below).
5. Add the **pick = log** server action, the "log for another date" path, and
   the **Log** screen with the Upcoming section and full edit/delete.
6. Add the tri-state tag filters on Tonight. (No Tags screen — see §5, §9.)
7. Add the shared-password gate. Build the Dockerfile with an app-only
   entrypoint (no migration step); deploy to k8s.
8. Dogfood for two weeks; tune `W_OPTION` / `W_TAG` by feel.

### Data import (replaces the hand-seed assignment)

There is a **database from a prior version of this app** carrying real catalog
+ log history. That data — not a fresh hand-seed — is the v1 starting point. It
already supplies what the hand-seed was for: it fuels the ranking (no cold
start) and is real evidence on free-form tagging (see "tag finding" below).

The prior app was Prisma-backed with three tables — `Meal`, `Restaurant`,
`Dinner` — holding 7 meals, 21 restaurants, 67 dinners (2026-01-22 → 2026-05-14).
Schema inspection confirmed the import is clean: **no orphan dinners** (every
`Dinner` has exactly one of `mealId`/`restaurantId` set), **no duplicate
`(option, date)` pairs** (the §5 `UNIQUE(option_id, eaten_on)` constraint will not
be violated), and **no restaurant has both `orderUrl` and `menuUrl`** set.

Write the import as a **one-off script**, not an ongoing feature. It runs
inside a **single transaction**: any failure rolls back entirely, leaving the
DB untouched, so after fixing the offending row the script is simply re-run
from scratch. It targets a fresh empty DB, so no upsert / idempotency
machinery is needed.

**Mapping:**

| Prior | v1 |
|---|---|
| `Meal` | `options`, `kind='home'` |
| `Restaurant` | `options`, `kind='restaurant'` |
| `Dinner` | `dinner_log` |
| `*.id` (text cuid) | fresh `uuid`; keep an old→new id map to rewire FKs |
| `name`, `notes`, `createdAt` | `name`, `notes`, `created_at` |
| `hidden` | `active = NOT hidden` (inverted) |
| `Restaurant.phoneNumber` | `options.phone` |
| `Restaurant.orderUrl` / `menuUrl` | `options.url = coalesce(orderUrl, menuUrl)` — never both populated, so no loss |
| `Meal`/`Restaurant.tags` (`text[]`) | normalized into `tags` + `option_tags`; lower + trim each tag, dedupe across all options |
| `Dinner.date` | `dinner_log.eaten_on` |
| `Dinner.notes` | `dinner_log.note` |
| `Dinner.type` + `mealId`/`restaurantId` | `dinner_log.option_id` (the mapped option). `Dinner.type` itself is **dropped** — redundant with `options.kind`. |

**Import-time defaults for fields the prior schema lacks:**

- `dinner_log.created_at` — prior `Dinner` has no `createdAt`; set it to the
  dinner's `date` at local midnight (`APP_TZ`), so it stays historically
  sensible rather than collapsing to import time.
- Restaurant `address` / `lat` / `lng` / `google_place_id` / `maps_url` — no
  prior data; import as `null`. Backfill later via Places autofill (§8) if
  wanted.
- `Meal` has no URL field; home options import with `url = null`.

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
- `optionScore` — tagged (`variety = mean(tagDays)`), tagless
  (`variety = anti_repeat`), and cold start (every option ties at
  `(W_OPTION + W_TAG) * CAP`).
- `explanationChip` — tag branch names the largest-`daysSince` tag; option branch
  names option recency; **a tagless option always uses the option branch** (explicit
  regression guard for the §7 rule).
- Overdue styling triggers exactly at `daysSince >= OVERDUE_THRESHOLD`.
- Tonight sort: descending by score, with the cold-start name fallback.

**Server actions / integration tests:**

- `pick = log` — inserts a row for today; a double-tap is a no-op upsert;
  log-for-another-date with a past and a future date.
- Log edit/delete — change option, date, note, delete; an edit that violates
  `UNIQUE(option_id, eaten_on)` is rejected with an inline error.
- Catalog — archive sets `active = false`; hard-delete is blocked by
  `ON DELETE RESTRICT` for a logged option and allowed for an unlogged one.
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

## 16. Design foundation  *(added by /plan-design-review 2026-05-16)*

§14's Tonight visual language is the **project-wide** design system — every
screen uses it. Implement as CSS custom properties so no screen drifts.

**Color** — semantic CSS variables (from the §14 wireframe):

```
--bg       #faf8f4   page background, flat
--surface  #ffffff   inputs, the white field/chip surface
--ink      #2c2823   primary text
--muted    #8a8278   secondary text, meta
--line     #e4ded4   1px hairline dividers
--accent   #c4502e   primary buttons, overdue/accent text
--chip     #f0ebe1   explanation-chip background
--home     #3f6b4a   Home badge
--rest     #7a5a2e   Restaurant badge
--danger   #b23b25   destructive actions, exclude chip, errors
--success  #3f6b4a   "Logged" confirmation (reuses the home green)
```

**Type** — system stack `-apple-system, system-ui, sans-serif`, base 15px/1.5.
Scale: 12 (meta/labels) · 13 (chips/secondary) · 15 (body) · 17 (option name) ·
26 (h1). Weights: 400 body · 600 emphasis · 650 h1. The system stack is a
deliberate choice for a self-hosted personal app — zero font-loading, native
phone feel — not an oversight.

**Spacing** — 4px base; common steps 4 / 6 / 8 / 12 / 16 / 22.

**Layout primitive** — content is a single centered column: max-width 560px on
phone, 700px on desktop. Rows are separated by 1px `--line` hairline dividers on
the flat `--bg`. **No nested cards, no shadows, no border-boxed groups** — the
hairline-divided row on a flat background is the only list unit.

**Controls** — primary button: `--accent` background, white text, 9px radius,
~10–14px padding. Inputs: `--surface` background, 1px `--line` border, ~8px
radius, a visible `<label>` above (never placeholder-as-label). Badges:
uppercase 11px, 4px radius. Chips: pill (999px radius), `--chip` background.

**Motion** — state-confirming only: a row marking "Logged ✓" on pick, the
filtered list re-sorting, an edit row expanding/collapsing. No shimmer, no
ambient or decorative motion, no animated backgrounds.

## 17. Interaction states  *(added by /plan-design-review 2026-05-16)*

Every screen specifies loading, empty, error and success. States describe what
the **user sees**, not backend behavior.

| Screen | Loading | Empty | Error | Success |
|---|---|---|---|---|
| Tonight | calm placeholder rows, no shimmer | zero options → "Add your first meals →" linking to Catalog | pick fails → inline message on the row, option not consumed | picked row briefly marks "Logged ✓" in `--success`, then re-sorts |
| Log | calm placeholder rows | no dinners → "No dinners logged yet — pick one on Tonight →" | date conflict on edit → inline error directly under the date field, input preserved | edited row collapses with a quiet "Saved" |
| Catalog | calm placeholder rows | zero options → "Add a meal or restaurant to get started" | blank name → inline field error; delete blocked by a log row → friendly inline "In your log — archive instead", never a 500; Places failure → §8 fallback notice | saved option appears/updates in place |
| Login | submit button shows a disabled/pending state | n/a | wrong password → inline error under the field, field cleared | redirect to Tonight |

**Destructive actions** use one pattern: an **inline confirm** step (a
"Delete · Cancel" / "Archive · Cancel" pair appears in place) before acting —
no modal dialog, no undo-toast infrastructure. Applies to deleting a log entry,
archiving a catalog option, and hard-deleting an unlogged catalog option.

## 18. Responsive & accessibility  *(added by /plan-design-review 2026-05-16)*

**Responsive** — a single centered column at every size: max-width 560px on
phone, 700px on desktop, breakpoint at 720px. Tonight, Log and Login are
single-column on desktop too; the column simply widens. A desktop
list-plus-edit-panel layout for Catalog was considered and **deferred — not in
v1 scope** (inline-expand works on both).

**Touch targets** — every tap target is at least 44×44px: filter chips, the
"Pick tonight" button, nav options, row actions.

**Tri-state filter chip** — state is legible without color: included chips
carry a leading `+`, excluded chips a leading `−` and a strikethrough. Each
chip exposes its state to assistive tech via its accessible name.

**Keyboard** — visible focus rings on every interactive element, logical tab
order, Enter submits the Login form, Enter/Space activates "Pick tonight".

**Contrast** — verified to WCAG AA before ship: `--accent` used as small text
(overdue tag recency) must reach 4.5:1 on `--bg`; white-on-`--accent` button
text must reach 3:1. If `--accent`-on-`--bg` falls short for small text, darken
the accent for text use.

**Semantics** — Tonight's ranked list is an ordered list (`<ol>`); explanation
chips and tag-recency are real text (not icon-only), so screen readers read
them; all form inputs have visible associated `<label>`s.

## 19. Approved mockups  *(added by /plan-design-review 2026-05-16)*

Generated and selected during /plan-design-review. These are the visual
reference for implementation; build to them with the corrections noted. Paths
under `designs/` are relative to `~/.gstack/projects/n1mmy-pick-me-a-dinner-2/`.

| Screen | Mockup | Corrections to apply |
|---|---|---|
| Tonight | `designs/mockup-20260515/tonight-wireframe.html` (+ phone/desktop PNGs) | none — established in §14 |
| Catalog | `designs/v1-screens-20260516/catalog/variant-A.png` | drop the per-row circular icon (the Home/Restaurant badge suffices); bottom-nav tabs are **Tonight / Log / Catalog** only — no Plan, Family or Settings |
| Log | `designs/v1-screens-20260516/log/variant-A.png` | drop the sentimental "Good food. Good company." footer; keep Upcoming a compact capped strip (§9) |
| Login | `designs/v1-screens-20260516/login/variant-A.png` | wordmark text is "Pick Me a Dinner"; no tagline |

The Tags screen was cut during this review — its mockup is discarded.

## 20. Design review — scope notes  *(/plan-design-review 2026-05-16)*

**What already exists / reused** — the §14 Tonight wireframe and its warm
palette, hairline-divider layout, quiet badges and recency chips. This review
promoted that language to the project-wide §16 foundation rather than inventing
a new one.

**NOT in scope (considered, deferred):**

- Tags management screen (rename / merge) — cut; prior data showed no tag drift.
- Lead-option prominence / collapsed long tail on Tonight — rejected; the uniform
  scannable list is intentional (§9). The app supplies context; the human picks.
- Desktop list-plus-edit-panel layout for Catalog — inline-expand suffices.
- Undo-toast infrastructure — inline confirm chosen instead (§17).
- First-run onboarding hint for the ranking chips — unnecessary; the imported
  database is the household's own real history.
- A custom display typeface — the system font stack is deliberate (§16).

## Implementation Tasks

Synthesized from this review's findings. Each task derives from a specific
finding above. Run with Claude Code or Codex; checkbox as you ship. (Greenfield
repo — file paths resolve once the Next.js app is scaffolded per §13.)

- [ ] **T1 (P1, human: ~3h / CC: ~20min)** — design-foundation — Implement the §16 design foundation as CSS variables + Tailwind theme tokens
  - Surfaced by: Pass 5 — no global visual system; §14 was scoped to Tonight only
  - Files: `app/globals.css`, `tailwind.config.ts`
  - Verify: all 4 screens render from the shared tokens, no per-screen hex literals
- [ ] **T2 (P1, human: ~4h / CC: ~30min)** — interaction-states — Implement the §17 per-screen loading / empty / error / success states
  - Surfaced by: Pass 2 — only the Tonight empty state was specified
  - Verify: each screen's four states reachable in manual testing
- [ ] **T3 (P1, human: ~2h / CC: ~15min)** — destructive-actions — Inline-confirm pattern for delete log entry / archive / hard-delete; friendly delete-blocked message
  - Surfaced by: Pass 2 — destructive actions had no confirmation; `ON DELETE RESTRICT` would surface as a 500
  - Verify: deleting a logged option shows the inline "archive instead" message, not an error page
- [ ] **T4 (P1, human: ~2h / CC: ~20min)** — tonight-a11y — Tri-state filter chip: `+`/`−` prefixes, accessible state names, 44px touch targets
  - Surfaced by: Pass 6 — chip state was color-only; no touch-target spec
  - Verify: chip state distinguishable in grayscale; screen reader announces state
- [ ] **T5 (P2, human: ~30min / CC: ~5min)** — ranking-chip — Explanation chip reads "Never eaten yet" when `lastEaten` is null
  - Surfaced by: Pass 7 — chip would falsely read "Last had 60 days ago" for never-eaten options
  - Verify: unit test for the null-recency branch (extends §15 `explanationChip` tests)
- [ ] **T6 (P2, human: ~1h / CC: ~10min)** — catalog — Drop the per-row circular icon; bottom-nav = Tonight / Log / Catalog only
  - Surfaced by: Pass 4 / Pass 1 — icons-in-circles slop; mockup nav had off-spec Plan/Family tabs
  - Verify: nav shows exactly 3 destinations
- [ ] **T7 (P2, human: ~3h / CC: ~20min)** — responsive-a11y — Responsive column rules, keyboard focus/tab order, WCAG AA contrast verification
  - Surfaced by: Pass 6 — no viewport, keyboard, or contrast specs
  - Verify: contrast checker passes on `--accent` text pairs; full keyboard traversal of Tonight
- [ ] **T8 (P3, human: ~30min / CC: ~5min)** — log — Drop the sentimental footer; keep Upcoming a compact capped strip
  - Surfaced by: Pass 4 / Pass 1 — happy-talk footer; Upcoming could bury today
  - Verify: a week of future entries does not push today's history below the fold
- [ ] **T9 (P3, human: ~15min / CC: ~5min)** — login — Login wordmark reads "Pick Me a Dinner"; no tagline
  - Surfaced by: Pass 7 — mockups invented "family dinner" / "family table" names
  - Verify: Login renders the correct app name

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | not run (optional) |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | not run; design outside voices ran instead (see below) |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 9 issues, 0 critical gaps, 0 unresolved (commit 18adbe2 — predates this design review) |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | score 5/10 → 9/10, 10 decisions, 0 unresolved |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | not run (optional) |

Eng review (2026-05-15) resolved 9 issues across 10 decisions: D1 iron-session
auth, D2 GHCR build workflow, D3 startup schema check, D4 tagless chip-rule fix,
D5 tag normalization left as-is, D6 Places failure fallback, D7 single-transaction
import, D8 dropped the `W_FAV` term, D9 Vitest test section added, D10 no TODOS.md.

Design review (2026-05-16) generated mockups for the 4 un-wireframed screens,
ran outside voices, and ran 7 passes. Initial design score 5/10 → 9/10.
Decisions: cut the Tags screen (scope reduction — no tag drift in prior data);
Tonight stays a flat uniform list (intentional — the app gives context, the
human picks); inline-confirm for destructive actions; inline-expand editing;
added §16 design foundation, §17 interaction states, §18 responsive & a11y,
§19 approved mockups. The plan dropped from 5 screens to 4.

- **CROSS-MODEL:** design review ran outside voices — Codex (GPT) and an
  independent Claude subagent. 0 hard rejections; both converged on the same
  #1 finding (only Tonight was designed; no global visual system), resolved by
  §16 + §19.
- **UNRESOLVED:** 0 — every review question was answered.
- **STALENESS:** eng review predates this design review's plan changes (Tags
  screen removal, §16–20 added). The change is scope-reducing and adds no new
  architecture, so eng clearance still holds; a light eng re-check is optional.
- **VERDICT:** ENG + DESIGN CLEARED — ready to implement. CEO and DX reviews are
  optional and were not run.
