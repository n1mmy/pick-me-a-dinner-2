# Prepared notes: pre-landing review

Branch `grill-ai-precomputed-dinner-notes` at `e2ea7bc`, reviewed against `main`
(merge base `a3920c8`). The base is stale: `git fetch` failed on the SSH host key,
so `origin/main` was not refreshed. The diff is 42 files, +4619/-90.

Run with `/review` (gstack), 2026-10-23. No fixes are applied: the review
stopped at Fix-First and its edits were reverted, so every finding below is
open.

## Summary

**Pre-Landing Review: 27 issues (1 critical, 26 informational).** That is 22
from this review plus 5 new ones from the GPT-6.1 Sol outside voice (O1–O5).
The outside voice independently confirmed C1, I1–I6, and I8.

The review is **INCOMPLETE** because the DB, browser, and dev-server checks
were not run. gstack's own Codex passes couldn't start their sandbox; the
outside voice ran through Paseo instead.

The one critical issue: a Pick made while a sweep is running can overwrite
that date's frozen note with one written after the decision. The decided-day
comparison then reports "The note didn't rank X" for the dinner that was
eaten. An ordinary planning session triggers it.

## Scope check

**Scope Check: CLEAN** (lower confidence: no plan file is bound to the branch,
so this uses the commits and `.issues/prepared-notes/` as intent).

- Delivered: issues 01–06 (store, sweep, tune, design rules, Tonight brief and
  ranking, decided-day comparison). There is no scope creep beyond small
  supporting touches to `lib/ai-search.ts` and `scripts/load-env.ts`.
- Still open, and needing a human or a dev server:
  - issue 05: the 1280px and 375px layout check
  - issue 06: the dev-server Pick check
  - issue 07: deploy (`ready-for-human`)

## Critical

### C1. A Pick made mid-sweep overwrites the date's frozen note

**Confidence 9.** Found by the red team and the adversarial pass, and
confirmed in code.

`lib/prepared-notes-job.ts:141`

- `runSweep` reads the decided dates once, at sweep start (`:141-144`). Each
  later date only gets a hash check (`:147`).
- Any history edit invalidates all seven dates, and a sweep runs an hour or
  more, so this window is wide.
- If the household Picks Friday while the sweep is still on Wednesday, Friday
  is still in the stale eligible list. Its fresh snapshot already excludes the
  Picked Option: `buildSnapshot` drops a day's Picked Options from the
  candidates (`lib/ai-search.ts:354-362`).
- The sweep claims Friday, regenerates, and `storeNote` (`:102-113`, an
  unconditional UPDATE) overwrites the pre-decision note.
- Result: Tonight shows "The note didn't rank X" for what was eaten, and never
  marks it out of date. This breaks ADR-0011's "a note freezes once its date
  has a Pick".

**Fix:** re-check `dinner_log` for the date (any Option, archived included)
just before `claimDay`, and skip the date if a Pick exists. This also closes
I8.

**Optional:** add a `NOT EXISTS (dinner_log for that date)` guard to
`storeNote`'s WHERE, for a Pick that lands during a 10–40 minute generation.
A note written then was built before the Pick, so it still ranks the eaten
Option. The guard is lower value.

**Regression test** (`lib/prepared-notes-job.db.test.ts`): a stub client
inserts a `dinner_log` row for today+3 during its first `prepare` call. After
`runSweep`, today+3's note must be unchanged.

## Informational: correctness

### I1. Past undecided days show "out of date, updating" forever

**Confidence 8.** Core and adversarial.

`app/page.tsx:73`, `lib/tonight-prepared-note.ts:44-46`,
`app/prepared-brief.tsx:53`

- `eligibleDays` starts at today, so a past date is never regenerated
  (ADR-0011:46).
- `outOfDate` is still computed for any undecided Selected day, and the
  Selected day can be stepped into the past (CONTEXT.md:186).
- After any later edit, a past undecided day promises an update that never
  comes, and its stale ranking becomes the default list.

