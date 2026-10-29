# Code review: `grill-ai-precomputed-dinner-notes` against `main`

Two-axis review (`/code-review`) of `git diff main...HEAD`: 25 commits,
71 files, +8231 / −2470. The branch carries two pieces of work:

- **Prepared notes** (`f4766c5`..`5118bfe`): the feature itself.
- **Architecture deepening** (`b74dcea`..`c1dc788`): five refactor issues
  that move Prepared notes, the snapshot, Day decisions, ranking resolution,
  and the selected-day view each into one module.

The axes are reported separately and on purpose: they are not merged or
reranked against each other. Line anchors are in the HEAD version of each
file. No code was changed in this review.

Reviewed at `c1dc788`. A later re-check found no new commits on the branch.

**Sources**

- **Standards:** `CLAUDE.md` (Scope, Design System), `DESIGN.md`,
  `CONTEXT.md`, `docs/adr/`, `docs/agents/ralph.md`, plus the Fowler smell
  baseline. The repo has no `CODING_STANDARDS.md` or `CONTRIBUTING.md`.
- **Spec:** `.issues/prepared-notes/` (the PRD and issues 01–07), ADR-0011,
  `plans/prepared-notes.md`, `.issues/architecture-deepening-2026-10-23/`
  (issues 01–05), and `plans/old/architecture-deepening-2026-10-23.md`.

## Standards

### Hard violations (documented standards)

1. **The Prepared label's time is not in Geist Mono.** This breaks DESIGN.md
   "Prepared brief" ("`Prepared 2:14pm`, the time in Geist Mono") and
   "Typography" (numerals and dates are mono).
   - `app/prepared-brief.tsx:53` renders `note.label` as one plain string,
     built by `lib/prepared-label.ts:32-33`.
   - No part of the label is wrapped in `font-mono tabular-nums`.
   - The earlier review recorded this as D2, and it is still open.
2. **The `APP_TZ` fallback is written in three places.**
   `lib/local-day.ts:68-73` says the `process.env.APP_TZ ?? "UTC"` fallback
   "lives in exactly one place". Two new copies were added:
   - `app/page.tsx:76`
   - `instrumentation.ts:32`

### Likely violations

3. **The decided-date brief has no `.expand-in`.** DESIGN.md "Motion →
   Inline expand" requires `.expand-in` on a disclosure body when it first
   mounts. On a decided date, "Read the note" mounts the brief without it
   (`app/prepared-brief.tsx:57-66`). The earlier review recorded this as D5.
4. **In decided mode, the `LayerLine` hit area overlaps a row.** DESIGN.md
   "AI layers" says the "44px hit area bleeds into the surrounding gap, never
   onto a row".
   - `app/tonight-screen.tsx:992` uses `-my-3`, a 12px bleed.
   - In decided mode the line sits in a section with `gap-2` (8px) at
     `:430`, so the hit area overlaps the first row by about 4px.
   - Picker mode is fine, because there the gap is 22px.
5. **`LOCAL_AI_*` is read outside its one reader.** `lib/prepared-note.ts:41-45`
   calls `localModel()` "the one place it is read", but two other files read
   the variables directly:
   - `scripts/prepared-note-eval.ts:94-95` reads `LOCAL_AI_MODEL`.
   - `instrumentation.ts:34-35` reads the base URL and key, right next to
     `preparedNotesEnabled()`.

### Smell baseline (judgement calls)

- **Duplicated Code**
  - `lib/prepared-notes.ts:148-149` and `:211-215` both run
    `snapshotForDay({asOf: day, query: ""})` and then
    `inputHash(…, localModel())`. Both could call one `currentInputHash(day)`.
  - `logPrepareCall` (`lib/prepared-note.ts:329`) has the same shape as
    `logModelCall` (`lib/ai-search.ts:764`).
  - The prompt text at `lib/prepared-note.ts:63-202` repeats wording from
    `buildSystemPrompt`. The comment at `:56-62` acknowledges this.
- **Primitive Obsession:** `outcome: string` (`lib/prepared-note.ts:335`)
  could be typed `"ok" | "fallback"`.
- **Data Clumps:** `brief` and `ranking` (plus time and status) are declared
  in four types:
  - `PreparedNote` (`lib/prepared-note.ts:12`)
  - `StoredPreparedNote` (`db/queries.ts`)
  - `TonightPreparedNote` (`lib/prepared-notes.ts:179`)
  - `PreparedNoteView` (`app/tonight-screen.tsx:85`)

  `app/page.tsx:71-77` then copies the fields across one by one.
- **Mysterious Name / glossary drift:** the Prepared ranking is typed
  `AiRankingRow` from `lib/ai-search`, and `db/schema.ts:2` imports that type.
  - CONTEXT.md's Avoid notes rule out "AI ranking" and "AI search" as names
    for a Prepared note.
  - A neutral `RankingRow` would fix the naming. It would also remove the
    dependency from `db/` onto AI search.
