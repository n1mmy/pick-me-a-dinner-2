# Browser tests: the app renders and looks decent

Grilled 2026-10-30 (`/grill-with-docs`). Settled there: ADR-0011's
consequence that the `LOCAL_AI_*` variables control generation only. No
`CONTEXT.md` change: everything else is test infrastructure, not domain
language. This plan is the work that follows.

## What "looks decent" means

Layout invariants a browser can check, plus a screenshot of every page for
an agent or a person to judge by eye. No pixel baselines: the Tonight title
is the weekday, chip ages move daily, and font rasterisation drifts between
machines, so a baseline suite would mostly test itself. No metered judge:
the eye-check is an agent reading the PNGs on request against a written
checklist, never part of a run and never a failure.

## Step 1: stored Prepared notes always show (product change, test-first)

Today Tonight reads a stored note only when `preparedNotesEnabled()`
(`LOCAL_AI_BASE_URL` and `LOCAL_AI_MODEL` both set), and judges current vs
out of date by hashing with the configured `localModel()`. Change both:

- `app/page.tsx:69`: drop the `preparedNotesEnabled()` guard; always call
  `preparedNoteFor`. Update the comment above it.
- `lib/prepared-notes.ts` `preparedNoteFor`: hash with the note's own
  `stored.model`, not `localModel()`. `StoredPreparedNote`
  (`db/queries.ts:533`) already carries `model` as a non-null string.
  Rewrite the doc comment at `:273`: the label means the Household's inputs
  moved on since the note was written; after a model switch a note reads
  current until the sweep rewrites it (ADR-0011).
- The sweep's gate (`lib/prepared-notes-loop.ts:21`) is unchanged.

Tests in the existing DB suite (`lib/prepared-notes.db.test.ts`):

- Red first: a note whose stored hash was computed with its own model reads
  `current` while `LOCAL_AI_MODEL` names a different model, and while it is
  unset. (Today `localModel()` returns `""` when unset, so the hash differs
  and the note reads `out-of-date`.)
- Already green, kept as a guard: `preparedNoteFor` returns a stored note
  with no `LOCAL_AI_*` set — it never read the env; only the page did.
- An input change still flips it to `out-of-date`; decided and past dates
  still read `frozen`.

The guard removal in `app/page.tsx` has no unit test: the Tonight spec in
step 3, running with every AI variable blank, is what proves it.

Commit this on its own before step 2.

## Step 2: Playwright scaffolding

- Dev dependencies: `@playwright/test` and `tsx` (the existing scripts
  already run under `npx tsx`). Use the Chromium already in
  `~/.cache/ms-playwright`; if the installed `@playwright/test` wants a
  different browser revision, run `npx playwright install chromium` once.
  Bare Playwright launches without the Chromium sandbox, so the
  user-namespace denial that blocks gstack's `$B` does not apply.
  Install with `corepack pnpm install` (bare `pnpm` is not on `PATH` here)
  and commit the updated `pnpm-lock.yaml`: the gate installs with
  `--frozen-lockfile`.
- `package.json`: `"test:e2e": "next build && playwright test"`. The build
  runs here, not inside Playwright's `webServer` command: a cold build
  measured 48s on this machine (39s warm), which with migration and boot
  sits right at Playwright's 60s server timeout, and a slow build would then
  surface as "web server failed to start". Out here a slow build fails as a
  build, and the server command is well inside the default.
- `vitest.config.ts`: exclude `e2e/**` so `pnpm test` never picks the specs
  up.
- `.gitignore`: `e2e/screenshots/`, `test-results/`, `playwright-report/`.
- Not added to the verification gate (`docs/agents/ralph.md`): the gate is
  env-free and has no Postgres. Run `test:e2e` on demand and before
  UI-touching commits.

### `playwright.config.ts`

- One `webServer` on port 3100 (a dev server on 3000 can keep running).
  Command: `tsx e2e/prepare-db.ts && next start -p 3100`. Preparing inside
  the server command, not in `globalSetup`, is order-proof: the boot-time
  schema check (`instrumentation.ts`) aborts on an unmigrated database, so
  migration must precede `next start`. `reuseExistingServer: false`, so
  every run re-seeds against today.
- `baseURL: "http://localhost:3100"`, `localhost` and not `127.0.0.1`: the
  session cookie is `Secure` whenever `NODE_ENV` is not `development`
  (`lib/session.ts`), which it is under `next start`, and Chromium accepts
  a Secure cookie over plain http only for `localhost`.
- Server `env`, built from `.env.ralph` (parsed with `dotenv.parse`, not
  loaded into the process) plus overrides:
  - `DATABASE_URL`: `.env.ralph`'s URL with the database renamed to
    `pmad_e2e_<worktree>`. Give `testDatabaseName` in `vitest.test-db.ts`
    a suffix parameter (`test` today, `e2e` here) rather than re-deriving
    the worktree slug, so parallel worktrees never share one and the two
    derivations never disagree.
  - Set to the empty string: `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`,
    `ANTHROPIC_CUSTOM_HEADERS`, `AI_MODEL`, `GOOGLE_PLACES_API_KEY`,
    `LOCAL_AI_BASE_URL`, `LOCAL_AI_API_KEY`, `LOCAL_AI_MODEL`. This
    worktree's `.env.local` holds a real Anthropic key and Strata's
    address; `@next/env` fills a variable only when it is `undefined` in
    the process, so an explicit empty string blocks the file's value.
    The result: no AI search, no Places, no Prepared-note sweep, nothing
    metered and nothing on Strata.
