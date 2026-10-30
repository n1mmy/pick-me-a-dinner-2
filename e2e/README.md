# Browser tests

A Playwright suite that drives Chromium against a production build of the
app, seeded with a fixed fixture, with every AI and Places variable blanked.
Each screen is visited at phone (375×812) and desktop (1280×800) widths, plus
Tonight and the Catalog in the dark theme on a phone. It is not in the
verification gate: it needs Postgres.

## Running it

1. Postgres on `localhost:5434`: the `pmad-pg` container.
2. `corepack pnpm test:e2e`, or `npx next build && npx playwright test`
   where corepack is unavailable.

The command builds the app, then Playwright's web server creates and
migrates `pmad_e2e_<worktree>` (beside the DB suite's `pmad_test_<worktree>`),
wipes and re-seeds it, and starts `next start` on port 3100. A dev server in
the same worktree can keep running: it uses port 3000 and builds into
`.next-dev`, not `.next`.

A bare `npx playwright test` builds nothing: it serves whatever `.next` was
built last. After a code change or a branch switch, build again first, or
the run tests the old code.

If Playwright reports a missing browser, run `npx playwright install chromium`
once.

The server's environment is `.env.ralph` with the database renamed and every
Anthropic, AI model, Places, and `LOCAL_AI_*` variable set to empty
(`server-env.ts`). A run calls nothing metered, nothing on Strata, and never
starts the Prepared-notes sweep.

## The fixture

Wiped and re-inserted every run (`prepare-db.ts`; the data is in
`fixture.ts`). Dates are relative to today in `APP_TZ`, so chips and heatmap
colours read the same on any day:

- 4 Home meals and 3 Restaurants across 5 Tags. Luigi's Pizzeria is Closed
  on the weekday two days out, so neither today's nor tomorrow's candidates
  depend on the day.
- 10 Log entries over the last 40 days, four with a Note. Miso Salmon Bowls
  was never eaten (Cold start).
- A Day note on today.
- Today's Prepared note: a brief and a ranking of every candidate, hashed with
  the app's own hashing under the model `e2e-fixture`, so it reads current.
- Tomorrow's Planned dinner (Thai Basil) and its Prepared note, which reads
  frozen.

Both notes read "Prepared 7:00am" today.

## What every visit checks

`visit.ts`: a 2xx and a visible `h1`; the screen's `ready` element visible
before anything is measured; the three faces (`Fraunces`, `GeistSans`,
`GeistMono`) loaded, with the `h1` and body using them; no horizontal scroll
and nothing past the right edge; the bottom tab bar under 720px and the left
rail at or above it; a screenshot; no console error or page exception.

A new spec passes `ready`, an element only the finished screen has. Each
screen's `loading.tsx` skeleton streams in first with an `h1` of its own, so
without `ready` the checks and the screenshot would measure the skeleton.

## The eye-check

Screenshots land in `e2e/screenshots/<screen>-<project>.png` (gitignored).
On request, not after every run (roughly 1–1.5k tokens per image), open each
with Read and check it against `DESIGN.md`:

- Flat surfaces: no shadows, cards, or nested surfaces.
- Fraunces only on titles and Option names.
- Numerals in Geist Mono, aligned down a column.
- The 3px kind bar over the kind tint on Tonight's rows, and over the wash
  on the decided block and the Log's entry rows. Catalog rows are untinted
  on plain `bg` with a divider.
- Heatmap chips spread across green, tan, and red.
- Nothing cramped, clipped, or ellipsised where it should fit at 375px. The
  Last note line and the phone brief are ellipsised by design.
- In dark, nothing that reads as a light-theme leftover.

A finding goes to the issue tracker; the eye-check never fails the run.
