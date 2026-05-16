# PRD: Pick Me a Dinner — v1

Status: ready-for-agent

Source of truth: [`plans/v1-plan.md`](../../plans/v1-plan.md) (canonical, eng +
design review CLEARED). Vocabulary: [`CONTEXT.md`](../../CONTEXT.md). Decisions:
[`docs/adr/`](../../docs/adr/) — ADR-0001 unified `options` table, ADR-0002
single shared password, ADR-0003 ranking computed in TypeScript.

This PRD synthesizes the canonical plan into a buildable spec. Where the plan
and this PRD agree, the plan governs; this document adds the module/testing
shape for an implementing agent.

---

## Problem Statement

Every evening the Household has to decide what's for dinner, and the decision is
made badly because nobody can remember what's already been eaten this week or
which restaurants are even in play. The friction is the *choosing* — standing in
the kitchen around 5pm with no context. Existing meal apps over-solve this with
recipes, grocery lists, and weekly planners that the Household does not want;
they want a sharp tool that does one job.

## Solution

A small personal web app that puts the right context in front of the decider,
fast. It keeps one Catalog of Options — Home meals and Restaurants as
first-class equals — and one Log of every Dinner. The home screen, **Tonight**,
shows the active Catalog ranked by **Score** (how overdue each Option is by
per-Option and per-Tag recency), and every row carries an **Explanation chip**
in plain English ("No fish in 18 days", "Never eaten yet"). The human still
picks; the app just removes the "what have we even had lately" guesswork.
Picking is one tap and *is* logging it. The Log is fully editable history plus a
lightweight Planned-dinner surface. Access is gated by one shared password.

## User Stories

### Tonight & picking

1. As a member of the Household, I want to open Tonight and see every active
   Option ranked, so that I can scan the whole list for inspiration and decide.
2. As a member of the Household, I want each Tonight row to show one
   plain-English Explanation chip, so that I understand why it ranks where it
   does without doing the math myself.
3. As a member of the Household, I want a row that has never been eaten to read
   "Never eaten yet", so that I am not misled by a false "Last had 60 days ago".
4. As a member of the Household, I want Tonight to be a flat, uniform list with
   no lead-option prominence and no collapsed long tail, so that no Option is
   hidden from me.
5. As a member of the Household, I want to tap "Pick tonight" on a row, so that
   tonight's Dinner is logged in one tap with `eaten_on = today`.
6. As a member of the Household, I want a picked row to briefly mark "Logged ✓"
   and then re-sort, so that I get immediate confirmation the Pick registered.
7. As a member of the Household, I want to Pick a second Option the same
   evening, so that a multi-Option Dinner (takeout plus some home cooking) is
   recorded as two Log entries on one date.
8. As a member of the Household, I want a double-tap on "Pick tonight" to be a
   harmless no-op, so that I never create a duplicate Log entry by accident.
9. As a member of the Household, I want a Tonight row to also offer a "Log
   another date" path, so that I can backfill a forgotten Dinner or plan ahead
   from the same screen.
10. As a member of the Household, I want each Tonight row to show its Tags with
    per-Tag recency (e.g. "fish 18d"), so that I can see at a glance which
    cuisines are stale.
11. As a member of the Household, I want overdue Tags rendered in the accent
    color, so that neglected categories stand out visually.
12. As a member of the Household, I want a quiet Home/Restaurant badge on each
    row, so that I can tell a cooked meal from eating out at a glance.
13. As a member of the Household, I want Tonight to fall back to alphabetical
    order during Cold start, so that an empty Log still gives a usable list.
14. As a member of the Household, I want a "Add your first meals →" prompt when
    the Catalog is empty, so that I know what to do on first run.

### Tag filtering on Tonight

15. As a member of the Household, I want a sticky All/Home/Restaurant segment on
    Tonight, so that I can narrow the list to just cooking or just eating out.
