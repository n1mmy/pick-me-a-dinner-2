# Spec: Browser tests

Status: ready-for-agent

Vocabulary: [`CONTEXT.md`](../../CONTEXT.md) — **Household**, **Tonight**,
**Selected day**, **Catalog**, **Option**, **Home meal**, **Restaurant**,
**Closed day**, **Tag**, **Log**, **Log entry**, **Note**, **Day note**,
**Planned dinner**, **Pick**, **decided**, **Option detail page**, **Recency
chip**, **Affinity**, **Cold start**, **AI search**, **AI rationale**,
**Prepared note**, its **brief** and **Prepared ranking** govern this spec.
Decided in
[`docs/adr/0011-prepared-notes-from-a-local-model.md`](../../docs/adr/0011-prepared-notes-from-a-local-model.md):
the `LOCAL_AI_*` variables control generation only. The build plan, with
files per step, is [`plans/browser-tests.md`](../../plans/browser-tests.md).
Visual rules are [`DESIGN.md`](../../DESIGN.md).

---

## Problem Statement

Nothing checks that the app renders. The verification gate runs the type
check, lint, the unit suite, and the build, and the DB suite covers the
queries and server actions, but no test opens a page in a browser. A
screen can ship with a console error, an element poking past the edge of a
phone, a web font that never loaded, the wrong nav for the width, or a dark
theme that nobody has looked at, and every gate still passes. The Household
finds out on their phone.

There is also one product gap the tests expose. Tonight reads a stored
Prepared note only when the local model is configured, and judges it
current or out of date by hashing against the configured model. So a
server with no local model shows no note at all, even when the note is
sitting in the database, and a model switch marks every note out of date
before the sweep has rewritten one. ADR-0011 says the variables control
generation only; the code does not yet agree.

## Solution

A small Playwright suite that drives a real Chromium against a production
build of the app, seeded with a fixed fixture, with every metered or shared
AI service and Places blanked. Every screen is visited at phone and desktop
widths and asserted on layout invariants a browser can check: the response
succeeded, the title is visible, nothing errored in the console, nothing
scrolls sideways, the web fonts loaded, the right nav is on screen. Each
visit also saves a screenshot so an agent or a person can judge the screen
by eye against a short checklist drawn from `DESIGN.md`. Two screens are
also visited in the dark theme and checked for contrast.

No pixel baselines and no metered judge: the eye-check is a person or an
agent reading the PNGs on request. The suite runs on demand, not in the
gate, because it needs Postgres.

First, Tonight starts showing a stored Prepared note whenever one exists,
and reads current or out of date by the model recorded on the note, so the
fixture's hand-written note shows up with no local model configured.

## User Stories

1. As the Household, I want every screen to open without an error, so that a
   broken page is caught before I reach for my phone at dinner time.
2. As the Household, I want no screen to scroll sideways on my phone, so
   that nothing is cut off at the right edge.
3. As the Household, I want the app's own typefaces on every screen, so that
   titles and Option names look the way they were designed rather than
   falling back to a system font.
4. As the Household, I want the bottom tab bar on my phone and the left rail
   on a laptop, so that the nav I reach for is where I expect it.
5. As the Household, I want Tonight to show the Prepared note when one has
   been written for the Selected day, whether or not the local model is
   configured right now, so that the brief and ranking I was promised are
   never hidden by a server setting.
6. As the Household, I want a Prepared note to read current after the local
   model is switched, until the sweep rewrites it, so that out of date means
   my history moved on rather than the writer changed.
7. As the Household, I want a Prepared note to read out of date once I log,
   reject, or edit something that would change it, so that I know the sweep
   will rewrite it.
8. As the Household, I want a note on a decided or past date to read as a
   record, never out of date, so that a day I have already picked is left
   alone.
9. As the Household, I want the dark theme to be legible, so that text, the
   title, and the kind bar stand out from the background at night.
10. As the Household, I want the Login screen to show its password field
    and button at phone and desktop widths, so that I can always get in.
11. As the Household, I want Tonight to show the brief, the first row's AI
    rationale, and today's Day note together, so that the evening's context
    is on one screen.
12. As the Household, I want a decided day to show the Planned dinner as
    decided with the brief beneath it, so that the note reads as a record
    under the decision.
13. As the Household, I want the Catalog to list every Option with its kind
    bar, so that I can tell a Home meal from a Restaurant at a glance.
14. As the Household, I want an Option detail page to show the Option's
    name in the display face and list its Log entries, so that the page
    reads as that Option's record.
15. As the Household, I want the Log to list entries newest first, so that
    last night is at the top.
16. As the developer, I want one command that builds, migrates, seeds, and
    runs the browser suite, so that a UI change can be checked before it
    is committed.
17. As the developer, I want the suite to seed its own database every run,
    relative to today, so that a second run on any day gives the same
    chips, the same heatmap colours, and the same screenshots.
18. As the developer, I want each worktree to use its own browser-test
    database, so that parallel agents never truncate each other's fixture.
