# 02 — Playwright scaffolding, the fixture, and the Login tracer bullet

Status: done
Type: AFK

## Parent

[Spec: Browser tests](../PRD.md)

## What to build

One command builds the app, creates and migrates a per-worktree
browser-test database, seeds it relative to today, starts a production
server with every AI and Places variable blanked, logs in through the real
Login form, and runs the Login spec at phone and desktop widths with a
screenshot of each. The shared per-visit checks live here and every later
spec reuses them.

- Dev dependencies: the Playwright test runner and `tsx`, installed with
  `corepack pnpm install`, lockfile committed. The Chromium in the
  machine's Playwright cache is used; a revision mismatch is fixed by one
  `playwright install chromium`.
- A `test:e2e` script runs the production build and then Playwright. The
  build stays outside Playwright's web-server command (a cold build sits
  at the 60s server timeout).
- The unit suite's config excludes the browser-test directory. The
  verification gate is untouched. Screenshots, results, and the report are
  gitignored.
- Playwright config: one web server on port 3100 whose command prepares the
  database and then starts the server, never reused; base URL on
  `localhost` (the session cookie is Secure outside development);
  environment from the committed secret-free defaults file, parsed rather
  than loaded, with the database renamed per worktree and every
  Anthropic, AI model, Places, and `LOCAL_AI_*` variable set to the empty
  string. Projects: `setup` logs in and saves storage state; `phone`
  (375×812) and `desktop` (1280×800) depend on it and skip `@dark`; the
  Login spec runs with empty storage state.
- Prefactor: the DB suite's database-name helper takes a suffix parameter
  (`test` today, `e2e` here) so the two derivations never disagree.
- The preparation script creates the database if missing, migrates,
  truncates, and inserts the spec's fixture: 4 Home meals, 3 Restaurants
  (one with a Closed day two days out), 5 Tags, about 10 Log entries over
  40 days with a few Notes, one Cold start, a Day note on today, today's
  hand-written Prepared note hashed with the app's own hashing under a
  fixture model name, and tomorrow's Planned dinner with its note. Both
  notes prepared today at 07:00 in the Household's timezone.
- A shared helper runs every visit's checks: 2xx and visible `h1`; no
  console error or page exception from the start of the visit; no
  horizontal scroll and no visible element past the right edge; loaded
  FontFaces named Fraunces, GeistSans, and GeistMono (not the `check`
  API) and the `h1` and body computed families; bottom tab bar under
  720px, left rail at or above; a viewport screenshot named by screen,
  width, and theme.
- The Login spec: logged out, the password field and submit button are
  visible, plus the shared checks.

## Acceptance criteria

- [x] `corepack pnpm test:e2e` builds, seeds, boots, logs in, and passes the Login spec at phone and desktop
- [x] The server's environment has every AI and Places variable blank and the per-worktree database URL
- [x] A second run re-seeds and passes again
- [x] `pnpm test` and the verification gate pass without Postgres and never pick the specs up
- [x] The database-name helper has a suffix parameter and the DB suite still passes
- [x] Two screenshots exist under the gitignored screenshots directory

## Blocked by

None (can start immediately).

## Comments

- Done. The installed runner (1.64.1) wanted Chromium revision 1248 against
  the cache's 1234, so `npx playwright install chromium` ran once. The
  loaded-face check asks for each face first: Login sets no numerals, so
  Geist Mono stayed `unloaded` there. `next start` warns that it does not
  suit `output: standalone`; it serves fine.