16. As a member of the Household, I want tappable Tag filter chips that cycle
    off → include → exclude → off, so that I can shape the list to what I'm in
    the mood for.
17. As a member of the Household, I want an include chip to show only Options
    carrying that Tag and an exclude chip to hide them, so that filtering is
    precise.
18. As a member of the Household, I want the kind segment and all Tag filters to
    AND together, so that an Option must satisfy every active filter to show.
19. As a member of the Household, I want a hint line stating the active filter
    in words, so that I always know what I'm looking at.
20. As a member of the Household using a screen reader, I want each filter
    chip's state announced ("pasta, included"), so that filtering is usable
    without color.

### The Log

21. As a member of the Household, I want a Log screen showing past Dinners in
    reverse-chronological order grouped by date, so that I can review what we've
    eaten.
22. As a member of the Household, I want Dinners with more than one Log entry
    grouped under one date header, so that a multi-Option evening reads as one
    Dinner.
23. As a member of the Household, I want a compact, capped "Upcoming" strip at
    the top of the Log, so that Planned dinners are visible without burying
    today's history.
24. As a member of the Household, I want to log a Dinner for a past date, so
    that I can backfill a Dinner I forgot to record.
25. As a member of the Household, I want to log a Dinner for a future date, so
    that I can plan ahead ("Thursday: El Comal").
26. As a member of the Household, I want a Planned dinner excluded from the
    Tonight ranking until its date arrives, so that planning Friday doesn't make
    Friday's dish look recently eaten today.
27. As a member of the Household, I want to edit any Log entry's Option inline,
    so that I can correct a mis-tap or a changed plan.
28. As a member of the Household, I want to edit any Log entry's date inline,
    so that I can move an entry between past history and Upcoming.
29. As a member of the Household, I want to edit any Log entry's note inline, so
    that I can add or fix a remark.
30. As a member of the Household, I want to delete a Log entry, so that I can
    remove a plan that didn't happen or a Pick the family didn't eat.
31. As a member of the Household, I want an edit that would collide with an
    existing `(Option, date)` rejected with an inline error, so that I am not
    silently surprised.
32. As a member of the Household, I want a destructive action (delete) to ask
    for an inline "Delete · Cancel" confirm first, so that I don't lose data on
    a fat-finger.

### The Catalog

33. As a member of the Household, I want to add a Home meal to the Catalog, so
    that it becomes a rankable Option on Tonight.
34. As a member of the Household, I want to add a Restaurant to the Catalog, so
    that eating out is a first-class Option alongside cooking.
35. As a member of the Household, I want to edit an Option inline (the row
    expands into a form), so that catalog upkeep is quick on phone and desktop.
36. As a member of the Household, I want to attach Tags to an Option via an
    autocomplete token input, so that I can tag without leaving the row.
37. As a member of the Household, I want to create a new Tag just by typing it
    in the token input, so that I never need a separate Tags screen.
38. As a member of the Household, I want every Tag trimmed and lowercased on
    input, so that "Pasta" and "pasta " never become two Tags.
39. As a member of the Household, I want to Archive an Option, so that it leaves
    Tonight and the default Catalog list but its past Dinners stay intact.
40. As a member of the Household, I want to hard-delete an Option that has zero
    Log entries, so that a mistaken entry can be cleaned up entirely.
41. As a member of the Household, I want a friendly inline "In your log —
    archive instead" message when I try to delete an Option with Log history, so
    that I never hit a raw 500 error page.
42. As a member of the Household searching for a Restaurant, I want a "Search
    Google" box that autofills name, address, phone, coordinates, website, maps
    URL, and place id, so that adding a Restaurant is fast.
43. As a member of the Household, I want every Places-autofilled field to stay
    editable, so that I can correct anything Google got wrong.
44. As a member of the Household, I want the Search Google box hidden when no
    Places API key is configured, so that the form degrades cleanly to manual
    entry.
45. As a member of the Household, I want an inline "Google search unavailable —
    enter details manually" notice when a Places request fails, so that I can
    still save the Restaurant.