- **Speculative Generality:** `PreparedNoteRow` (`db/schema.ts:212`) has no
  users. The earlier review recorded this as M2.
- **Misplaced type:** `PreparedNoteView` is declared in
  `app/tonight-screen.tsx`, and `app/prepared-brief.tsx:6` imports it back
  from there. That makes a type-only import cycle.

### Checked and clean

- The per-date claim and lease in `lib/prepared-notes.ts` might look like
  the "speculative concurrency control" that CLAUDE.md's Scope rule warns
  against. ADR-0011 (lines 53–56) endorses it explicitly, so it is not a
  breach.
- DB tests use the `*.db.test.ts` naming, so the unit gate stays DB-free.
- DESIGN.md is written as current state, with no dates or change history.

## Spec

### Prepared notes (`.issues/prepared-notes/`)

#### (a) Missing or partial

1. **Two manual checks are ticked, but neither was ever run.** Each was
   ticked in its original issue as "moved", then ticked again in the target
   issue with a note saying it was not run.
   - Issue 05 ticks "1280px and 375px layouts checked… — moved to
     architecture-deepening issue 05". The target is
     `.issues/architecture-deepening-2026-10-23/issues/05-selected-day-view.md:48-51,89`.
   - Issue 06 ticks the dev-server Pick/unpick check as "moved to … issue 01".
     The target is `01-prepared-note-status.md:59-61,88`.
2. **The ticked test for prompt-version changes is gone.** Issue 02 ticks
   "`inputHash` tests: changes with … the prompt version".
   - That test existed at `5118bfe` (`lib/prepared-notes-job.test.ts:84`).
   - At HEAD, `inputHash` is private (`lib/prepared-notes.ts:48`), and no
     test covers a change to `PREPARED_PROMPT_VERSION`.
   - Separately, the PRD's "Pure `eligibleDays`" is now async and queries the
     database (`lib/prepared-notes.ts:33`).
3. **The label's time is not in Geist Mono** (`app/prepared-brief.tsx:53`).
   This is the same breach as Standards #1.

#### (b) Scope creep

Each item below is small, and each is documented in an issue or in DESIGN.md.

- The model reply is streamed, and the prompt carries a candidate checklist
  (`lib/prepared-note.ts:278,350`).
- On a decided date, the brief sits behind a "Read the note" collapse.
- The layer line offers "Show ranked list" instead of Clear (see the issue 05
  comments).
- Prepared ranking rows keep the Last note.
- `parseRankingText` gains an optional length argument. The PRD said the
  shared parser would be reused "without changing". Issue 01's comments had
  predicted the change.

#### (c) Implemented, but looks wrong

4. **Prepared rank numbers can disagree with the note's own ranking.**
   DESIGN.md:346 says "a numeral always means the same place in the same
   ranking".
   - `rankOf` is computed after Picked, Rejected and Closed Options have been
     removed from the rows (`app/tonight-screen.tsx:767-774`,
     `lib/picker-view.ts:168`).
   - The comparison line uses the rank stored in the note
     (`lib/prepared-comparison.ts:22`).
   - So after a Rejection, the list can show B as #1 while the comparison
     says "The note ranked B #2".
   - Candidates the note didn't rank are added at the end and get the next
     numbers in sequence, with no rationale.
   - The earlier review recorded this as O1/I5, and it is still open.
5. **Two parts of the code disagree on what "decided" means.**
   - `PreparedBrief` treats a date as decided when `eaten.length > 0`
     (`app/prepared-brief.tsx:34`). `eaten` leaves out Archived Options.
   - `preparedNoteFor` marks a date as frozen even when its only Pick is an
     Archived Option (`lib/prepared-notes.ts:208`).
   - On such a date, the brief shows as advice with no comparison line, even
     though the note is frozen.
6. **The spec documents are out of date.** None of these is a code
   problem; each needs only a wording fix in the docs.
   - PRD:37,161,167 and `plans/prepared-notes.md:25,137,148` still say:
     - a brief of 150–300 words (the code uses 40–70);
     - a timeout of about 15 minutes (the code uses 40);
     - a lease of 20 minutes (the code uses 45).
   - PRD Story 4 still asks the brief to warn about "Restaurants closed that
     day". The brief no longer does, but nothing is lost:
     - the snapshot drops closed Restaurants from the candidates
       (`lib/snapshot.ts:227-232`), so the note never ranks them;
     - the prompt says so on purpose ("closures need no mention",
       `lib/prepared-note.ts:146-147`);
     - the Closed disclosure on Tonight still lists them, whether or not
       there is a note (`app/tonight-screen.tsx:452`).

     Story 4 should say the Closed disclosure carries the warning.

#### Status of the earlier review (`plans/old/prepared-notes-review.md`)

- **Fixed:** C1, I1, I4, I8 (`lib/prepared-notes.ts:107-117,208`;
  `lib/snapshot.ts:338`).
