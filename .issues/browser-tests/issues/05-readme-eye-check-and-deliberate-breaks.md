# 05 — README, the eye-check, and the deliberate breaks

Status: done
Type: AFK

## Parent

[Spec: Browser tests](../PRD.md)

## What to build

Someone starting the suite a month from now knows what it needs, what the
fixture holds, and how to judge the screenshots. The suite is shown to fail
when it should.

- A README beside the suite: Postgres on 5434 (the `pmad-pg` container),
  then `corepack pnpm test:e2e`, with the `npx` equivalents where corepack
  is unavailable. A dev server in the same worktree can keep running. What
  the fixture holds and that it is wiped every run. The agent eye-check:
  open the PNGs and check them against a short list drawn from
  `DESIGN.md`: flat surfaces with no shadows, cards, or nested surfaces;
  Fraunces only on titles and Option names; numerals in Geist Mono aligned
  down a column; the 3px kind bar and its tint or wash on every Option
  row; heatmap chips across green, tan, and red; nothing cramped, clipped,
  or ellipsised where it should fit at 375px; in dark, nothing reading as
  a light-theme leftover. Roughly 1–1.5k tokens per image, so on request,
  not after every run.
- Verification: the suite green twice in a row; every PNG opened once and
  judged against the checklist, with anything found filed as a comment on
  this ticket rather than fixed here; two deliberate breaks each seen to
  fail and then reverted: a fixed 1000px-wide element on Catalog against
  the overflow check, and a renamed font against the loaded-face check.

## Acceptance criteria

- [x] The README covers how to run, the fixture, and the eye-check list
- [x] Two consecutive green runs
- [x] Every screenshot opened once; findings, if any, noted under Comments
- [x] The overflow check fails on a deliberate 1000px-wide element, then passes once reverted
- [x] The font check fails on a renamed face, then passes once reverted
- [x] The verification gate still passes without Postgres

## Blocked by

- [03 — Tonight specs, today and tomorrow, light and dark](03-tonight-specs-light-and-dark.md)
- [04 — Catalog, Option detail page, and Log specs](04-catalog-detail-and-log-specs.md)

## Comments

- Deliberate breaks. The renamed face (`Geist Mono` for `GeistMono`) failed
  Login at both widths with no FontFace found, and passed once reverted. The
  first 1000px element passed: it sat in a flex row, where it shrank. Moved
  into `<main>`'s column it failed in only some runs, which exposed a real
  hole in the shared checks. Each screen's `loading.tsx` skeleton streams in
  first with its own `h1`, so the overflow, font, and nav checks and the
  screenshot often measured the skeleton (6 of 8 repeats). Every visit now
  waits for a `ready` element only the finished screen has. After that the
  break failed 12 of 12 at every width (scroll width 1016 / 1306), and it
  passed once reverted.
- Two consecutive green runs (15/15 each). The gate passes, and nothing in it
  reaches Postgres.
- Eye-check, all 14 PNGs. Findings, not fixed here:
  1. Login on desktop is off-centre by 100px. `body` keeps
     `padding-left: var(--rail-width)` at 720px and up, though Login has no
     rail (`app/globals.css`).
  2. Catalog at 375px: the four row actions (Edit, Archive, Delete, Pick)
     squeeze Option names onto two or three lines ("Lemon / Chicken /
     Traybake").
  3. Log and Option-detail History rows carry the kind wash but no 3px kind
     bar. `DESIGN.md` "Row lists" says "the background plus kind bar already
     edge the row" for them, so the code or the doc is stale.
  4. Ticket 04 and the plan describe a kind bar on Catalog rows. `DESIGN.md`
     has them untinted; the specs follow `DESIGN.md` (see ticket 04).
- Fixed in the fixture: tomorrow's note said "tomorrow" on its own day and
  reused today's rationales ("Two nights ago" beside a 3d chip).
- Eye-check findings 1–3 fixed. Login: the rail's `padding-left` now applies
  only when the nav renders (`body:has(> nav[aria-label="Primary"])`), and
  the Login spec checks the `h1` centres on the viewport. Catalog: below
  720px a row's four actions take their own line under the name. Log and
  Option-detail History entry rows carry the kind bar over their wash, and
  the Log spec checks every row's 3px bar. Rejection rows stay on
  `danger-wash` with no bar; `DESIGN.md` "Row lists" now says so. Finding 4
  needs no change: `DESIGN.md` and the specs agree.