46. As a member of the Household, I want a Home meal to carry an optional `url`
    for a recipe link, so that I can jump to the recipe.

### Access

47. As a member of the Household, I want a single password field on a Login
    screen, so that getting in is quick and there are no accounts to manage.
48. As a member of the Household, I want a wrong password to show an inline
    error with no lockout, so that a typo doesn't lock me out of my own app.
49. As a member of the Household, I want my session to persist for ~180 days via
    a sealed cookie, so that I don't re-enter the password every visit.
50. As an anonymous person on the internet, I want to be redirected to Login on
    every gated route, so that — from the Household's perspective — outsiders
    stay out.

### Cross-cutting

51. As a member of the Household, I want every screen to work on both phone and
    desktop from one centered column, so that I can pick in the kitchen and
    manage the Catalog at a desk.
52. As a member of the Household, I want consistent loading, empty, error, and
    success states on every screen, so that the app never feels broken.
53. As a member of the Household using a keyboard, I want visible focus rings,
    logical tab order, and Enter/Space activation, so that the app is fully
    operable without a mouse.
54. As the operator, I want the v1 database seeded by importing the prior
    version's real Catalog and Log history, so that there is no Cold start and
    no hand-seeding step.

## Implementation Decisions

### Stack & architecture

- Next.js (App Router) + TypeScript + Drizzle ORM + PostgreSQL + Tailwind.
  Server actions implement all mutations (`pick = log` is a one-liner).
- Single-household: one shared `APP_PASSWORD`, no user table, no accounts.
- Ranking is computed in TypeScript, not SQL (ADR-0003) — the dataset is tiny
  (tens of Options, hundreds of Log entries).

### Schema (4 tables — ADR-0001)

- `options` — `id uuid pk`, `name`, `kind enum('home','restaurant')`,
  `url null`, `notes null`, `active boolean default true`, `created_at`, plus
  restaurant-only nullable fields `address`, `phone`, `lat`, `lng`,
  `google_place_id`, `maps_url`.
- `tags` — `id uuid pk`, `name`. **UNIQUE INDEX on `lower(name)`** enforces
  case-insensitive uniqueness (no `citext` extension).
- `option_tags` — `option_id` / `tag_id`, both FK `ON DELETE CASCADE`,
  `pk (option_id, tag_id)`.
- `dinner_log` — `id uuid pk`, `option_id` FK **`ON DELETE RESTRICT`**,
  `eaten_on date` (may be past, today, or future), `note null`, `created_at`,
  **`UNIQUE (option_id, eaten_on)`**.
- Drizzle migration files are version-controlled. Migrations are applied **out
  of band** by the operator — the container entrypoint only runs the app.

### Modules

The build extracts these modules. Deep modules have a small interface, hold the
real logic, and are tested in isolation.

- **Local-day module** (deep, pure) — converts a SQL `date` and "now" into
  integer epoch-days in the app's local timezone (`APP_TZ`). Every recency
  subtraction goes through it so "today" is the Household's calendar day, not
  the server's UTC day. Correct across DST boundaries.
- **Ranking engine** (deep, pure — ADR-0003) — interface: `(active options,
  option→tags, non-future Log entries, today) → Tonight list of {option, Score,
  Explanation chip}`, sorted descending by Score. Internals: `daysSince(date |
  null)` (`null` → `CAP`, else `min(CAP, today − date)`); `lastEaten(option)` /
  `lastTagUse(tag)` (most-recent non-future `eaten_on`, `null` if none);
  `optionScore` = `W_OPTION·anti_repeat + W_TAG·variety`, where `variety` is
  `mean(tagDays)` for a tagged Option and equals `anti_repeat` for a tagless
  one; `explanationChip` (see rule below); the sort with the Cold-start
  alphabetical fallback. No DB, no React.
