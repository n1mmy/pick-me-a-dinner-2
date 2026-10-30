# Code review: browser tests, `1cf3262..011342a`

Pre-landing review (`/review`) of `git diff 1cf3262` on
`implement-browser-test-tickets`. The base is the plan commit, as asked;
the merge-base with `main` is `280a540`. The diff is 28 files, about 1,020
lines without the lockfile. It carries:

- Tonight reading a stored Prepared note whether or not `LOCAL_AI_*` is
  set, and judging it current by the model recorded on the note (ticket 01);
- the Playwright scaffolding, the fixture and the Login spec (02);
- the Tonight specs, light and dark (03);
- the Catalog, Option detail and Log specs (04);
- the waits for the `ready` element, and `e2e/README.md` (05).

Line anchors are in `011342a`. Afterwards:

- The mechanical findings, 1, 2, 4 and 9, were fixed in the commit that
  adds this file.
- `c3fe6ee` fixed the eye-check findings that finding 8 lists.

Each of these is marked **Fixed** below. The rest are open.

**Sources:**

- **Core checklist pass**, by the parent agent.
- **Specialists:** testing, maintainability, security, performance, design,
  simplification, state machines. Testing, performance and state machines
  returned no findings; the state matrix check passed with `machines=0`.
- **Red team.**
- **Claude adversarial pass.**
- **Codex: unavailable.** Its sandbox cannot start here (`bwrap: Creating
  new namespace failed`), and no paid call ran. A Paseo run would give an
  outside view; it was not started, because it is metered.
- **Functional QA**, below: the whole plan check list except the
  deliberate breaks.

Gate scan: 10 hunks listed, 0 eligible, no relaxations
(`coverage=RH-1,RH-3,RH-4,RH-12,RH-13,RH-14,RH-15,RH-16`). There are no
banned terms and no approval classes.

## Verification run by this review

Each run was recorded with `gstack-qa-evidence` under
`.gstack/qa-reports/review-20261030-browser-tests/functional/`, which is
gitignored.

| # | Command | Result |
|---|---|---|
| 001 | `npx tsc --noEmit` | exit 0 |
| 002 | `npx next lint` | exit 0, no warnings |
| 003 | `npx vitest run` | 594 passed, 34 files; no `e2e/` file collected |
| 004 | `DATABASE_URL=…:5434/pmad npx vitest run --config vitest.config.db.ts` | 142 passed, 9 files |
| 005 | `npx next build && npx playwright test` | 15 passed |
| 006 | `npx playwright test` (re-seed) | 15 passed |

Not re-run here: the two deliberate breaks (overflow and renamed font) and
the eye-check. Ticket 05 records both, with results. Re-running the breaks
needs a source edit, which this review was not allowed to make.

## Plan completion

The plan is `.issues/browser-tests/PRD.md` with `plans/browser-tests.md`.
All five tickets are delivered:

- **01 DONE:** `app/page.tsx:67-70` and `lib/prepared-notes.ts:304`, with
  two new DB cases.
- **02 DONE:** `playwright.config.ts`, `e2e/server-env.ts`,
  `e2e/prepare-db.ts`, `e2e/login.spec.ts`, and the suffix parameter in
  `vitest.test-db.ts`.
