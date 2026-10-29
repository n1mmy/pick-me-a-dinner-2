# Prepared notes: pre-landing review

Branch `grill-ai-precomputed-dinner-notes`. First reviewed at `e2ea7bc` against
`main` (merge base `a3920c8`). The base is stale: `git fetch` failed on the SSH
host key, so `origin/main` was not refreshed. At that point the diff was 42
files, +4619/-90.

Run with `/review` (gstack), 2026-10-23. The review stopped at Fix-First and
its edits were reverted, so it applied no fixes itself.

**Re-checked at `c1dc788`** (2026-10-23). The eight architecture-deepening
commits since then (`b74dcea`..`c1dc788`, plan
`plans/old/architecture-deepening-2026-10-23.md`) fixed some findings and moved
most of the cited code:

- `lib/prepared-notes-job.ts` and `lib/tonight-prepared-note.ts` are now
  `lib/prepared-notes.ts`.
- The snapshot builder moved out of `lib/ai-search.ts` into `lib/snapshot.ts`.
- `PreparedRankingRow` is gone.

Every finding below carries a **Status** line, and its locations point at
`c1dc788`. The re-check only covers this review's findings. The new commits'
code got no fresh review.

## Summary

**Pre-Landing Review: 26 findings (1 critical, 25 informational).** That is 21
from this review plus 5 from the GPT-6.1 Sol outside voice (O1–O5). The
original header said 27, but the list has always held 26. The outside voice
independently confirmed C1, I1–I6, and I8.

**Status at `c1dc788`:**

- Fixed: 3 (C1, I1, I4).
- Partly fixed: 1 (I8).
- Still open: 22.
- One advisory simplification (merging `PreparedRankingRow`) is also done.

The critical issue is fixed: `storeNote` now writes only while the date has no
Log entry, and a DB test covers a Pick landing mid-generation.

The review is still **INCOMPLETE**. The DB, browser, and dev-server checks
were not run here. gstack's own Codex passes couldn't start their sandbox, so
the outside voice ran through Paseo instead.

## Scope check

**Scope Check: CLEAN** (lower confidence: no plan file is bound to the branch,
so this uses the commits and `.issues/prepared-notes/` as intent).

- Delivered: issues 01–06 (store, sweep, tune, design rules, Tonight brief and
  ranking, decided-day comparison). There is no scope creep beyond small
  supporting touches to `lib/ai-search.ts` and `scripts/load-env.ts`.
- Since then: the architecture-deepening issues 01–05 landed on this branch.
  Prepared notes issue 07 waits for them. Prepared notes 05 and 06 are now
  `done`, and their open manual checks moved into the architecture issues.