- **`ranking.config.ts`** — the tunable constants in one file: `CAP = 60`,
  `W_OPTION = 1.0`, `W_TAG = 1.0`, `OVERDUE_THRESHOLD = 14`.
- **`normalizeTag` helper** (deep, pure) — trim + lowercase a Tag string. A
  small *shared* function, called by both the Catalog tag-attach server action
  and the import script, so the two paths cannot drift and bypass the
  `lower(name)` unique index. (Eng review D5 left tag normalization "as-is" —
  clarified to mean a shared helper is permitted, not forbidden; a shared helper
  is the chosen shape because two call sites must agree.)
- **Places client** (deep) — `searchGoogle(query)` and
  `getPlaceDetails(placeId)` behind a small interface, each carrying a request
  timeout. Network error / quota / 4xx / 5xx all map to a single typed
  "unavailable" result the Catalog form renders as the §8 fallback notice. The
  client is stubbed in tests. When `GOOGLE_PLACES_API_KEY` is unset the Catalog
  form does not render the Search Google box at all.
- **Auth module** — `timingSafeEqual` constant-time password compare; an
  `iron-session` wrapper sealing/reading the session cookie keyed by
  `APP_SECRET` (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, ~180-day TTL);
  Next.js middleware that validates the cookie on every route except `/login`
  and static assets. No hashing, no lockout, no rate limit, no logout UI.
- **Data access** — Drizzle schema + query functions for Options, Tags, and Log
  entries.
- **Server actions** — `pickTonight` / log-for-another-date; Log entry
  edit/delete; Catalog add/edit/archive/hard-delete + tag attach; `login`.
- **Import script** (one-off) — see "Data import" below.
- **Design foundation** — §16 palette, type scale, and spacing as CSS custom
  properties + Tailwind theme tokens; every screen consumes the tokens, no
  per-screen hex literals.
- **Screens** — Tonight, Log, Catalog, Login; Tonight/Log/Catalog reachable
  from a persistent 3-destination bottom nav.

### Explanation chip rule

One chip per Tonight row, derived deterministically:

- If the Option **has Tags** AND `W_TAG·variety >= W_OPTION·anti_repeat` (tag
  term dominates, ties included) → name the single Tag with the largest
  `daysSince` ("No fish in 18 days").
- Otherwise — option term dominates, **or the Option has no Tags** → name the
  Option's own recency ("Last had 28 days ago"). A tagless Option always uses
  this branch even on a score tie. If `lastEaten` is `null`, the chip reads
  **"Never eaten yet"** — never a false "Last had 60 days ago".

### Lifecycle rules

- An Option with any Log entry cannot be hard-deleted (`ON DELETE RESTRICT`);
  the UI offers Archive (`active = false`) instead and surfaces a friendly
  inline message rather than a 500.
- `pick = log` upserts on `(option_id, eaten_on)` — a double-tap is a no-op;
  different Options on the same date are allowed (a multi-entry Dinner).
- Tag edits are **not retroactive** — recency uses an Option's *current* Tags.
- No tag-management screen in v1; Tags are created/edited only via the Catalog
  token input. A Tag with no Options simply stops appearing in the Tonight
  filter.

### Future rows & ranking

All recency is computed only from `dinner_log` rows with `eaten_on <= today`
(local). A Planned dinner (`eaten_on > today`) shows in the Log's Upcoming
section and does not influence Score until its date arrives.

### Hosting & deployment

- Self-hosted on Kubernetes; the repo ships a **Dockerfile** only. Entrypoint
  runs the Next.js app — it does **not** migrate.
- A GitHub Actions workflow (`.github/workflows/build.yml`) builds the image and
  pushes to GHCR on push to `main` and on tags.
- **Startup schema check** — on boot the app compares the migration files
  bundled in the image against `__drizzle_migrations` in the DB; if the DB is
  behind it logs a loud specific error and exits non-zero (visible crash-loop).
