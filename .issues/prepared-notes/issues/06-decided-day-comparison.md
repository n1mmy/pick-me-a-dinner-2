# 06 — Decided-day comparison

Status: done
Type: AFK

## Parent

[Spec: Prepared notes](../PRD.md)

## What to build

On a date with Log entries, the brief block shows where the frozen note ranked
what was actually eaten.

- A small pure helper takes the frozen ranking and the date's Log entries and
  returns one line per entry: "The note ranked {name} #{n}" from the entry's
  1-based position in the ranking, or "The note didn't rank {name}".
- `app/prepared-brief.tsx` renders those lines on a decided date, styled per
  `DESIGN.md` (issue 04). Out of date is never shown on a decided date.

## Acceptance criteria

- [x] Helper unit tests: ranked at #1, ranked mid-list, not ranked, multiple
      Log entries in one date, empty ranking
- [x] Screen test for decided mode: comparison lines render, no out-of-date
      marker
- [x] On the dev server with the loop forced on: Pick, and the note stops
      regenerating on the next tick; remove the Pick, and it regenerates (if
      the worker can't run this, say so in Comments for a human check) —
      moved to architecture-deepening-2026-10-23 issue 01, see Comments
- [x] `corepack pnpm typecheck`, `lint`, `test`, `build` all green

## Blocked by

- Issue 05

## Comments

- 2026-10-22: Code landed in ead7930 (built with /tdd). The dev-server check is left for
  a human: issue 03 was mid-flight on the same loop, Strata, and an
  uncommitted `lib/prepared-note.ts`, so a forced tick would have run its
  half-tuned prompt and competed for the GPU. The gate ran green against a
  tree that included 03's uncommitted changes.
- The helper, `lib/prepared-comparison.ts`, returns `{ name, rank }` rather
  than finished sentences, so the brief can set `#4` in Geist Mono per
  `DESIGN.md`. It ranks against the note's ranking as stored, not the list on
  show, which has already dropped the Picked Option.
- Also built the decided-date collapse issue 05 left for here: the frozen
  brief starts hidden at every width behind "Read the note" / "Hide the note"
  (`DESIGN.md`, "Prepared brief"). The brief-in-every-mode screen test lost its
  decided case to a dedicated test of that collapse.
- The brief suppresses the out-of-date marker on a decided date itself, not
  only via the page's `outOfDate: false`; the screen test passes
  `outOfDate: true` to prove it.
- 2026-10-23: Marked done. The open dev-server freeze check moved to
  `.issues/architecture-deepening-2026-10-23/issues/01-prepared-note-status.md`,
  which rewrites the freeze rule (conditional store, past dates frozen), so the
  check runs once on the final code.