- **03 DONE:** `e2e/tonight.spec.ts`, `e2e/contrast.ts`.
- **04 CHANGED:** the PRD (user story 13, "Catalog: every fixture Option is
  listed with its kind bar") and ticket 04 ask for a kind bar on Catalog
  rows. `DESIGN.md` has Catalog rows untinted, so the spec checks each
  Option under its kind's section instead, and the dark test measures the
  kind-hued add buttons. The PRD's wording is now stale against
  `DESIGN.md`; see finding 9.
- **05 DONE:** `e2e/README.md`. The breaks and eye-check are recorded in the
  ticket's Comments.

Scope: no drift. Every changed file maps to a ticket. One consequence of
ticket 01 is not stated anywhere: on a server with the sweep off, the
out-of-date label now promises an update that never comes (finding 3).

## Findings

Severity follows the review policy. CRITICAL means a test would fail,
production breaks, or data or secrets are lost. Nothing reached CRITICAL.
Confidence is 1–10.

### 1. `localModel()`'s doc comment describes a coupling that no longer exists

**Fixed:** the comment now reads as the fix below proposes.

INFORMATIONAL, confidence 9. Found by the core pass and the
maintainability specialist.

`lib/prepared-note.ts:58-60`:

> The local model's id, `LOCAL_AI_MODEL`. A note's input hash includes it,
> so the sweep and Tonight's read must agree on it.

Since `lib/prepared-notes.ts:304`, Tonight's read hashes with
`stored.model`, not `localModel()`. Only the sweep (`lib/prepared-notes.ts:181`)
and the backfill script (`scripts/backfill-prepared-notes.ts:115`, through
`config.model`) use the configured model. The comment now contradicts
ADR-0011's "control generation only".

Fix (mechanical): "The local model's id, `LOCAL_AI_MODEL`. The sweep hashes
with it and records it on each note; Tonight's read hashes with the note's
recorded model instead."

### 2. `DESIGN.md` still says a stored note is hidden when the feature is off

**Fixed:** the sentence now says a stored note shows whether or not the
local model is configured, citing ADR-0011. The "out of date, updating"
rule at `DESIGN.md:321` is left for finding 3.

INFORMATIONAL, confidence 8. Found by the design specialist.

`DESIGN.md:297-299`, Prepared brief:

> With no note, or the feature off, nothing renders — not even an empty
> frame.

After ticket 01, a stored note renders with every `LOCAL_AI_*` variable
blank. `e2e/tonight.spec.ts` asserts exactly that, under a server
environment that blanks them. `CLAUDE.md` asks for `DESIGN.md` to change
in the same commit as the decision.

Fix: "With no stored note, nothing renders — not even an empty frame. The
`LOCAL_AI_*` variables control generation only; a stored note shows
whether or not they are set." Finding 3 changes the same section.

### 3. "out of date, updating" is false once the sweep is off

**Fixed:** the label always reads just "out of date", and `DESIGN.md`'s
Out of date rule says it promises no update.

INFORMATIONAL, confidence 8. Found by the red team.

`app/prepared-brief.tsx:76` appends `" · out of date, updating"` to an
out-of-date note's label. `DESIGN.md:321-323` gives the reason: "The loop
rewrites the note on its own; the marker tells the Household to read with
care, not to act."

Before ticket 01, a server with the feature off rendered no note, so
"updating" always held. Now the path is:

1. A server with `LOCAL_AI_BASE_URL` or `LOCAL_AI_MODEL` unset.
   `startPreparedNotesLoop` returns early (`lib/prepared-notes-loop.ts:21`),
   so no sweep runs.
2. An undecided date inside the six-day window has a stored note.
3. The Household logs, rejects, or writes a Day note, or a deploy changes
   the prompt text.
4. `preparedNoteFor` compares `inputHash(built, stored.model)` with the
   stored hash, gets a mismatch, and returns `out-of-date`.

The label then says "updating", and nothing will ever rewrite the note.
Its stale Prepared ranking also stays the default order on load
(`app/tonight-screen.tsx:232`) until the date leaves the window.

ADR-0011 (lines 83-88) accepts "notes already written stay, labelled out
of date as the inputs move on". The copy and `DESIGN.md:321` were not
updated to match.

This is a user-visible copy decision, so it needs input. The options are
below. In each, `DESIGN.md:321` is rewritten to match.

- **Recommended:** drop ", updating" when generation is off. Pass
  `preparedNotesEnabled()` into the note view.
- Always say just "out of date".
- Also hide the out-of-date ranking when the sweep is off.

Production today has the model set (memory: notes come from qwen3.8 on
the llama.cpp box). So this shows only on a server with the variables
unset, the e2e server among them.

### 4. The fixture's 7:00am is an hour off on daylight-saving change days

**Fixed:** `atLocalHour` now applies the offset at the first estimate. A
probe of the real function gave 7:00 on 2026-11-01 (15:00Z, PST), on
2027-03-14 (14:00Z, PDT), on an ordinary day, on Europe/London's spring
change, and in UTC. The old code gave 14:00Z and 15:00Z on the two LA
change days. The browser suite passed 15/15 after the change.

INFORMATIONAL, confidence 8. Found by the adversarial pass, and checked
here by hand.

`e2e/prepare-db.ts:51-72`, `atLocalHour`. It corrects the UTC guess
(`Date.UTC(y, m, d, 7)`, which is near local midnight) by the zone's offset
at the guess, not at local 07:00. In `America/Los_Angeles`:

- **2026-11-01, fall back:** the guess, 07:00Z, is 00:00 PDT. The result is
  14:00Z, which is 6:00am PST. The screen shows "Prepared 6:00am".
- **2027-03-14, spring forward:** the guess, 07:00Z, is 23:00 PST on the
  13th. The result is 15:00Z, which is 8:00am PDT. The screen shows
  "Prepared 8:00am". The adversarial pass gave this date as 2027-03-08; the
  2027 change is on 03-14.

No spec asserts the time, so nothing fails. But `e2e/README.md:315` ("Both
notes read 'Prepared 7:00am' today") is wrong on those days. An eye-check
on 2026-11-01, two days from this review, could flag a bug that isn't
there.

Fix: apply the correction a second time, using the offset at the first
result. Or route through the advisory helper in A2 once that helper is
DST-correct (its own caveat is the same hour).

### 5. The fixed port 3100 can let one worktree's run test another's server

INFORMATIONAL, confidence 5. Found by the adversarial pass; the
investigation is the user's call. Medium confidence: check that this is a
real issue.

`playwright.config.ts:17,20-26`. With `reuseExistingServer: false`,
Playwright refuses a port that is already busy, but it checks only before
launching the command. The race:

1. Worktree B passes that check while A's server is still in
   `tsx e2e/prepare-db.ts`.
2. A's `next start` comes up on :3100.
3. B's readiness poll finds A's server, and B's tests run against A's build
   and database.
4. B's own `next start` then fails with `EADDRINUSE`.

The result is a green run for code B never served. The window is seconds,
but `CLAUDE.md` describes parallel worktree agents.

Fix options:

- Derive the port from the worktree name, as the database name is derived.
- Have `ready` or a header confirm the run's own server.

Related, at confidence 4: `vitest.test-db.ts:16-21` names the database from
the worktree's basename only. Two Paseo worktrees with the same leaf name
under different ids (`…/00mll76b/lucid-kiwi` and `…/<other>/lucid-kiwi`)
share `pmad_e2e_lucid_kiwi`, and would reseed each other. The DB suite
already had this.

### 6. The blanked-variable list is kept by hand

**Fixed** by the second option: `e2e/server-env.test.ts`, a unit test that
fails when the server reads a `process.env` name `serverEnv` does not set.
The allowlist option would not work on its own: Playwright always merges
the shell's `process.env`, and Next still fills undefined names from `.env`.

INFORMATIONAL, confidence 5. Found by the adversarial pass.

`e2e/server-env.ts:20-31`. `next start` still loads `.env`, `.env.local`
and `.env.production` for any variable the process leaves undefined. Per
`docs/agents/dev-server.md`, a worktree's `.env.local` is `.env.k8s`.

The current state is safe:

- Every service variable the app reads is blanked: `ANTHROPIC_API_KEY`,
  `AI_MODEL`, `GOOGLE_PLACES_API_KEY`, and the five `LOCAL_AI_*` variables.
  The full list of `process.env` names in `app/`, `lib/` and `db/` is:
  `AI_EFFORT`, `AI_MODEL`, `AI_TIMEOUT_MS`, `ANTHROPIC_API_KEY`,
  `APP_PASSWORD`, `APP_SECRET`, `APP_TZ`, `DATABASE_URL`,
  `GOOGLE_PLACES_API_KEY`, the `LOCAL_AI_*` set, `NEXT_RUNTIME` and
  `NODE_ENV`.
- `DATABASE_URL` is overridden explicitly.
- The live run showed no AI search box.

The risk is a future metered variable that nobody adds to `BLANKED`. It
would leak into the e2e server from `.env.local`, against the billed-call
rule.

Fix options:

- Build the server env as an allowlist (the `.env.ralph` keys plus `PATH`
  and Playwright's own variables).
- Add a unit test that fails when a `process.env.X` read in `app/` or
  `lib/` is in neither `.env.ralph` nor `BLANKED`.

### 7. A bare `npx playwright test` tests whatever `.next` was built last

**Fixed**, the README part only: `e2e/README.md` says a bare run serves the
last build. The `BUILD_ID` check and the standalone server were not done.

INFORMATIONAL, confidence 5. Found by the adversarial pass.

`package.json` `test:e2e` builds first. `e2e/README.md:281-282` also
offers `npx next build && npx playwright test`, and run 006 here was a
build-less rerun. A rerun after a code change, or after switching branches
in the worktree, passes against the old build with no warning.

Separately, `next.config.ts` sets `output: "standalone"`. The suite serves
through `next start`, which warns about this (ticket 02's Comments), not
through the `server.js` the Docker image runs. A dependency missing from
the standalone trace would not be caught.

Fix options:

- Say in the README that a bare `playwright test` reuses the last build.
- Or have `prepare-db.ts` compare the `.next/BUILD_ID` time against
  `HEAD`'s commit time.
- Optionally serve `node .next/standalone/server.js` (it needs `public/`
  and `.next/static` copied in, as the Dockerfile does).

### 8. Eye-check findings sit in ticket Comments, not the tracker

**Fixed** by `c3fe6ee`, which fixed items 1–3 rather than filing them:

- Login's padding.
- Catalog row actions at 375px.
- The Log row kind bar, with "Row lists" in `DESIGN.md` reworded.

Item 4 is finding 9.

INFORMATIONAL, confidence 7. Found by the core pass.

`e2e/README.md:346` says "A finding goes to the issue tracker". Ticket
05's Comments hold four eye-check findings, none filed:

1. Login on desktop is 100px off-centre. `body` keeps
   `padding-left: var(--rail-width)` at 720px and up, though Login has no
   rail (`app/globals.css`).
2. On the Catalog at 375px, the four row actions squeeze Option names onto
   two or three lines.
3. Log and Option-detail History rows carry the kind wash with no 3px kind
   bar, against `DESIGN.md`'s "Row lists" ("the background plus kind bar
   already edge the row").
4. The PRD and ticket 04 describe a kind bar on Catalog rows, against
   `DESIGN.md` (also finding 9).

Fix: file 1–3 under `.issues/` (see `docs/agents/issue-tracker.md`).

### 9. The PRD's Catalog wording is stale against `DESIGN.md`

**Fixed:** user story 13, the Catalog spec line, the dark-check line (now
"each kind mark"), and the eye-check list in the PRD's README section.

INFORMATIONAL, confidence 6. Found by the core pass.

`.issues/browser-tests/PRD.md`, user story 13 and "The specs" ("Catalog:
every fixture Option is listed with its kind bar"). The README's
eye-check list ("the 3px kind bar and its tint or wash on every Option
row") was corrected in `e2e/README.md:338-340`, but the PRD was not. This
matters only if the PRD is read again as the spec.

Fix: amend the two lines to "under its kind's section", or note the change
in the PRD's Further Notes.

## Advisory (optional simplifications)

These came from the simplification specialist. They are not defects.

### A1. `createAndMigrate` repeats the DB suite's global setup

Confidence 7, about 15 lines removable.

`e2e/prepare-db.ts:72-88` and `vitest.global-setup.ts:15-37` do the same
three steps: an admin URL on `/postgres`, a `CREATE DATABASE` that ignores
`42P04`, then `migrate(drizzle(client), { migrationsFolder: "drizzle" })`.
They differ only in the name and `onnotice`.

Fix: export `createAndMigrate(databaseUrl)` from `vitest.test-db.ts` or
`db/test-support.ts`, and call it from both.

### A2. `atLocalHour` duplicates a repo helper

Confidence 6, about 20 lines removable.

`scripts/import-prior-data.ts:150` already exports
`localMidnightUtc(sqlDate, timeZone)`, which is tested and guards its
`main()`. The proposal is
`new Date(localMidnightUtc(todaySql, appTimeZone()).getTime() + 7 * 3_600_000)`.

Caveat: adding a fixed 7 hours is also an hour off on DST change days (see
finding 4), and `e2e/` would then import from `scripts/`. Weigh this
against simply fixing finding 4 in place.

## Appendix: low confidence, or rejected

These stay out of the main count.

- **Fixed: `prepare-db.ts` truncates whatever `DATABASE_URL` names**
  (security; it now refuses a database without `_e2e_` in its name;
  confidence 4). Under Playwright this is safe: Playwright 1.64.1 merges
  `process.env` first and `webServer.env` last
  (`runner/index.js:872-876`), so `serverEnv.DATABASE_URL` always wins. The
  adversarial pass confirmed this. The unguarded path is someone running
  `tsx e2e/prepare-db.ts` by hand with a shell `DATABASE_URL` pointing at
  dev or production. A one-line guard (throw unless the name contains
  `_e2e_`) would close it, if wanted.
- **A run that crosses midnight in `APP_TZ` fails** (adversarial,
  confidence 4). The seed fixes "today" at server start;
  `householdDay()` and the server's own today move on. The failure is loud
  (mismatched notes), not corrupt.
- **The overflow check ignores clipping ancestors** (adversarial,
  confidence 4). It would flag children of an `overflow-x: auto` strip or
  an off-canvas panel. No current screen has one, and the failure would be
  loud.
- **`contrast.ts` parses only `rgb()`/`rgba()`** (adversarial, confidence
  3). If the tokens move to `oklch()`, Chromium returns that form and the
  parser throws "Unparsed colour". The failure is loud. It also ignores
  background images and gradients.
- **Rejected: "the `!` in `expectNav` stops `expect(box).not.toBeNull()`
  from firing"** (`e2e/visit.ts:126-127`). A TypeScript non-null assertion
  has no runtime effect. A null box reaches the labelled `expect`.

## Adversarial synthesis

- **More than one source:** finding 1 (core + maintainability). Findings 2
  and 3 are two views of the same section of `DESIGN.md` (design + red
  team).
- **Specialists only:** findings 1, 2, A1, A2, and the appendix item on
  `prepare-db.ts`.
- **Red team only:** finding 3.
- **Claude adversarial only:** findings 4, 5, 6, 7, and the appendix
  items other than `prepare-db.ts`. It found no defect in the production
  change itself:
  - `getPreparedNote` already drops claim-only rows
    (`db/queries.ts:548`).
  - The prompt builders read no env.
  - "Current after a model switch" is ADR-0011's stated behaviour.
- **Its recommendation:** merge, with a follow-up for the :3100 race,
  because that race is the only way a run can report green for code it
  never served.
- **Sources:** checklist and specialists ✓, Claude adversarial ✓, Codex ✗
  (sandbox unavailable).

## Totals

9 findings, all INFORMATIONAL. Findings 1–4 and 6–9 are fixed; 5 is
open. There are 2 advisory items and 5 appendix items. The
review is incomplete only because the deliberate breaks were not re-run
here.

What remains: finding 5, left as a follow-up.