**Fix:** treat `day < todaySql` as frozen, like a decided day. For example,
pass `frozen: todayEntries.length > 0 || selectedDay < todaySql`. This also
skips the snapshot build on those days.

### I2. The brief has no length bound

**Confidence 7.** Core and adversarial.

`lib/prepared-note.ts:225`

`parsePreparedReply` caps each rationale at 600 characters but takes
everything above the marker as the brief. If Strata ever writes reasoning
into `content` (a server or template change, `<think>` leaking), the whole
chain of thought is stored and rendered in full at 720px and wider.

**Fix:** refuse a brief over about 1,200 characters (the prompt asks for
40–70 words, about 450 characters). Return `null` so the last good note
stays. Add a case to the `is unavailable when` table in
`lib/prepared-note.test.ts`.

### I3. The request isn't aborted on failure paths

**Confidence 7.** Performance and adversarial.

`lib/prepared-note.ts:424-427`

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

**Confidence 6.** Adversarial.

`db/queries.ts:276-285`, `lib/ai-search.ts:384`

- `getFullLogForSnapshot` has no ORDER BY.
- `buildSnapshot` sorts the Log by date only. The sort is stable, so
  same-date entries (several Picks on one day) keep whatever order Postgres
  returns.
- If that order changes (a plan change, a row rewrite), every date's hash
  flips: Tonight shows "out of date" and the sweep regenerates all seven
  dates for no real change.

**Fix:** `.orderBy(desc(dinnerLog.eatenOn), asc(dinnerLog.optionId))`. This
changes the hash once, so expect one full regeneration after deploy.

### I5. Partial rankings are stored as good, and the unranked tail looks model-ranked

**Confidence 6.** Adversarial. This is a taste call.

`lib/prepared-note.ts:232`, `app/tonight-screen.tsx:857-872`

- A reply ranking 3 of 37 candidates overwrites a complete note.
- Tonight appends the missing 34 with continuing `#` ranks and no rationale,
  under the "Prepared ranking" line.
- AI search handles the same case with `backfillOmittedCandidates` and
  `OMITTED_CANDIDATE_REASON`.

This is rarer since v5 sends the candidate checklist.

**Options:** set a coverage threshold before overwriting, and/or give the
tail a "the note left this one out" reason.

### I6. A sweep crossing midnight writes one note for a past date

**Confidence 6.** Red team and adversarial.

`instrumentation.ts:30`, `lib/prepared-notes-job.ts:35`

`now` is fixed per sweep, so a multi-hour sweep that crosses midnight in
`APP_TZ` still generates for what is now yesterday. That contradicts "past
dates are never generated" and wastes up to one generation. The next sweep
corrects itself.

**Fix:** recompute today per iteration. That needs a clock parameter in place
of the fixed `now`. Low priority.

### I7. The lease-outlasts-timeout invariant lives only in comments

**Confidence 7.** Maintainability and testing.

`lib/prepared-notes-job.ts:67`, `lib/prepared-note.ts:254`

`CLAIM_LEASE` is a bare `interval '45 minutes'`, and `REQUEST_TIMEOUT_MS` is
a private 40-minute constant. The timeout has been raised once already
(`447b3a1`). If the next raise passes 45 minutes, a second replica can take
over a date mid-generation, and no test fails.

**Fix:** export `REQUEST_TIMEOUT_MS`, derive the lease from it (timeout plus
5 minutes), and unit-test lease > timeout.

### I8. The page and the sweep define "decided" differently

**Confidence 7.** Testing and adversarial.

`app/page.tsx:73` vs `lib/prepared-notes-job.ts:141`

- The page uses `todayEntries.length > 0`, which counts every `dinner_log`
  row, archived Options included (`db/queries.ts:233-241`).
- The sweep uses `getFullLogForSnapshot`, which joins active Options only
  (`:276-286`).
- So a date whose only Pick is later archived becomes eligible again. Its
  frozen note regenerates, while the page still treats the date as decided.

**Fix:** C1's per-date `dinner_log` check (any Option) closes this.

### I9. No test for runSweep's claim race guard