19. As the developer, I want the suite to blank every AI key and address
    before the server starts, so that a run never calls Anthropic, Places,
    or Strata, and never starts the Prepared-notes sweep.
20. As the developer, I want a screenshot of every screen at every width
    after a run, so that I or an agent can judge the design by eye.
21. As the developer, I want a short written checklist for that eye-check,
    so that a review of the screenshots is the same every time.
22. As the developer, I want the browser suite excluded from the unit
    suite and the verification gate, so that the gate stays env-free and
    the Ralph loop keeps passing without Postgres.
23. As the developer, I want a README beside the suite, so that someone
    starting it a month from now knows what it needs, what the fixture
    holds, and how to read the screenshots.
24. As the developer, I want a deliberate break to fail the suite, so that
    I know the overflow and font checks are not passing vacuously.

## Implementation Decisions

### Tonight reads stored Prepared notes unconditionally

- The Tonight page drops its "local model configured" guard and always
  asks for the Selected day's stored note. With no note, Tonight is as
  before.
- The read judges current against out of date by hashing the date's
  current snapshot with the model recorded on the stored note, not the
  configured model. The stored note already carries its model, non-null.
- Consequence, now matched to ADR-0011: with the local model turned off,
  notes already written stay on screen and go out of date as the
  Household's inputs move on. A model switch leaves a note reading
  current until the sweep rewrites it. Out of date means the inputs
  changed, not the writer.
- The sweep's own gate is unchanged: it still starts only in production
  with both the base URL and model set.
- Committed on its own, before the test scaffolding.

### Playwright scaffolding

- Dev dependencies: the Playwright test runner and `tsx`. Installed with
  `corepack pnpm install` and the lockfile committed, since the gate
  installs frozen. The Chromium already in the machine's Playwright cache
  is used; a revision mismatch is fixed by one `playwright install
  chromium`. Playwright launches Chromium without its sandbox, so the
  user-namespace denial that blocks other headless browsers here does not
  apply.
- One script, `test:e2e`, runs the production build and then Playwright.
  The build is outside Playwright's web-server command on purpose: a cold
  build measured 48s here (39s warm), which with migration and boot sits
  at Playwright's 60s server timeout, and a slow build would then surface
  as a server that failed to start.
