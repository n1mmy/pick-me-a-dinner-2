# 02 — The background sweep and loop

Status: done
Type: AFK

## Parent

[Spec: Prepared notes](../PRD.md)

## What to build

The job that keeps each eligible date's Prepared note current, and the loop
that runs it in production. Ends with notes landing in `prepared_notes` and
nothing on screen.

- **`lib/prepared-notes-job.ts`** (or beside the queries in `db/queries.ts` if
  that reads better):
  - `eligibleDays(today, datesWithLogEntries)`, pure: today through today+6 in
    `APP_TZ` (use `lib/local-day.ts`), minus dates with a Log entry, today
    first. Past dates never appear. A decided date being skipped is what
    **freezes** its note; removing the Pick makes it eligible again.
  - `inputHash(snapshot, model)`, pure: SHA-256 over `JSON.stringify(snapshot)`,
    the model id, and `PREPARED_PROMPT_VERSION`.
  - `claimDay(date)`, one statement: `INSERT … ON CONFLICT (prepared_for) DO
    UPDATE SET claimed_until = now() + interval '20 minutes' WHERE
    claimed_until IS NULL OR claimed_until < now() RETURNING input_hash`. No
    row back means another replica has it; skip the date. The lease is longer
    than the client timeout from issue 01.
  - `storeNote(date, note)` writes brief, ranking, hash, model, `prepared_at`,
    and clears the claim. `releaseClaim(date)` clears only the claim and keeps
    the previous note.
  - `runSweep()`: for each eligible day, one at a time, build `snapshotForDay({
    asOf: day, query: "" })`, hash it, skip if it matches the stored hash;
    otherwise claim, call `prepare`, then store on success or release on
    failure. A failure never erases the last good note.
- **The loop.** In `instrumentation.ts`, inside the existing `nodejs` branch and
  after the boot checks, imported dynamically the way the boot checks are: if
  `NODE_ENV === "production"` and `preparedNotesEnabled()`, run once
  immediately and then every ~10 minutes via `setInterval`, guarded by an
  in-process "running" flag so ticks never overlap. Dev servers never start it.

Scope (from `CLAUDE.md`): the per-date claim is the only replica coordination.
No queue, retry backoff, CronJob, leader election, or version history.

## Acceptance criteria

- [x] `eligibleDays` tests: seven dates from today in `APP_TZ`, today first;
      decided dates removed; a timezone-edge "today" handled
- [x] `inputHash` tests: changes with the snapshot, the model, or the prompt
      version; stable otherwise
- [x] DB tests (`*.db.test.ts`): two simultaneous `claimDay` calls produce one
      winner; a live claim blocks; an expired claim can be retaken;
      `storeNote` writes and clears the claim; `releaseClaim` keeps the
      previous note
- [x] `runSweep` test with a stubbed client: unchanged days are skipped, changed
      days are stored, a failed `prepare` releases and keeps the prior note,
      decided days are never prepared
- [x] The loop starts only in production with the feature enabled, and ticks
      never overlap
- [x] `corepack pnpm typecheck`, `lint`, `test`, `build` all green
      (`test:db` isn't in the Ralph gate — note in Comments whether it was run)

## Blocked by

- Issue 01 (table, client, prompt version)

## Comments

- Done. `test:db` was run and passes (116 tests, 13 new in `lib/prepared-notes-job.db.test.ts`). `getPreparedNote(date)` landed in `db/queries.ts` here, ahead of issue 05, so the DB tests read notes back through it.
- Any input change regenerates all seven dates, not just one: every date's snapshot carries the full Log and every Day note. The loop also catches a thrown sweep so it never surfaces as an unhandled rejection.
- Not yet run: a real sweep against Strata with the loop forced on (plan's Slice 1 verify step).