- Still open, and needing a human, a browser, or a dev server:
  - architecture issue 01: the dev-server freeze check (ticked, but its
    Comments say it was not run)
  - architecture issue 05: the 1280px and 375px layout check (ticked, "not
    run here"; Aside isn't available on Linux)
  - architecture issue 03: `needs-info` on its rollback criterion, and its
    `/browse` refusal check was not run
  - Prepared notes issue 07: deploy (`ready-for-human`)

## Critical

### C1. A Pick made mid-sweep overwrites the date's frozen note

**Status: fixed** in `3d35ac9` (architecture issue 01). A narrow inefficiency
remains.

`lib/prepared-notes.ts:89-120`

- `storeNote` now takes the review's optional guard: its UPDATE carries
  `NOT EXISTS (dinner_log for that date)`, and releases the claim when it
  writes nothing. That covers both races: a Pick that lands before the claim,
  and one that lands during generation.
- `getDecidedDates` (`db/queries.ts:293`) counts every Log entry, Archived
  Options included.
- Regression test: `lib/prepared-notes.db.test.ts:228` ("leaves the stored
  note alone when a Pick lands while the date is being generated").

**Residual (low):** `eligibleDays` is still read once per sweep
(`lib/prepared-notes.ts:147`). A date Picked mid-sweep is still claimed and
generated, and only refused at the store. This wastes one 10–40 minute
generation on the shared GPU. A per-date `getDecidedDates(day, day)` check
before `claimDay` would skip it.

Original finding (confidence 9; red team, adversarial): `runSweep` read the
decided dates once and stored with an unconditional UPDATE. A date Picked
while the sweep was still on an earlier date was regenerated without its
Picked Option and overwrote the pre-decision note. Tonight then showed "The
note didn't rank X" for the dinner that was eaten.

## Informational: correctness

### I1. Past undecided days show "out of date, updating" forever

**Status: fixed** in `3d35ac9`.

`preparedNoteFor` treats `day < today` as frozen (`lib/prepared-notes.ts:208`)
and skips the snapshot build. Test: `lib/prepared-notes.db.test.ts:332`.

### I2. The brief has no length bound

**Status: open.** Confidence 7. Core and adversarial.

`lib/prepared-note.ts:227`

`parsePreparedReply` caps each rationale at 600 characters but takes
everything above the marker as the brief. If Strata ever writes reasoning
into `content` (a server or template change, `<think>` leaking), the whole
chain of thought is stored and rendered in full at 720px and wider.

**Fix:** refuse a brief over about 1,200 characters (the prompt asks for
40–70 words, about 450 characters). Return `null` so the last good note
stays. Add a case to the `is unavailable when` table in
`lib/prepared-note.test.ts`.

### I3. The request isn't aborted on failure paths

**Status: open.** Confidence 7. Performance and adversarial.

`lib/prepared-note.ts:413-430`

Three paths leave the HTTP stream open:

- a non-JSON SSE event (`JSON.parse` throws inside `readStream`)
- a non-ok response
- a missing body

On all three, `finally` only calls `clearTimeout(timer)`, so nothing aborts
the request. Strata keeps decoding up to 20k tokens for a reader that is gone,
while the sweep starts the next date on the same shared GPU.

**Fix:** call `controller.abort()` in `finally`. It does nothing once a fetch
has finished.

**Test:** a stub stream with a `data: not-json` event. Assert that the
`fetch` signal is aborted.

### I4. The input hash depends on Postgres row order

**Status: fixed** in `4148489` (architecture issue 02).

`buildSnapshot` now sorts same-date Log entries by Option id
(`lib/snapshot.ts:338-342`). Test: `lib/snapshot.test.ts:654`. As planned,
the fix changes every stored hash once, so expect one full regeneration
after deploy. `getFullLogForSnapshot` still has no ORDER BY, but the
snapshot no longer depends on it.

### I5. Partial rankings are stored as good, and the unranked tail looks model-ranked

**Status: open.** Confidence 6. Adversarial. This is a taste call.

`lib/prepared-note.ts:234`, `lib/picker-view.ts:203-207`,
`app/tonight-screen.tsx:767`

- A reply ranking 3 of 37 candidates overwrites a complete note.
- `resolveRanking(…, { appendUnnamed: true })` appends the missing 34. They
  get continuing `#` ranks and no rationale, under the "Prepared ranking"
  line.
- AI search handles the same case with `backfillOmittedCandidates` and
  `OMITTED_CANDIDATE_REASON`.

This is rarer since v5 sends the candidate checklist.

**Options:** set a coverage threshold before overwriting, and/or give the
tail a "the note left this one out" reason.

### I6. A sweep crossing midnight writes one note for a past date

**Status: open.** Confidence 6. Red team and adversarial.

`instrumentation.ts:31`, `lib/prepared-notes.ts:147`

`now` is fixed per sweep, so a multi-hour sweep that crosses midnight in
`APP_TZ` still generates for what is now yesterday. That contradicts "past
dates are never generated" and wastes up to one generation. Since I1's fix,
Tonight reads such a note as frozen, so the only cost is the wasted
generation.

**Fix:** recompute today per iteration. That needs a clock parameter in place
of the fixed `now`. Low priority.

### I7. The lease-outlasts-timeout invariant lives only in comments

**Status: open.** Confidence 7. Maintainability and testing.

`lib/prepared-notes.ts:59`, `lib/prepared-note.ts:256`

`CLAIM_LEASE` is still a bare `interval '45 minutes'`, and
`REQUEST_TIMEOUT_MS` is still a private 40-minute constant. Both comments
now name the other value, but nothing enforces the rule. The timeout has been
raised once already (`447b3a1`). If the next raise passes 45 minutes, a second
replica can take over a date mid-generation, and no test fails.

**Fix:** export `REQUEST_TIMEOUT_MS`, derive the lease from it (timeout plus
5 minutes), and unit-test lease > timeout.

### I8. The page and the sweep define "decided" differently

**Status: partly fixed** in `3d35ac9`.

- **Fixed:** the sweep (`eligibleDays`) and the page (`preparedNoteFor`) now
  share `getDecidedDates`, which counts every Log entry, Archived Options
  included (`db/queries.ts:293`). A date whose only Pick is later Archived
  stays frozen. Tests: `lib/prepared-notes.db.test.ts:213` and `:321`.
- **Still open (low):** this is the outside voice's third layer. The screen
  (`app/tonight-screen.tsx:160`) and `PreparedBrief`
  (`app/prepared-brief.tsx:34`) still decide "decided" from `tonightsDinner`,
  and that drops Archived Options (`lib/tonights-dinner.ts:63`). On a date
  whose only Pick is Archived, the note is correctly frozen, but Tonight
  renders picker mode with the brief open and no comparison line.
  CONTEXT.md's **Day decision** says that date is decided.

**Fix:** carry a `decided` flag on the Selected-day view from the day's
`dayEntries`, not from the rendered dinner. Then use it for both the screen
mode and the brief.

### I9. No test for runSweep's claim race guard

**Status: open.** Confidence 6. Testing.

`lib/prepared-notes.ts:156`

Nothing tests the `claim.inputHash === hash` branch, where the other replica
wrote the same note between the read and the claim. Deleting the branch, or
its `releaseClaim`, fails no test. The new "leaves a date to the replica that
holds its claim" test (`lib/prepared-notes.db.test.ts:250`) covers
`claim === null` instead.

**Fix:** a DB test that mocks `getPreparedNote` to return null after a first
sweep. Assert that the second sweep asks the client nothing, and that
`claimDay` succeeds afterwards.

## Informational: design and accessibility (DESIGN.md)

All seven are still open at `c1dc788`. Architecture issue 05 reshaped
`TonightScreen`'s props but left these spots as they were.

### D1. Focus drops to `<body>` after "Show ranked list"

**Status: open.** Confidence 8.

`app/tonight-screen.tsx:933-938`

Dismissing the Prepared layer unmounts the focused button. The same happens
to "AI search · Clear" (`:910-914`) when no note is underneath.

**Fix:** move focus to a stable list target after the layer is peeled off.

### D2. The label's time isn't in Geist Mono

**Status: open.** Confidence 8.

`app/prepared-brief.tsx:52-53`, `app/page.tsx:76`

DESIGN.md:304 says `Prepared 2:14pm` has "the time in Geist Mono", but
`preparedLabel()` returns one flat string rendered in sans. The comparison
line in the same block does mono its `#4`.

**Fix:** return the time separately and render it in `font-mono
tabular-nums`.

### D3. The list live region is mounted conditionally

**Status: open.** Confidence 7.

`app/tonight-screen.tsx:382-386`

- Stepping from a no-note day to a note day, with Claude search off, mounts
  the region already holding "Showing the prepared ranking.". Screen readers
  don't announce that.
- It can also say "Showing the prepared ranking." when no list is rendered
  (all filtered, or an empty Catalog).

**Fix:** render it unconditionally, and empty when no list is shown.

### D4. The LayerLine hit area bleeds onto the first row in decided mode

**Status: open.** Confidence 7.

`app/tonight-screen.tsx:992`, decided-mode container `:430`

The `-my-3` bleed assumes `main`'s 22px gap. Decided mode renders the picker
inside a `gap-2` (8px) section, so the 44px target overlaps the first row by
4px. DESIGN.md "AI layers" says the target goes "never onto a row". Its top
also slides under the sticky filter zone, and the line's spacing differs
between modes.

**Fix:** wrap LayerLine and its list in one `flex flex-col gap-3` container
in both branches.

### D5. The frozen brief has no `.expand-in`

**Status: open.** Confidence 7.

`app/prepared-brief.tsx:57-66`

"Read the note" mounts the brief fresh. DESIGN.md Motion requires
`.expand-in` on disclosure bodies, and the Rejected and Closed disclosures
already use it.

**Fix:** add `expand-in` when `decided`.

### D6. The LayerLine button has no hover or press state, and a narrow target

**Status: open.** Confidence 6.

`app/tonight-screen.tsx:989-994`

It has `transition-colors duration-short` but no `hover:` or `active:`
class, and no horizontal padding, so "Clear" is about 30px wide.

**Fix:** `hover:bg-raised rounded-control duration-micro`, plus `px-2` with a
matching `-mx-2`.

### D7. The brief's numerals aren't mono

**Status: open.** Confidence 5. Medium confidence: verify this is actually an
issue.

`app/prepared-brief.tsx:64`

The brief claims the rationale line's treatment, but rationales wrap their
prose in `MonoNumerals` (`tonight-row.tsx:183`), and the brief renders raw
text.

**Fix:** export `MonoNumerals` and use it for the brief.

## Informational: maintainability

### M1. The `APP_TZ ?? "UTC"` fallback is now in three places

**Status: open.** Confidence 8.

`app/page.tsx:76`, `instrumentation.ts:32`

`lib/local-day.ts:68-74` says the fallback "lives in exactly one place", and
the diff adds two more inline reads.

**Fix:** add an `appTimeZone()` export next to `today()` and use it in all
three places.

### M2. `PreparedNoteRow` is a dead export

**Status: open.** Confidence 8.

`db/schema.ts:212`

Nothing references it. Delete it.

### M3. The eval script's run-time comment is stale

**Status: open.** Confidence 7.

`scripts/prepared-note-eval.ts:21`

It says "a few minutes at Strata's ~25 tok/s". The measured figures
(`lib/prepared-note.ts:247-255`, ADR-0011) are six to ten minutes idle, and
up to about 35 minutes when Strata is shared.

### M4. `aria-controls` points at an element that isn't rendered

**Status: open.** Confidence 5.

`app/prepared-brief.tsx:73`

On a decided date with the brief collapsed, the brief `<p>` isn't rendered,
so the toggle's `aria-controls` references a missing id.

## Advisory: simplification (optional, ask before applying)

- `scripts/prepared-note-eval.ts:68`: **open.** `captureLogLine` swaps out
  the global `console.log` to parse the client's own log line. Time the call
  directly and pass `usage` through `onReply`. About 15 lines removable.
- `app/tonight-screen.tsx:221-226`: **open.** The two `useState` hooks plus
  the reset-during-render block could be one `dismissedOn` day value.
  Behavior change: going A, then B, then back to A keeps A dismissed. About 5
  lines.
- `lib/prepared-notes.ts:203-207`: **open, reshaped.** `TonightPreparedNote`
  now carries a `status`, but `preparedNoteFor` still copies the stored
  fields, and `app/page.tsx:73-78` reshapes them again. Returning
  `{ ...stored, status }` would drop one copy.
- `db/schema.ts`: **done** in `932df24` (architecture issue 04).
  `PreparedRankingRow` was merged into `AiRankingRow`.
- `lib/prepared-label.ts:14`: **open.** `clockTime` uses `formatToParts`
  plus a helper where one `toLocaleTimeString` call and a lowercase would do.
  About 6 lines.

## Outside voice: GPT-6.1 Sol (omp `openai/gpt-6.1-sol`, via Paseo)

Agent `536abbc1`. **Coverage caveat:** both of its `git diff` calls were
refused at omp's approval prompt, so it reviewed the feature files and
ADR-0011 directly rather than the merge-base diff. Its recommendation was to
request changes, citing I3: a malformed stream event leaves inference running
after the claim is released. I3 is still open.

### Agreement with this review

It confirmed all eight issues it was given, which makes them findings from
more than one source:

| Item | Its severity | Its addition | Status at `c1dc788` |
|---|---|---|---|
| C1 | Medium | Adds the in-flight race (a Pick landing during generation). Says a separate read before the write still races. | fixed (the guard sits in the write itself) |
| I1 | Low | — | fixed |
| I2 | Low | — | open |
| I3 | Medium | Adds that a non-2xx body is never cancelled. | open |
| I4 | Medium | Narrows it to same-date ties only (the date sort already holds). | fixed |
| I5 | Medium | — | open |
| I6 | Low | — | open |
| I8 | Medium | Says all three layers disagree: page, sweep, and `PreparedBrief` (`decided` comes from the displayed dinners, which omit archived Options). | partly fixed: page and sweep agree; `PreparedBrief` and the screen don't |

It rated C1 Medium where this review rated it Critical. This review kept
Critical, because the failure silently rewrote a record the ADR promises to
freeze, and planning ahead triggered it.

### New from the outside voice

Each item was checked against the code here, and the verdict is noted. All
five are still open at `c1dc788`.

- **O1. Prepared rank numbers shift after a row leaves the list. Medium,
  confirmed. Open.**
  - Location: `app/tonight-screen.tsx:773-776`, `lib/picker-view.ts:168`.
  - `rankOf` numbers the Prepared rows that are still on the list, and
    `resolveRanking` has already removed Picked, Rejected, and Closed Options.
  - Example: the note ranks A #1 and B #2, and A is then Rejected. B now shows
    as #1. Pick B, and the decided-day line says "The note ranked B #2" (it
    reads the stored ranking).
  - Fix: number Prepared rows by their position in the stored ranking, and
    keep any appended tail visibly unnumbered (pairs with I5).
    `resolveRanking` could return each row's ranking position.
- **O2. A date with zero candidates is retried every sweep. Low, plausible.
  Open.**
  - Location: `lib/prepared-notes.ts:147-167`, `lib/prepared-note.ts:234`.
  - If every Option is Closed or Rejected for a date, or the Catalog is
    empty, the model is still called. A correct empty ranking is always
    refused, so the date regenerates every 10 minutes and burns GPU.
  - Rare: home Options are never Closed.
  - Fix: skip generation when `built.idByIndex` is empty.
- **O3. The input hash leaves out which Option ids the numbers map to. Low,
  plausible. Open.**
  - Location: `lib/prepared-notes.ts:48-53`.
  - The snapshot uses per-snapshot integers. If an Option is deleted and
    recreated with identical fields, the hash doesn't change but the stored
    ranking points at a dead id.
  - Very unlikely here, because Options are archived rather than deleted.
  - Fix, if wanted: hash `built.idByIndex` along with the snapshot.
    `runSweep` now holds the whole built value.
- **O4. A replica whose lease has expired can overwrite or release the next
  replica's claim. Low, out of scope. Open.**
  - Location: `lib/prepared-notes.ts:89-131`.
  - `storeNote` (now with its Log guard) and `releaseClaim` still match on
    the date only. A replica paused past the 45-minute lease (GC stall, lost
    DB connection) could clobber the replica that took the date over.
  - A claim token would fix it, but CLAUDE.md's Scope section rules out
    speculative concurrency machinery for two replicas. I7, keeping the lease
    longer than the timeout, is the proportionate guard.
- **O5. The stream reader has no memory bound. Low. Open.**
  - Location: `lib/prepared-note.ts:294-312`.
  - `reasoning` and `buffered` grow without limit until the 40-minute
    deadline, and production keeps the reasoning it never uses.
  - The server is the household's own Strata, and `max_tokens` is 20k, so
    the realistic risk is small.
  - Cheap part: accumulate `reasoning` only when `onReply` is set.

## Appendix: low confidence (3–4)

All still apply at `c1dc788`.

- `.env.example:48` (security): the example `LOCAL_AI_BASE_URL` is plain
  `http://`. The bearer key and the full household snapshot cross the network
  in cleartext. That's acceptable only on a trusted cluster or LAN path.
- `app/prepared-brief.tsx:60` (design): at 1280px the unclamped brief runs to
  about 130–140 characters per line. Consider `max-w-[65ch]`.
- `app/prepared-brief.tsx:60` (design, pre-existing pairing): in the dark
  theme, `text-muted` on `bg-raised` is about 4.15:1, below the 4.5:1 bar.
  The dark theme is already noted as unverified.
- Adversarial, to investigate:
  - Undici's default 300s `bodyTimeout` could cut a stream if Strata sends
    headers and then nothing while queued.
  - A trailing slash in `LOCAL_AI_BASE_URL` produces `//chat/completions`
    (`lib/prepared-note.ts:395`).
  - In decided mode, the frozen ranking still orders the picker below the
    decided block.

## Checked and clean

Still true at `c1dc788`:

- Model text reaches the DOM only as React text children. There is no
  `dangerouslySetInnerHTML`.
- Ranking ids are mapped through the server-built `idByIndex`, and
  `resolveRanking` drops unknown ids.
- The API key is never logged.
- DB writes use drizzle's parameterized builders.
- Migration `0006` is a single additive `CREATE TABLE` with nullable note
  columns, and the boot schema check blocks a new image on an unmigrated DB.
- The per-date claim (an `ON CONFLICT … WHERE claimed_until is null or <
  now()` upsert) is atomic.

## Coverage

The original run at `e2ea7bc`:

| Pass | Result |
|---|---|
| Core checklist (critical + informational) | done |
| Specialists: testing, maintainability, security, performance, design, simplification | done (6/6) |
| Data migration specialist | not dispatched (the scope detector missed `drizzle/`); covered in the core pass |
| API contract specialist | not dispatched: scope not detected |
| Red team | done |
| Native adversarial (Claude) | done; test files reviewed in summary mode only |
| Codex adversarial and structured review | **missing**: `CODEX_MODE: sandbox_unavailable` (bwrap can't create a namespace). Fix: enable unprivileged user namespaces, or set `GSTACK_CODEX_NO_SANDBOX=1` |
| OpenAI outside voice via Paseo | **done** on the fourth attempt: omp `openai/gpt-6.1-sol`, agent `536abbc1`. Its `git diff` calls were refused, so it reviewed the source files directly. Earlier attempts reviewed nothing: Codex harness (agents `8b250d17`, `7a9bbbd1`) failed with `401 Missing bearer` (not logged in), and omp `openai` (agent `20d5355c`) failed with `credit_balance_exhausted` before credits were added. |
| Greptile | skipped (`gh` not installed, no PR) |
| Plan completion audit | not run (no plan bound); fell back to commits and `.issues/` |

The re-check at `c1dc788` was a status pass only. Each finding was read
against the current code, and nothing was re-run: no specialists, no outside
voice, no tests. The architecture-deepening commits (about +3,000/−2,900 across
lib, app, and db, issue files included) have had no review of their own beyond their issues' gates.

Specialist quality score: 1.5/10. This is a mechanical score
(`10 - 2×critical - 0.5×informational`) over the specialists' raw
non-advisory findings, before merging duplicates. Treat it as a count, not a
verdict.

## Exploratory QA and verification results

From the original run, functional surface only. The smoke budget was 300s and
12 probes; 2 probes were used. Report directory:
`.gstack/qa-reports/review-2026-10-23/functional/` (gitignored).

| Contract | Probe | Expected | Outcome |
|---|---|---|---|
| C1: Prepared notes unit suites pass | `corepack pnpm exec vitest run lib/prepared-note.test.ts lib/prepared-notes-job.test.ts lib/prepared-notes-loop.test.ts lib/prepared-label.test.ts lib/prepared-comparison.test.ts app/tonight-screen.test.tsx` | exit 0 | **pass** at `e2ea7bc`: 6 files, 152 tests. `lib/prepared-notes-job.test.ts` has since been deleted (`3d35ac9`), so this probe no longer runs as written. |
| C2: typecheck of the schema, queries, page, and screen wiring | `corepack pnpm typecheck` | exit 0 | **pass** at `e2ea7bc` ([checkpoint 002](../../.gstack/qa-reports/review-2026-10-23/functional/exploration-002.json)) |
| DB suites (`*.db.test.ts`) | `corepack pnpm test:db` | exit 0 | not run in this review. The architecture issues 01–03 list `test:db` in their gate. |
| C1 reproduction (Pick mid-sweep) | DB test with a stub client | note unchanged | now covered by `lib/prepared-notes.db.test.ts:228`, not run in this review |
| Layout at 1280px and 375px; dev-server freeze check | browser + dev server | per DESIGN.md | not run (moved to architecture issues 05 and 01; both say not run) |

The verdict covers the unit and typecheck contracts at `e2ea7bc` only. The
DB, browser, and reproduction checks above are coverage gaps, not passes.

## Suggested order

From what is still open at `c1dc788`:

1. Fix I2 and I3: small, and a trust boundary and GPU waste. The outside voice
   named I3 as its reason to request changes.
2. Fix O1 together with I5: both are about what the Prepared rank numbers
   mean. `resolveRanking` is now the one place to do it.
3. Fix I7 and I9: small tests and a derived constant guarding the sweep's
   concurrency.
4. Close I8's remaining layer: one `decided` flag on the Selected-day view.
5. Pick D1–D7 as one design pass, alongside architecture issue 05's open
   layout check.
6. Do the rest as convenient (C1's wasted-generation residual, I6, O2–O5,
   M1–M4).