**Confidence 6.** Testing.

`lib/prepared-notes-job.ts:153`

Nothing tests the `claim.inputHash === hash` branch, where the other replica
wrote the same note between the read and the claim. Deleting the branch, or
its `releaseClaim`, fails no test.

**Fix:** a DB test that mocks `getPreparedNote` to return null after a first
sweep. Assert that the second sweep asks the client nothing, and that
`claimDay` succeeds afterwards.

## Informational: design and accessibility (DESIGN.md)

### D1. Focus drops to `<body>` after "Show ranked list"

**Confidence 8.**

`app/tonight-screen.tsx:1036`

Dismissing the Prepared layer unmounts the focused button. The same happens
to "AI search · Clear" when no note is underneath.

**Fix:** move focus to a stable list target after the layer is peeled off.

### D2. The label's time isn't in Geist Mono

**Confidence 8.**

`app/prepared-brief.tsx:53`

DESIGN.md:304 says `Prepared 2:14pm` has "the time in Geist Mono", but
`preparedLabel()` returns one flat string rendered in sans. The comparison
line in the same block does mono its `#4`.

**Fix:** return the time separately and render it in `font-mono
tabular-nums`.

### D3. The list live region is mounted conditionally

**Confidence 7.**

`app/tonight-screen.tsx:447`

- Stepping from a no-note day to a note day, with Claude search off, mounts
  the region already holding "Showing the prepared ranking.". Screen readers
  don't announce that.
- It can also say "Showing the prepared ranking." when no list is rendered
  (all filtered, or an empty Catalog).

**Fix:** render it unconditionally, and empty when no list is shown.

### D4. The LayerLine hit area bleeds onto the first row in decided mode

**Confidence 7.**

`app/tonight-screen.tsx:1094`

The `-my-3` bleed assumes `main`'s 22px gap. Decided mode renders inside
`gap-2` (8px), so the 44px target overlaps the first row by 4px, against
DESIGN.md "AI layers": "never onto a row". Its top also slides under the
sticky filter zone, and the line's spacing differs between modes.

**Fix:** wrap LayerLine and its list in one `flex flex-col gap-3` container
in both branches.

### D5. The frozen brief has no `.expand-in`

**Confidence 7.**

`app/prepared-brief.tsx:57`

"Read the note" mounts the brief fresh. DESIGN.md Motion requires
`.expand-in` on disclosure bodies, and the Rejected and Closed disclosures
already use it.

**Fix:** add `expand-in` when `decided`.

### D6. The LayerLine button has no hover or press state, and a narrow target

**Confidence 6.**

`app/tonight-screen.tsx:1094`

It has `transition-colors duration-short` but no `hover:` or `active:`
class, and no horizontal padding, so "Clear" is about 30px wide.

**Fix:** `hover:bg-raised rounded-control duration-micro`, plus `px-2` with a
matching `-mx-2`.

### D7. The brief's numerals aren't mono

**Confidence 5.** Medium confidence: verify this is actually an issue.

`app/prepared-brief.tsx:64`

The brief claims the rationale line's treatment, but rationales wrap their
prose in `MonoNumerals` (`tonight-row.tsx:183`), and the brief renders raw
text.

**Fix:** export `MonoNumerals` and use it for the brief.

## Informational: maintainability

### M1. The `APP_TZ ?? "UTC"` fallback is now in three places

**Confidence 8.**

`app/page.tsx:80`, `instrumentation.ts:31`

`lib/local-day.ts:68-74` says the fallback "lives in exactly one place", and
the diff adds two more inline reads.

**Fix:** add an `appTimeZone()` export next to `today()` and use it in all
three places.

### M2. `PreparedNoteRow` is a dead export

**Confidence 8.**

`db/schema.ts:214`

Nothing references it. Delete it.

### M3. The eval script's run-time comment is stale

**Confidence 7.**

`scripts/prepared-note-eval.ts:21`

It says "a few minutes at Strata's ~25 tok/s". The measured figures
(`lib/prepared-note.ts:246-253`, ADR-0011) are six to ten minutes idle, and
up to about 35 minutes when Strata is shared.