- Env: `DATABASE_URL`, `APP_PASSWORD`, `APP_SECRET`, `APP_TZ`,
  `GOOGLE_PLACES_API_KEY` (optional) — injected from k8s Secrets,
  `.env.example` carries placeholders only. Postgres connection is plain (no
  `sslmode=require`); TLS terminates at the ingress and the app trusts
  `X-Forwarded-Proto`.
- Security headers via `next.config` / middleware: HSTS, `X-Content-Type-
  Options: nosniff`, `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'`,
  `Referrer-Policy: no-referrer`, baseline CSP.

### Data import (replaces hand-seeding)

A **one-off script**, not an ongoing feature, run inside a **single
transaction** (any failure rolls back fully; fix the row and re-run from
scratch). It targets a fresh empty DB — no upsert/idempotency machinery. Prior
app: Prisma, tables `Meal` (7) / `Restaurant` (21) / `Dinner` (67). Mapping:

| Prior | v1 |
|---|---|
| `Meal` | `options`, `kind='home'` |
| `Restaurant` | `options`, `kind='restaurant'` |
| `Dinner` | `dinner_log` |
| `*.id` (text cuid) | fresh `uuid`; keep an old→new id map to rewire FKs |
| `name`, `notes`, `createdAt` | `name`, `notes`, `created_at` |
| `hidden` | `active = NOT hidden` (inverted) |
| `Restaurant.phoneNumber` | `options.phone` |
| `Restaurant.orderUrl` / `menuUrl` | `options.url = coalesce(orderUrl, menuUrl)` |
| `Meal`/`Restaurant.tags` (`text[]`) | normalized via `normalizeTag` into `tags` + `option_tags`, deduped across all Options |
| `Dinner.date` | `dinner_log.eaten_on` |
| `Dinner.notes` | `dinner_log.note` |
| `Dinner.type` + `mealId`/`restaurantId` | `dinner_log.option_id`; `type` dropped (redundant with `kind`) |

Import-time defaults: `dinner_log.created_at` = the Dinner's `date` at local
midnight (`APP_TZ`); Restaurant `address`/`lat`/`lng`/`google_place_id`/
`maps_url` = `null`; Home meal `url` = `null`.

### Design system (§16–18)

- Warm palette as semantic CSS variables; system font stack
  (`-apple-system, system-ui, sans-serif`), base 15px/1.5; 4px spacing base.
- A single centered column at every size — max-width 560px phone / 700px
  desktop, breakpoint 720px. Hairline `--line` dividers on flat `--bg`; **no
  nested cards, no shadows**.
- All four interaction states (loading / empty / error / success) specified per
  screen (plan §17). Destructive actions use one **inline-confirm** pattern
  ("Delete · Cancel" in place) — no modal, no undo-toast.
- Touch targets ≥ 44×44px; tri-state chips legible without color (`+` / `−`
  prefixes, strikethrough on exclude); WCAG AA contrast verified before ship;
  Tonight's ranked list is an `<ol>`; every input has a visible `<label>`.

## Testing Decisions

A good test verifies **external behavior** through a module's public interface —
given these inputs, this output — and does not assert on internal structure, so
it survives refactors. Framework: **Vitest** (TypeScript-native, the Next.js +
TS standard). **No browser E2E in v1** — the three cross-component flows
(pick→log, login→gated route, log-edit date conflict) are verified by hand until
a Playwright suite is added as a follow-up. There is no prior art in this
greenfield repo; these tests *are* the prior art for later work. Coverage
target: every pure function and every server action has a test.

**Pure-logic unit tests (highest value):**

- **Local-day module** — SQL `date` → epoch-day; correctness across a DST
  boundary.
- `daysSince` — `null` → `CAP`; normal `today − date`; capped beyond `CAP`; a
  guard for a future date (should never be reached).
- `lastEaten` / `lastTagUse` — most-recent non-future row; future rows excluded;
  `null` when there is no history.
