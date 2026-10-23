# 04 — Ranking resolution: one pure match of a ranking against Tonight's rows

Status: done
Type: AFK

## Parent

[Plan: Architecture deepening (2026-10-23)](../../../plans/architecture-deepening-2026-10-23.md)

## What to build

The Picker matches an id-ranked list against the rows on screen twice, inside
React: the Prepared ranking reorder (`app/tonight-screen.tsx:857-872`, which
also deduplicates and appends the rows the note didn't name) and the AI search
result match (`:883-890`). Neither can be tested without rendering Tonight.

- **One function** in `lib/picker-view.ts`, beside `pickerView`: resolve an
  id-ranked list (id plus **AI rationale**) against the rows, skipping ids with
  no row, deduplicating, and optionally appending the unnamed rows in their
  existing order. Both `useMemo`s call it.
- **One row type.** If nothing else distinguishes `AiRankingRow`
  (`lib/ai-search.ts`) and `PreparedRankingRow` (`db/schema.ts:183`), make them
  one type.
- **Out of scope.** `backfillOmittedCandidates` (`lib/ai-search.ts:586`) stays:
  it works on ids on the server, before any rows exist.

## Acceptance criteria

- [x] Unit tests in `lib/picker-view.test.ts`: order kept; ids with no row
      skipped (Picked, Rejected, Closed since); duplicates dropped; unnamed rows
      appended in order when asked, and not when not
- [x] The two `useMemo`s in `app/tonight-screen.tsx` call the function and hold
      no matching logic of their own
- [x] Existing screen tests pass unchanged
- [x] `corepack pnpm typecheck`, `lint`, `test`, `build` all green

## Blocked by

- Nothing technically. Fourth in the plan's order so issue 05 can build on it.

## Comments

- `resolveRanking(ranking, rows, { appendUnnamed })` in `lib/picker-view.ts`
  returns `{ row, reason? }[]`; unnamed rows appended under a Prepared ranking
  carry no rationale. The Prepared memo only projects that into the rows
  `pickerView` takes and the id → rationale map the rows read; the AI memo
  returns it as is.
- One change in behaviour: the AI search match now also drops a repeated id.
  The server's parse already deduplicates, so nothing on screen changes.
- One row type: `PreparedRankingRow` is gone; `db/schema.ts`, `db/queries.ts`,
  and `lib/prepared-notes.ts` use `AiRankingRow` from `lib/ai-search.ts`
  (type-only imports, as `db/queries.ts` already does from `lib/`).
- Refactor, not a bug: the four new tests went red only on the missing
  function, then green. `app/tonight-screen.test.tsx` is unchanged and passes.
- Gate: typecheck, lint, test (513), test:db (126), and build all green.