### M4. `aria-controls` points at an element that isn't rendered

**Confidence 5.**

`app/prepared-brief.tsx:73`

On a decided date with the brief collapsed, the brief `<p>` isn't rendered,
so the toggle's `aria-controls` references a missing id.

## Advisory: simplification (optional, ask before applying)

- `scripts/prepared-note-eval.ts:68`: `captureLogLine` swaps out the global
  `console.log` to parse the client's own log line. Time the call directly
  and pass `usage` through `onReply`. About 15 lines removable.
- `app/tonight-screen.tsx:273`: the two `useState` hooks plus the
  reset-during-render block could be one `dismissedOn` day value. Behavior
  change: going A, then B, then back to A keeps A dismissed. About 5 lines.
- `lib/tonight-prepared-note.ts:11`: `TonightPreparedNote` copies fields that
  `page.tsx` reshapes again. Return `{ ...stored, outOfDate }` instead. About
  9 lines.
- `db/schema.ts:183`: `PreparedRankingRow` is identical to `AiRankingRow`.
  Use one type. About 2 lines.
- `lib/prepared-label.ts`: `clockTime` uses `formatToParts` plus a helper
  where one `toLocaleTimeString` call and a lowercase would do. About 6
  lines.

## Outside voice: GPT-6.1 Sol (omp `openai/gpt-6.1-sol`, via Paseo)

Agent `536abbc1`. **Coverage caveat:** both of its `git diff` calls were
refused at omp's approval prompt, so it reviewed the feature files and
ADR-0011 directly rather than the merge-base diff. Its recommendation was to
request changes, citing I3: a malformed stream event leaves inference running
after the claim is released.

### Agreement with this review

It confirmed all eight issues it was given, which makes them findings from
more than one source:

| Item | Its severity | Its addition |
|---|---|---|
| C1 | Medium | Adds the in-flight race (a Pick landing during generation). Says a separate read before the write still races. |
| I1 | Low | — |
| I2 | Low | — |
| I3 | Medium | Adds that a non-2xx body is never cancelled. |
| I4 | Medium | Narrows it to same-date ties only (the date sort already holds). |
| I5 | Medium | — |
| I6 | Low | — |
| I8 | Medium | Says all three layers disagree: page, sweep, and `PreparedBrief` (`decided` comes from the displayed dinners, which omit archived Options). |

It rated C1 Medium where this review rates it Critical. This review keeps
Critical, because the failure silently rewrites a record the ADR promises to
freeze, and planning ahead triggers it.

### New from the outside voice

Each item was checked against the code here, and the verdict is noted.

- **O1. Prepared rank numbers shift after a row leaves the list. Medium,
  confirmed.**
  - Location: `app/tonight-screen.tsx:859-875`, `lib/picker-view.ts:173`.
  - `rankOf` numbers the Prepared rows that are still on the list, and those
    already exclude Picked, Rejected, and Closed Options.
  - Example: the note ranks A #1 and B #2, and A is then Rejected. B now shows
    as #1. Pick B, and the decided-day line says "The note ranked B #2" (it
    reads the stored ranking).
  - Fix: number Prepared rows by their position in the stored ranking, and
    keep any appended tail visibly unnumbered (pairs with I5).
- **O2. A date with zero candidates is retried every sweep. Low, plausible.**
  - Location: `lib/prepared-notes-job.ts:145-158`, `lib/prepared-note.ts:232`.
  - If every Option is Closed or Rejected for a date, or the Catalog is
    empty, the model is still called. A correct empty ranking is always
    refused, so the date regenerates every 10 minutes and burns GPU.
  - Rare: home Options are never Closed.
  - Fix: skip generation when `idByIndex` is empty.
- **O3. The input hash leaves out which Option ids the numbers map to. Low,
  plausible.**
  - Location: `lib/prepared-notes-job.ts:52-59`.
  - The snapshot uses per-snapshot integers. If an Option is deleted and
    recreated with identical fields, the hash doesn't change but the stored
    ranking points at a dead id.
  - Very unlikely here, because Options are archived rather than deleted.
  - Fix, if wanted: include the number-to-id mapping in the hash input.
