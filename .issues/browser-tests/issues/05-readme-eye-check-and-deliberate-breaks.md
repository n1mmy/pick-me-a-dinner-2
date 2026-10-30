# 05 — README, the eye-check, and the deliberate breaks

Status: ready-for-agent
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

- [ ] The README covers how to run, the fixture, and the eye-check list
- [ ] Two consecutive green runs
- [ ] Every screenshot opened once; findings, if any, noted under Comments
- [ ] The overflow check fails on a deliberate 1000px-wide element, then passes once reverted
- [ ] The font check fails on a renamed face, then passes once reverted
- [ ] The verification gate still passes without Postgres

## Blocked by

- [03 — Tonight specs, today and tomorrow, light and dark](03-tonight-specs-light-and-dark.md)
- [04 — Catalog, Option detail page, and Log specs](04-catalog-detail-and-log-specs.md)