- **Still open:**
  - I2: nothing limits the brief's length (`lib/prepared-note.ts:227`).
  - I3: the `finally` block doesn't abort the request (`:428`).
  - I7: the lease and the timeout are tied together only by a comment.
  - D2, D5, M1 (`app/page.tsx:76`, `instrumentation.ts:31`), M2
    (`db/schema.ts:212`), M3 (`scripts/prepared-note-eval.ts:21`), and O1.

Issue 07 (deploy) is open as intended and was not assessed.

### Architecture deepening (`.issues/architecture-deepening-2026-10-23/`)

The core refactors match the spec:

- `lib/day-decisions.ts` enforces that "a Pick wins", and its store is
  conditional.
- The Tonight read freezes notes on past dates and decided dates.
- The snapshot sorts entries that share a date by Option id.
- `resolveRanking` is in place.
- `TonightScreen` takes four props.
- Under `app/`, nothing outside the tests writes to `dinner_log` or
  `rejections` directly.

#### (a) Missing or partial

1. **Three manual checks are ticked, but none was run.** These are issue 01's
   dev-server check ("Pick, and the note stops regenerating"), issue 03's
   `/browse` check, and issue 05's `/browse` check at 1280px and 375px.
   - Each box is `[x]`, but its own text says the check was "not run".
   - The spec allows a reviewer to "say so in Comments", not to tick the box.
   - `plans/old/architecture-deepening-2026-10-23.md:3` also calls the plan
     "implemented".
2. **Issue 03's rollback replacement doesn't cover what the old test did.**
   This criterion was unticked in `1d0c00f` as "replaced, not met", but the
   replacement doesn't test what it claims to.
   - The old Proxy test (`app/log/actions.db.test.ts` at `b74dcea:356-411`)
     made the Rejection delete fail *after* the Log insert, then checked that
     the insert was rolled back.
   - Every replacement test fails on the *first* statement: a duplicate
     insert, a colliding update, or a refused Rejection.
   - Those tests would still pass if `db.transaction` were removed from
     `addPick` and `editLogEntry` (`lib/day-decisions.ts:51-56`, `:65-76`).
   - The issue argues that "no reachable state makes a write fail *after* its
     Rejection delete". That gets the order backwards: the delete is the last
     statement. The failure that matters is the delete failing after the
     insert has landed.
   - There are two ways forward. Either keep one injection test at module
     level, or record in issue 03 that atomicity is no longer tested.
3. **A third meaning of "decided" is still in place.**
   `app/prepared-brief.tsx:34` sets `decided = eaten.length > 0`.
   - Issue 01 says "The brief still starts hidden … whenever the date has a
     Pick".
   - On a date whose only Pick is a since-Archived Option, the read returns
     `frozen`, but the brief starts expanded.
   - The plan's "Why" section (bullet 3) names this exact `PreparedBrief`
     definition as the problem. This is the same finding as Prepared notes
     (c)5.
4. **Removing the `inputHash` test lost coverage.** The issue states the loss
   but doesn't replace it: nothing fails when `PREPARED_PROMPT_VERSION`
   changes the hash. Issue 01 says "tests go through the two entry points",
   so a `runSweep` test that bumps the version would bring the coverage back.
5. **Minor:** slice 02 of the plan asks for "a new DB test … including the
   order-independence case". The order test is in-process
   (`lib/snapshot.test.ts`), not a DB test. The issue's comments record that
   the user agreed to this.

#### (b) Scope creep

Nothing goes beyond what the issues disclose.

- `lib/tonight-day.ts:232` now builds the Rejected disclosure from tagged
  rows, so an Option that is both Picked and Rejected no longer shows in both
  places. The plan asked for this (bug #5).
- The AI search match now drops a repeated id. Issue 04 discloses this.

#### (c) Implemented, but looks wrong

- Suppose `editRejection` is called with an id that no longer exists, and the
  edit moves it onto a Picked date. It returns `"already-picked"`, where the
  issue describes a silent no-op (`lib/day-decisions.ts:124`). This has no
  real effect.

## Summary

- **Standards:** 2 hard violations, 3 likely violations, and 7 smell
  observations. The worst is that the Prepared label's time is not in Geist
  Mono (`app/prepared-brief.tsx:53`, against DESIGN.md "Prepared brief").
- **Spec:**
  - Prepared notes has 6 findings, plus 9 items still open from the earlier
    review. The worst is that Prepared rank numbers can disagree with the
    note's stored rank after a Rejection (`app/tonight-screen.tsx:767-774`).
  - Architecture deepening has 6 findings. The worst is that issue 03's
    rollback replacement doesn't test atomicity
    (`lib/day-decisions.ts:51-76`).
  - Both sub-reviews flag the same pattern in both features: manual
    `/browse` and dev-server checks ticked `[x]` without being run.