- `optionScore` — tagged (`variety = mean(tagDays)`), tagless
  (`variety = anti_repeat`), Cold start (every Option ties at
  `(W_OPTION + W_TAG)·CAP`).
- `explanationChip` — tag branch names the largest-`daysSince` Tag; option
  branch names Option recency; **a tagless Option always uses the option
  branch** (explicit regression guard); `null` recency → "Never eaten yet".
- Overdue styling triggers exactly at `daysSince >= OVERDUE_THRESHOLD`.
- Tonight sort — descending by Score, with the Cold-start alphabetical fallback.
- `normalizeTag` — trims, lowercases, leaves an already-normal Tag unchanged.

**Server-action / integration tests:**

- `pick = log` — inserts a row for today; a double-tap is a no-op upsert;
  log-for-another-date with a past and a future date.
- Log edit/delete — change Option, date, note, delete; an edit violating
  `UNIQUE(option_id, eaten_on)` is rejected with an inline error.
- Catalog — Archive sets `active = false`; hard-delete blocked by
  `ON DELETE RESTRICT` for a logged Option, allowed for an unlogged one.
- Tri-state Tag filter — off → include → exclude cycle; kind segment AND Tag
  filters AND together.
- Auth — correct password establishes the session; wrong password → inline
  error; middleware redirects an unauthenticated / expired request to `/login`.
- Places — autofill populates the fields; key unset hides the box; a request
  failure shows the fallback notice (the Places client is stubbed).

**Import-script tests:**

- Mapping correctness — `hidden → active` inverted, `orderUrl`/`menuUrl`
  coalesced into `url`, Tags normalized and deduped, `created_at` set to the
  Dinner's date at local midnight.
- The whole import rolls back on any failure (single transaction).

## Out of Scope

- **No Tags management screen** — no global rename/merge UI. Prior data showed
  zero tag drift; Tags are managed only via the Catalog token input.
- No recipes, ingredient/grocery lists, nutrition or calorie tracking.
- No AI / LLM suggestion.
- No forward *weekly* meal planning (a single Planned dinner is in scope; a
  planning calendar/grid is not).
- No per-family-member preference modeling, no per-dinner rating, no
  opening-hours / live-availability integration.
- No real multi-user accounts; no logout UI; no password hashing, lockout, or
  rate limit (trusted-infra threat model — ADR-0002).
- No favorite/`W_FAV` ranking term in v1 — deferred until there is real Log data
  to tune against.
- No lead-option prominence or collapsed long tail on Tonight — the flat uniform
  list is intentional.
- No desktop list-plus-edit-panel layout for Catalog — inline-expand suffices.
- No browser E2E suite in v1.
- The import is a one-off script — no ongoing sync from the prior app.

## Further Notes

- Build order (plan §13): seed the real Catalog by import → scaffold Next.js +
  Drizzle + Postgres + 4-table schema → **Catalog** (needed before anything is
  testable) + Places autofill → **Tonight** with ranking + Explanation chips →
  `pick = log` + log-for-another-date + **Log** screen with Upcoming and full
  edit/delete → tri-state Tag filters on Tonight → shared-password gate +
  Dockerfile → dogfood two weeks and tune `W_OPTION` / `W_TAG` by feel.
- The plan's "Implementation Tasks" T1–T9 (§ plan) are design-review findings
  folded into the build above — notably T5 ("Never eaten yet" chip) is captured
  in the Explanation chip rule and its regression test.
- Success criteria: picking a dinner on a phone takes under 15 seconds; every
  ranked row shows a correct Explanation chip; the same Log and Catalog are
  editable from phone and desktop; after ~2 weeks the ranking visibly surfaces
  neglected categories; the Household actually opens it most evenings.
- Approved mockups live under
  `~/.gstack/projects/n1mmy-pick-me-a-dinner-2/designs/` (plan §19) with the
  corrections noted there (drop per-row circular icon; 3-tab nav only; drop the
  Log sentimental footer; Login wordmark "Pick Me a Dinner", no tagline).
