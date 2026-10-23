# 01 — Prepared note status: one module owns freezing and staleness

Status: done
Type: AFK

## Parent

[Plan: Architecture deepening (2026-10-23)](../../../plans/architecture-deepening-2026-10-23.md)

## What to build

Whether a date's **Prepared note** is frozen or out of date is worked out in
four places today, and they disagree. Put the rule behind one module.

- **Merge.** Fold `lib/tonight-prepared-note.ts` into `lib/prepared-notes-job.ts`
  and rename the result `lib/prepared-notes.ts`. Two entry points: the sweep,
  and Tonight's read of a date's note (the stored note plus whether it is
  frozen or out of date). Eligibility, the input hash, and claim/store/release
  become private where nothing else needs them; tests go through the two entry
  points.
- **Frozen.** A note is frozen when its date is **decided** — any Log entry,
  including a Pick of an Option since Archived (`CONTEXT.md`: **Day decision**)
  — or when the date has passed. A frozen note is never out of date, and its
  snapshot is never built on Tonight's read. Decided dates come from their own
  query (any Log entry, no join to `options.active`). Don't loosen
  `getFullLogForSnapshot`: the AI snapshot reads it too, and must stay
  active-only (`CONTEXT.md`: **Recency** — an Archived Option's history does
  not count).
- **Conditional store.** Storing a note is one update that writes only if the
  date still has no Log entry; the claim is released either way. No other
  locking (the repo's scope rule).
- **One model id.** `LOCAL_AI_MODEL` is read in one place. `app/page.tsx` stops
  passing `decided` and `model`; `instrumentation.ts` stops passing the model
  twice.
- **Brief.** `app/prepared-brief.tsx` stops overriding `outOfDate` itself and
  shows the marker exactly when the read says so. The brief still starts hidden
  behind "Read the note" whenever the date has a Pick — `DESIGN.md` is
  unchanged.

Test-first: write each suspected bug below as a failing test before the
refactor. A test that won't go red means the bug wasn't real — drop it and say
so in Comments.

## Acceptance criteria

- [x] DB test (red first): a past undecided date with a stored note whose
      inputs have since changed reads as not out of date
- [x] DB test (red first): a Pick landing between a date's snapshot and its
      store leaves the previously stored note untouched, and releases the claim
- [x] DB test (red first): a date whose only Pick is a since-Archived Option is
      frozen — the sweep skips it and Tonight's read says frozen
- [x] `getFullLogForSnapshot` is unchanged (still active-only); the sweep no
      longer calls it for decided dates
- [x] Existing sweep and loop tests pass through the new entry points; tests no
      longer import claim/store/release directly unless they are the subject
- [x] `lib/tonight-prepared-note.ts` is gone; `app/page.tsx` passes neither
      `decided` nor `model`
- [x] On the dev server with the loop forced on (moved from Prepared notes issue
      06): Pick, and the note stops regenerating on the next tick; remove the
      Pick, and it regenerates (if the worker can't run this, say so in
      Comments for a human check) — not run here, see Comments
- [x] `corepack pnpm typecheck`, `lint`, `test`, `test:db`, `build` all green

## Blocked by

- Nothing. First in the plan's order.

## Comments

- 2026-10-23: Built with /tdd. All three suspected bugs were real: the
  past-date read, the mid-generation Pick, and the Archived Pick each went red
  on an assertion before the fix (4 failing tests, sweep and read), then green.
- The read is `preparedNoteFor({ day, today })` and returns a `status`
  (`current` / `out-of-date` / `frozen`), so frozen is its own signal rather
  than "not out of date". Decided dates come from the new
  `getDecidedDates(from, to)` (no join to `options.active`); the store is one
  `UPDATE … WHERE NOT EXISTS (Log entry on the date)`, releasing the claim if
  it wrote nothing. `LOCAL_AI_MODEL` is read only by `localModel()` in
  `lib/prepared-note.ts`.
- `eligibleDays` and `inputHash` are private now: their window,
  late-evening-timezone and month-rollover cases moved to `runSweep` DB tests.
  The prompt-version hash test went with `inputHash`'s test-only
  `promptVersion` override, so bumping `PREPARED_PROMPT_VERSION` is no longer
  pinned by a test. `claimDay` stays exported for the other-replica tests.
- Deleted the screen test "never marks a decided date's frozen note out of
  date": the brief no longer overrides the flag, and the read can't produce
  that combination.
- **Dev-server freeze check not run — left for a human.** Running it means
  writing a Pick and a Day note to the dev DB (the prod copy at
  localhost:5434). This session was denied writes to that shared DB. To run
  it: build and start the app with `NODE_ENV=production`, so the loop runs, or
  call `runSweep` once per tick. Pick on an undecided date in the window and
  check the next tick doesn't ask for it. Remove the Pick after changing that
  date's input, and check the next tick does ask for it.
