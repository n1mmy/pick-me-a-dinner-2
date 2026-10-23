# 02 — Snapshot module: one built value, canonical order

Status: done
Type: AFK

## Parent

[Plan: Architecture deepening (2026-10-23)](../../../plans/architecture-deepening-2026-10-23.md)

## What to build

Shaping the AI snapshot is spread across `lib/ai-search.ts`,
`lib/snapshot-source.ts`, `lib/snapshot-format.ts`, `lib/rejections.ts`, and
`lib/day-suppressions.ts`, and Prepared notes import the snapshot types from the
Claude client module. Give the snapshot its own module.

- **Move.** A new `lib/snapshot.ts` absorbs `lib/snapshot-source.ts` and, from
  `lib/ai-search.ts`, the snapshot types and `buildSnapshot`. `ai-search.ts`
  keeps the Claude client, its prompt, and `parseRankingText` (sharing the
  parser or prompt framing is out of scope). `lib/snapshot-format.ts` stays.
- **One value.** The module returns one built value carrying the snapshot, the
  index-to-id map, and the names. `createAiSearchClient` and
  `createPreparedNoteClient` take that value instead of a `(snapshot,
  idByIndex)` pair the caller must keep matched. Update the route, the sweep,
  and both eval scripts (read the scripts; **do not run** them — both call a
  model, and `ai-search-eval.ts` is billed).
- **Canonical order.** Same-date Log entries sort by a fixed key (e.g. date,
  then Option id), so the input hash can't change with Postgres row order
  (`getFullLogForSnapshot` has no `ORDER BY`; `buildSnapshot` sorts on
  `eatenOn` only). Every stored note's hash may change once; that one-time
  rewrite is accepted, and no billed eval is run.

## Acceptance criteria

- [x] DB test for the snapshot (none exists today): candidates drop Picked,
      Rejected, and Closed Options for the date; Day notes and Rejections appear
      as dated history
- [x] Test (red first): two Log entries on the same date produce the same
      snapshot whichever order they are read in
- [x] `app/api/ai-search/route.test.ts` no longer partially mocks
      `lib/ai-search`, and its re-tests of candidate drops are deleted in
      favour of the snapshot test
- [x] `lib/prepared-note.ts` imports nothing snapshot-shaped from
      `lib/ai-search.ts`
- [x] Existing AI search and Prepared note tests pass
- [x] `corepack pnpm typecheck`, `lint`, `test`, `test:db`, `build` all green

## Blocked by

- Issue 01 (it calls `snapshotForDay`, which moves here)

## Comments

- 2026-10-23: Built with /tdd. The order bug was real: two same-date Log
  entries built different snapshots depending on input order (red), and now
  tie-break on Option id (green). That test is in-process (`buildSnapshot`
  fed both orders), as agreed with the user, rather than relying on Postgres
  row order.
- `BuiltSnapshot` now carries `nameById` too, built by `buildSnapshot`, so
  `snapshotForDay` returns it as is. Both clients take it whole:
  `search(built)`, `prepare(built)`.
- The route test now mocks `lib/snapshot` and `lib/ai-search` whole, and
  checks only the wiring (key check, Selected day, query, result
  forwarded). Its candidate-drop, Day note, Planned dinner and Closed-day
  cases are deleted; `lib/snapshot.db.test.ts` covers them against the DB,
  and `lib/snapshot.test.ts` (the `buildSnapshot` suite, moved from
  `lib/ai-search.test.ts`) in detail.
- Neither eval script was run.
