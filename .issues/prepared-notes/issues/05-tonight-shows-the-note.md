# 05 — Tonight shows the Prepared note

Status: ready-for-agent
Type: AFK

## Parent

[Spec: Prepared notes](../PRD.md)

## What to build

The Selected day's brief under the heading, and its Prepared ranking as what
the list shows on load, stacked under any Claude result and over the
deterministic list.

- **Read.** `db/queries.ts` gains `getPreparedNote(date)`. `app/page.tsx` loads
  it with the other Selected-day data. For an **undecided** date it also
  computes `outOfDate` by hashing the current `snapshotForDay({ asOf, query:
  "" })` with `inputHash` and comparing it to the stored hash (one extra
  full-Log read on load; acceptable). A decided date is never out of date. Pass
  `preparedNote: { brief, ranking, preparedAt, outOfDate } | null` and
  `preparedNotesEnabled()` to the screen.
- **Layers.** In `app/tonight-screen.tsx`, beside `aiResults`, add
  `preparedDismissed` state. Rows on show: `aiResults` if set; otherwise
  `preparedNote.ranking` if present and not dismissed; otherwise the
  deterministic list. `clearSearch` clears `aiResults` if set, otherwise sets
  `preparedDismissed`. A Selected-day change resets `preparedDismissed`;
  Claude-result behaviour across a day change stays as it is. The Prepared
  ranking renders through the same AI-result row path, with the same filtering
  of Options since Picked, Rejected, or Closed, and the same append of
  candidates the ranking doesn't name. Update the screen-reader status copy
  for the new mode per `DESIGN.md`.
- **Brief.** A new `app/prepared-brief.tsx`, below the Day note line in every
  Tonight mode: the prepared-time label, the out-of-date marker, and the
  narrow-screen clamp with "Read more", all as `DESIGN.md` (issue 04) specifies.
- **Absent.** With no note, or the feature disabled, Tonight renders exactly as
  it does today.

Read `DESIGN.md` first; it is binding. Don't touch `lib/ranking.ts` or the
Claude AI search path.

## Acceptance criteria

- [ ] `getPreparedNote` returns the stored note or null (DB test)
- [ ] Screen tests (prior art: `app/tonight-screen.test.tsx`): the Prepared
      ranking shows on load; a Claude result sits on top; Clear steps Claude →
      Prepared → deterministic; a Selected-day change un-dismisses; since-Picked/
      Rejected/Closed Options are filtered and unnamed candidates appended
- [ ] Screen tests: the brief renders in picker, decided, and all-filtered
      modes with its label; the out-of-date marker shows only when `outOfDate`;
      the clamp and "Read more" behave as specified
- [ ] Screen tests: no note, or feature disabled, renders no brief and the
      deterministic list
- [ ] 1280px and 375px layouts checked against `DESIGN.md` on the dev server
      with a seeded note (if no browser is available, say so in Comments)
- [ ] Existing ranking and AI search tests pass unchanged
- [ ] `corepack pnpm typecheck`, `lint`, `test`, `build` all green

## Blocked by

- Issues 01 and 02 (the table, and `inputHash` for `outOfDate`)
- Issue 04 (`DESIGN.md` rules)

## Comments