- The unit suite's config excludes the browser-test directory, so `pnpm
  test` never picks the specs up. The verification gate is untouched.
- Screenshots, Playwright's results, and its report are gitignored.

### The web server

- One web server on port 3100, so a dev server on 3000 can keep running.
  Its command runs the database preparation script and then `next start`.
  Preparation lives in the server command rather than a global setup so
  that migration always precedes the boot-time schema check, which aborts
  on an unmigrated database. The server is never reused, so every run
  re-seeds against today.
- The base URL is `localhost`, not a loopback IP: the session cookie is
  Secure outside development, and Chromium accepts a Secure cookie over
  plain http only for `localhost`.
- The server's environment is the committed secret-free defaults file,
  parsed rather than loaded into the test process, with overrides:
  - the database URL renamed to a per-worktree browser-test database,
    derived by the same helper the DB suite uses, given a suffix parameter
    so the two derivations never disagree;
  - every Anthropic variable, the AI model, the Places key, and every
    `LOCAL_AI_*` variable set to the empty string. Next fills a variable
    from an env file only when it is undefined in the process, so an
    explicit empty string blocks the worktree's real keys. All three
    feature gates treat an empty string as unset. The result: no AI
    search, no Places, no Prepared-note sweep, nothing metered and nothing
    on Strata.
- Projects: a `setup` project logs in through the real Login form with the
  defaults file's password and saves the storage state. `phone` (375×812)
  and `desktop` (1280×800) run in the light theme, depend on `setup`, and
  skip tests tagged `@dark`. `phone-dark` (375×812, dark colour scheme)
  runs only tests tagged `@dark`. The Login spec runs with an empty
  storage state.

### The fixture

The preparation script creates the database if missing, runs the
migrations, truncates every table, and inserts a fixture whose dates are
relative to today in the Household's timezone, so chip ages and heatmap
colours are the same every day:

- 4 Home meals and 3 Restaurants, 5 Tags spread across them. One
  Restaurant has a Closed day on the weekday two days from today, so
  neither today's nor tomorrow's candidate set changes with the day the
  suite runs.
- About 10 Log entries over the last 40 days, a few with a Note, so the
  Recency and Affinity chips span the heatmap. One Option never eaten, a
  Cold start.
- A Day note on today.
- Today's Prepared note: a hand-written brief of two or three sentences and
  a Prepared ranking of every candidate, rationales tapering from three
  sentences to one, in the Household's voice. Its model is a fixture name,
  and its input hash is computed with the app's own hashing over today's
  snapshot after the rest of the fixture is in, so it reads current. Its
  prepared-at is today 07:00 in the Household's timezone, because the
  byline reads a bare time for a note written today and a weekday
  otherwise.
- Tomorrow: a Planned dinner and a Prepared note, also prepared today at
  07:00. The date is decided, so the note reads frozen and its hash does
  not matter.

### The specs

One spec per screen. Every visit, at every project it runs in, asserts:

- the response is 2xx and the screen's `h1` is visible;
- no console error and no uncaught page exception, collected from the
  start of the visit;
- no horizontal scroll on the document, and no visible element whose box
  extends past the viewport's right edge;
- the web fonts loaded: after the document's fonts are ready, a FontFace
  named Fraunces, GeistSans, and GeistMono each has status loaded. Not the
  `check` API, which returns true when no face matches the name at all.
  Then the `h1`'s computed family starts with Fraunces and the body's with
  GeistSans;
- the nav matches the width: bottom tab bar under 720px, left rail at or
  above it;
- a viewport-sized screenshot named by screen, width, and theme.

Screen-specific assertions:

- Login, logged out: the password field and submit button are visible.
- Tonight, today: the brief is visible; the first row shows its AI
  rationale; the Day note is visible; the AI search control is absent,
  which proves the keys stayed blank.
- Tonight, tomorrow: the Planned dinner row is shown decided and the brief
  sits under it.
- Catalog: every fixture Option is listed with its kind bar.
- Option detail page, of an eaten Option: the name is in Fraunces and its
  Log entries are listed.
- Log: the fixture entries are listed, newest first.
- Dark, phone only, Tonight today and Catalog: the computed page
  background is dark by luminance, and body text, the `h1`, and a row's
  kind bar each clear a contrast floor against what they sit on: 4.5:1
  for text, 3:1 for the bar.

### The README

Beside the suite: Postgres on 5434 (the `pmad-pg` container), then the
one command (with the `npx` equivalents where corepack is unavailable). A
dev server in the same worktree can keep running, since dev builds into its
own directory. What the fixture holds and that it is wiped every run. The
agent eye-check: open the PNGs and check them against a short list drawn
from `DESIGN.md`: flat surfaces with no shadows, cards, or nested surfaces;
Fraunces only on titles and Option names; numerals in Geist Mono, aligned
down a column; the 3px kind bar and its tint or wash on every Option row;
heatmap chips across green, tan, and red; nothing cramped, clipped, or
ellipsised where it should fit at 375px; in dark, nothing reading as a
light-theme leftover. Roughly 1–1.5k tokens per image, so on request, not
after every run.

## Testing Decisions

A good test here asserts what the Household or a reviewer could observe,
never how the page is built: a status code, a visible element, a computed
style, a scroll width, a loaded font, a listed name. Nothing reaches into
components, server actions, or queries.

Two seams, both confirmed with the user:

- **The browser against the running server** (new). Playwright over HTTP at
  a production `next start`, backed by the seeded per-worktree database.
  Everything in the scaffolding, fixture, specs, and README is asserted
  here. It is the only place the removal of Tonight's env guard is
  observable, since the page has no unit test.
- **The Prepared-note read in the DB suite** (existing). The staleness rule
  change is asserted next to the eight existing `preparedNoteFor` cases.
  Red first: a note hashed with its own model reads current while the
  configured model names a different one, and while it is unset. Kept as
  a guard, already green: the read returns a stored note with no
  `LOCAL_AI_*` set. Still held: an input change flips it out of date;
  decided and past dates read frozen.

Prior art: the Prepared notes DB tests and the day-decisions DB tests for
the DB seam; the DB suite's global setup for creating and migrating a
per-worktree database and tolerating an already-existing one. There is no
prior browser test; the Playwright config and preparation script are new.

Verification:

- Step 1: unit and DB suites green, typecheck and lint clean.
- The browser suite green twice in a row, the second run proving
  re-seeding. Every PNG opened once to confirm it is what the checklist
  expects. Two deliberate breaks, each seen to fail: a fixed 1000px-wide
  element on Catalog against the overflow check, and a renamed font
  against the loaded-face check, the one assertion that could otherwise
  pass vacuously.
- The whole gate still passes without Postgres.

## Out of Scope

Pixel baselines. A metered screenshot judge. AI search results, and the
results-on-top layout they produce; a mocked search endpoint could add
that later. The dark theme at desktop width. Any interaction beyond logging
in: no Pick, Reject, edit, or search is driven. Adding the suite to the
verification gate. Any change to `CONTEXT.md`: the test infrastructure is
not domain language, and the Prepared-note consequence is already in
ADR-0011.

## Further Notes

The plan is grilled; this spec records the outcome. The work is three
commits in order: the Prepared-note read change with its DB tests; the
scaffolding, fixture, and specs; the README. The second can be split if it
grows, but the specs are not meaningful without the fixture.

The Chromium in the machine's Playwright cache belongs to an unknown
Playwright release. If the installed runner wants another revision, the
one-time browser install is the fix, and the plan says so.

Playwright's web-server command inherits the shell's PATH from the
`test:e2e` script, so `tsx` and `next` resolve from the project's binaries
when the suite is started through the script or `npx`. Running the
Playwright binary directly from outside either would not find them.