- Projects:
  - `setup`: logs in through the real Login form with `.env.ralph`'s
    `APP_PASSWORD`, saves `storageState`.
  - `phone` (375×812) and `desktop` (1280×800), light, depend on `setup`,
    with `grepInvert: /@dark/` so the dark-contrast tests never run under
    the light scheme.
  - `phone-dark` (375×812, `colorScheme: "dark"`), `grep: /@dark/`, so it
    runs only the tests tagged `@dark`.
  - The Login spec runs without the saved state
    (`test.use({ storageState: { cookies: [], origins: [] } })`).

### `e2e/prepare-db.ts`

Create the database if missing (tolerate `42P04`, as
`vitest.global-setup.ts` does), run the Drizzle migrations, truncate every
table, insert the fixture. Dates are relative to today in `APP_TZ`
(`lib/local-day.ts`), so chip ages and heatmap colours are the same every
day.

Fixture:

- 4 Home meals, 3 Restaurants; one Restaurant has a Closed day, set to the
  weekday two days from today so neither today's nor tomorrow's candidate
  set changes with the day the suite runs.
- 5 Tags spread across them.
- ~10 Log entries over the last ~40 days, a few with a Note, so Recency
  and Affinity chips span the heatmap.
- 1 Option never eaten (Cold start).
- A Day note on today.
- Today: a Prepared note with a hand-written two-to-three-sentence brief
  and a ranking of every candidate, rationales tapering from three
  sentences to one, in the Household's voice. `model: "e2e-fixture"`,
  `inputHash` computed with the app's own `inputHash(await
  snapshotForDay({ asOf: today, query: "" }), "e2e-fixture")` after the
  rest of the fixture is in, so it reads current (step 1 makes the label
  use the stored model). `preparedAt` is today 07:00 in `APP_TZ`: the
  byline reads "Prepared 7:00am" for a note written today and "Prepared
  Mon 7:00am" otherwise (`lib/prepared-label.ts`), so a fixed timestamp
  would change the screenshot with the calendar.
- Tomorrow: a Planned dinner (a Log entry dated tomorrow) and a Prepared
  note for that date, `preparedAt` also today 07:00. Decided, so it reads
  frozen; its hash does not matter.

## Step 3: the specs

One spec per screen in `e2e/`. Each visit, at every project it runs in:

- the response is 2xx and the screen's `h1` is visible;
- no console error and no uncaught page exception (collected from the
  start of the visit);
- no horizontal scroll (`scrollWidth <= clientWidth` on the document) and
  no visible element whose box extends past the viewport's right edge;
- web fonts loaded: the built CSS registers the faces as `Fraunces`,
  `GeistSans`, and `GeistMono` (not `Geist`). Await `document.fonts.ready`,
  then find the `FontFace` in `document.fonts` whose `family` is each name
  and assert its `status` is `loaded`. Not `document.fonts.check`: it
  returns true when no face matches the name at all, so a typo passes.
  Then the computed `font-family` of the `h1` starts with `Fraunces`, the
  body's with `GeistSans`;
- the nav matches the width: bottom tab bar under 720px, left rail at or
  above it (`app/app-nav.tsx`);
- a viewport-sized screenshot to
  `e2e/screenshots/<screen>-<phone|desktop>[-dark].png`.

Screen-specific checks:

| Screen | Visit | Also asserts |
|---|---|---|
| Login | `/login`, logged out | the password field and submit button are visible |
| Tonight, today | `/` | brief visible; first row shows its AI rationale; Day note visible; AI search control absent (proves the keys stayed blank) |
| Tonight, decided | `/?day=<tomorrow>` | the Planned dinner row shown decided; the brief sits under it |
| Catalog | `/catalog` | every fixture Option listed with its kind bar |
| Option detail page | `/catalog/<id>` of an eaten Option | name in Fraunces; its Log entries listed |
| Log | `/log` | the fixture entries listed, newest first |

Dark (`@dark`, phone only): Tonight today and Catalog. Assert the computed
page background is dark (luminance under a threshold), and that body text,
the `h1`, and a row's kind bar each differ clearly from the background they
sit on (contrast ratio over a floor; WCAG 4.5:1 for text, 3:1 for the bar).

## Step 4: `e2e/README.md`

- How to run: Postgres on :5434 (the `pmad-pg` container), then
  `corepack pnpm test:e2e` (`npx next build && npx playwright test` where
  corepack is unavailable). A dev server in the same worktree can keep
  running: it builds into `.next-dev`, not `.next` (`next.config.ts`).
- What the fixture holds and that it is wiped every run.
- The agent eye-check: open the PNGs in `e2e/screenshots/` with Read and
  check them against a short list drawn from `DESIGN.md`: flat surfaces,
  no shadows, cards, or nested surfaces; Fraunces only on titles and Option
  names; numerals in Geist Mono, aligned down a column; the 3px kind bar
  and its tint or wash on every Option row; heatmap chips coloured across
  green, tan, red; nothing cramped, clipped, or ellipsised where it should
  fit at 375px; in dark, nothing reading as light-theme leftovers. Roughly
  1–1.5k tokens per image, so on request, not after every run.

## Verification

- Step 1: `npx vitest run` and `npx vitest run --config
  vitest.config.db.ts` green; typecheck and lint clean.
- Step 2–4: `corepack pnpm test:e2e` green twice in a row (the second run
  proves re-seeding works); open each PNG once to confirm the screenshots
  are what the checklist expects; break something on purpose (e.g. a fixed
  1000px-wide element on Catalog) and see the overflow check fail; rename
  a font in the loaded-face check and see it fail, since that assertion
  is the one that could pass vacuously.
- Whole gate (`docs/agents/ralph.md`) still passes without Postgres:
  `test:e2e` is not in it and `vitest.config.ts` excludes `e2e/`.

## Out of scope

Pixel baselines, a metered screenshot judge, AI search results (a mocked
`/api/ai-search` could add the results-on-top layout later), the dark
theme at desktop width, and any interaction beyond logging in.