- **O4. A replica whose lease has expired can overwrite or release the next
  replica's claim. Low, out of scope.**
  - Location: `lib/prepared-notes-job.ts:102-123`.
  - `storeNote` and `releaseClaim` match on the date only. A replica paused
    past the 45-minute lease (GC stall, lost DB connection) could clobber the
    replica that took the date over.
  - A claim token would fix it, but CLAUDE.md's Scope section rules out
    speculative concurrency machinery for two replicas. I7, keeping the lease
    longer than the timeout, is the proportionate guard.
- **O5. The stream reader has no memory bound. Low.**
  - Location: `lib/prepared-note.ts:292-310`.
  - `reasoning` and `buffered` grow without limit until the 40-minute
    deadline, and production keeps the reasoning it never uses.
  - The server is the household's own Strata, and `max_tokens` is 20k, so
    the realistic risk is small.
  - Cheap part: accumulate `reasoning` only when `onReply` is set.

## Appendix: low confidence (3–4)

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
  - A trailing slash in `LOCAL_AI_BASE_URL` produces `//chat/completions`.
  - In decided mode, the frozen ranking still orders the picker below the
    decided block.

## Checked and clean

- Model text reaches the DOM only as React text children. There is no
  `dangerouslySetInnerHTML`.
- Ranking ids are mapped through the server-built `idByIndex`, and Tonight
  drops unknown ids.
- The API key is never logged.
- DB writes use drizzle's parameterized builders.
- Migration `0006` is a single additive `CREATE TABLE` with nullable note
  columns, and the boot schema check blocks a new image on an unmigrated DB.
- The per-date claim (an `ON CONFLICT … WHERE claimed_until is null or <
  now()` upsert) is atomic.

## Coverage

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

Specialist quality score: 1.5/10. This is a mechanical score
(`10 - 2×critical - 0.5×informational`) over the specialists' raw
non-advisory findings, before merging duplicates. Treat it as a count, not a
verdict.

## Exploratory QA and verification results

Functional surface only. The smoke budget was 300s and 12 probes; 2 probes
were used. Report directory:
`.gstack/qa-reports/review-2026-10-23/functional/` (gitignored).

| Contract | Probe | Expected | Outcome |
|---|---|---|---|
| C1: Prepared notes unit suites pass | `corepack pnpm exec vitest run lib/prepared-note.test.ts lib/prepared-notes-job.test.ts lib/prepared-notes-loop.test.ts lib/prepared-label.test.ts lib/prepared-comparison.test.ts app/tonight-screen.test.tsx` | exit 0 | **pass**: 6 files, 152 tests |
| C2: typecheck of the schema, queries, page, and screen wiring | `corepack pnpm typecheck` | exit 0 | **pass** ([checkpoint 002](../.gstack/qa-reports/review-2026-10-23/functional/exploration-002.json)) |
| DB suites (`*.db.test.ts`) | `corepack pnpm test:db` | exit 0 | not run (report-only review does no setup) |
| C1 reproduction (Pick mid-sweep) | DB test with a stub client | note unchanged | not run: traced in code only |
| Issue 05 layout at 1280px and 375px; issue 06 dev-server Pick | browser + dev server | per DESIGN.md | not run |

The verdict covers the unit and typecheck contracts only. The DB, browser,
and reproduction checks above are coverage gaps, not passes.

## Suggested order

1. Fix C1. It's the one critical issue; I8 comes with it.
2. Fix I1 and I2: small, and user-visible or a trust boundary.
3. Fix I3 and I4: small, and they protect the GPU and avoid spurious
   regeneration. Both were confirmed by the outside voice.
4. Fix O1 together with I5: both are about what the Prepared rank numbers
   mean.
5. Pick D1–D7 as one design pass, alongside issue 05's open layout check.
6. Do the rest as convenient.
