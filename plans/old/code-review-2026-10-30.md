# Code review: `grill-ai-precomputed-dinner-notes` against `main`

Pre-landing review (`/review`), report-only, of `git diff 280a540...HEAD` at
`f2f6051` (22 commits, 39 files, +2615/-227). No code was changed; every
finding below is open. `origin/main` could not be refreshed (SSH publickey
denied), so base coverage is stale at `280a540`, which is also local `main`'s
merge base.

The branch carries:

- **Shortlist** (CONTEXT.md): two or more Picks on today or later are flagged
  in the snapshot and left out of the timing facts; prompt v20, then v21.
- **No Shared Dinner**: out of the AI candidates, listed last on Tonight.
- **Prepared brief** layout: under the decided block once decided, and the
  label moved to the brief's lower right in italics; Day note in italics.
- A row the Prepared note didn't name loses its "The note left this one out"
  rationale.
- The Prepared prompt split into named blocks and pinned in file snapshots;
  `MAX_TOKENS` 20k to 40k; keep-alive off on the local-model dispatcher.
- Scripts: the past-date backfill, the stored-notes backtest, the spread
  script, `--repeat`, `--thinking=off`, the resume setup check, and the mean
  rank capped at 15. The rank-only ranker was added and then removed.
- ADR-0011 amendment: `LOCAL_AI_*` control generation only.

**Sources:**

- **Core checklist pass.**
- **Specialists:** testing, maintainability, security, performance, design,
  simplification, state machines, red team. Security and state machines
  found nothing.
- **Claude adversarial pass.**
- **Not run: Codex.** Its sandbox cannot start here (bwrap namespace
  denied). The Paseo/omp route in `CLAUDE.md` was not run, because it falls
  under the billed-call rule.
- **Functional QA smoke run.** 322 unit tests and the typecheck pass. One
  probe of the spread script fails (finding 6).

Anchors are `file:line` at `f2f6051`. "Medium confidence" marks findings
scored 5–6: check that they are real before acting on them.

## Scope check

```
Scope Check: REQUIREMENTS MISSING
Intent: Shortlist reading, No Shared Dinner, brief placement, prompt v21, backtest tooling (from commit messages; no plan file is bound)
Delivered: all of the above, plus the past-date backfill and stored-notes backtest
Diff read: full (39 files)
Undeclared behavior changes:
  - The snapshot now depends on the real calendar day (`currentDay: today()`, lib/snapshot.ts:684), so a Prepared note's input hash changes when a Shortlist date passes.
  - No Shared Dinner is no longer reachable from an AI search result list (finding 10).
  - Prompt v19 -> v21 makes every unfrozen note out of date on deploy: up to 7 regenerations on the shared model.
Missing: the ADR-0011 amendment in 07b8576 has no code change behind it (finding 1).
```

The missing item comes from a commit message, not a plan file, so the
confidence is lower.

## Decisions needed

### 1. ADR-0011 now says the opposite of what Tonight does

`docs/adr/0011-prepared-notes-from-a-local-model.md:83`, against
`app/page.tsx:70` and `lib/prepared-notes.ts:302`. Confidence 9/10.
Found by the core pass and the adversarial pass.

Commit 07b8576 records three decisions:

- "Tonight shows a stored note whenever one exists".
- A note is judged current "by the model recorded on the note, not the
  configured one".
- Turned off, "the notes already written stay".

The commit only touches the ADR, and the code does the reverse:

- `app/page.tsx:70` reads a note only when `preparedNotesEnabled()`. Unset
  `LOCAL_AI_*` and every note disappears from Tonight.
- `lib/prepared-notes.ts:302` hashes with `localModel()`, the configured
  model. Change `LOCAL_AI_MODEL` and every unfrozen note reads "out of date,
  updating" at once.

There is no ticket in `.issues/` for the change. Either:

- **A (recommended):** implement it. Hash with `stored.model` in
  `preparedNoteFor` and drop the `preparedNotesEnabled()` gate on the read.
  About 5 lines, plus a test for each case.
- **B:** revert the ADR paragraph until the code lands.

### 2. A Shortlist counts No Shared Dinner as a Pick

`lib/snapshot.ts:463`. Confidence 7/10. Found by the adversarial pass.

`picksByDate` counts every Log entry of an active Option, and No Shared
Dinner is one. "No Shared Dinner + Pizza" planned for Friday becomes a
Shortlist. The prompt then reads Pizza as one of the night's alternatives,
and Pizza's Friday drops out of the timing facts.

Not a named case in CONTEXT.md. Recommended: skip No Shared Dinner entries
when counting a date's Picks (`isNoSharedDinner(optionById.get(...).name)`),
plus a test in `lib/snapshot.test.ts`'s Shortlists block. If that pairing
should count as a Shortlist, say so in CONTEXT.md instead.

### 3. The backfill writes today's note from a backtest-mode snapshot

`scripts/backfill-prepared-notes.ts:63`. Confidence 8/10. Found by the
performance specialist and the adversarial pass.

`last = today()`, so today is the first date backfilled. Its snapshot has no
entries dated today and none after, and no today's Rejections. The sweep's
hash for today is built in normal mode, so it differs:

- Tonight shows the backfilled note as "out of date, updating".
- The sweep then spends another 4–6 minute generation on the shared model
  replacing it.

Recommended: start at `shiftSqlDate(today(), -1)`. Today and later belong to
the sweep. This also matches the header, which says "for past dates".

### 4. From 720px the label can hang below the brief's surface

`app/prepared-brief.tsx:36`. Confidence 7/10. Found by the design
specialist.

The label floats right inside the brief `<p>`. At `desktop:` that `<p>` is
`line-clamp-none`, which makes it a plain block with overflow visible. It is
not a block formatting context, so it does not contain its float.

When the brief's last line is full, the float drops to a new line. The
`bg-raised` rounded surface still ends at the text, so the label sits below
it, in the section gap. DESIGN.md ("Prepared brief") says the label drops "to
a line of its own" as part of the brief.

Recommended: `desktop:flow-root` on the `<p>`. jsdom can't show this. Check it
by eye on the dev server with a brief whose last line fills the width.

## Should fix (scripts and edges)

### 5. `--repeat` with a `--json` path not ending in `.json` writes every run to one file

`scripts/backtest.ts:491`. Confidence 8/10. Found by the adversarial pass.

`replace(/\.json$/, "-r<i>.json")` does nothing for `--json=x` or `x.out`:

- Without `--resume`, each repeat overwrites the last.
- With `--resume`, repeats 2..N find the file "finished" and skip.

Either way the run reports N repeats and keeps one. Fix: append `-r<i>` when
the path lacks `.json`, or refuse that combination.

### 6. The spread script folds a one-day probe into a 20-day arm (QA-confirmed)

`scripts/backtest-spread.ts:68`. Confidence 9/10. Found by the red team and
confirmed by QA checkpoint 003.

`armOf` keys on model, thinking and prompt version only. Two 20-day repeats
plus `prepared-v21-qwen3.8-low-day22-r1.json` group as one arm. `sharedDays`
then scores the arm's hits on the single day they share:

```
--- arm: 3 runs, 20 days ---
on the 1 days every run has: hit@3 1.0 (1–1)   hit@5 1.0 (1–1)   hit@10 1.0 (1–1)   mean rank 1.0 (1–1)
```

Globbing `prepared-v21-qwen3.8-low-*.json` would also pull in:

- the `t0.6` runs (meta.temperature 0.6);
- `averaged-n5` (ranker "averaged", a consensus ranking, not a repeat).

Those files are local and untracked. New runs no longer write temperature or
"averaged", but day-list probes are still produced.

Fix: add `meta.days` to the arm key, plus `ranker` and `temperature` when
present. Or warn when an arm's runs cover different day lists.

### 7. The stored-notes backtest closes ranks up where Tonight leaves gaps

`scripts/backtest-stored.ts:48`. Confidence 6/10, medium confidence. Found
by the maintainability specialist.

The comment says "as on Tonight". But the script filters non-candidates out
of the array, and `scoreDay` ranks by index (`scripts/backtest.ts:158`), so
rows move up. `resolveRanking` keeps `index + 1`. A note that ranked No
Shared Dinner #3 and the Pick #4 scores as a hit@3 the Household never saw.

Either keep the stored positions, or reword the comment to say the ranks
close up.

### 8. A frozen note that ranked No Shared Dinner shows an unexplained gap

`lib/picker-view.ts:212`. Confidence 7/10. Found by the adversarial pass.

The row is skipped, but the rows below keep `rank: index + 1`, so Tonight
shows #1, #2, #4. DESIGN.md ("AI layers") sanctions a gap only for a row
Picked, Rejected or Closed since the note was written.

This only affects notes written before this branch. Decide whether to count
positions over the remaining rows, or to add No Shared Dinner to DESIGN.md's
list of gap causes. Finding 7 should then match the choice.

### 9. Both prompts describe otherOptions in a way that no longer covers No Shared Dinner

`lib/prepared-note.ts:114` and `lib/ai-search.ts:539`. Confidence 6/10,
medium confidence. Found by the core pass.

`leanSnapshot` puts every non-candidate Option the Log names into
`otherOptions`, and No Shared Dinner is now always one of them. Both prompts
say `otherOptions` holds "Options already picked, rejected, or closed for
this evening". No Shared Dinner is none of those.

It is small, but the model is told something false about a row it sees on
most nights. Add "or never a candidate" if the next prompt bump touches this
text anyway.

### 10. No Shared Dinner disappears while an AI search result is on screen

`app/tonight-screen.tsx:830`. Confidence 6/10, medium confidence. Found by
the red team and the adversarial pass.

AI search results resolve with `appendUnnamed: false`, and No Shared Dinner
is no longer a candidate. While a Claude result shows, the Option is gone
from the list. `lib/no-shared-dinner.ts` says Tonight "lists it last". The
Household has to Clear the search, or use quick-add, to Pick it.

Same as any row a narrowing search didn't return, so this may be fine. Say
which in DESIGN.md.

### 11. Malformed backfill flags silently do nothing

`scripts/backfill-prepared-notes.ts:32`. Confidence 7/10. Found by the red
team and the adversarial pass.

`Number("abc")` is NaN:

- `--concurrency=abc` starts zero workers (`Array.from({ length: NaN })`).
- `--limit=abc` gives an empty queue.

Both end in `backfill_done` with `written: 0` and no error. Reuse the
`positive()` check from `parseBacktestArgs`.

### 12. Backfill concurrency and range against a one-slot server

`scripts/backfill-prepared-notes.ts:15`. Confidence 6/10, medium
confidence. Found by the performance specialist and the adversarial pass.

The header's example is `--concurrency=3`, but the server has one slot. Extra
workers add no throughput; they queue for response headers. With the 40k
budget, a third queued request can wait about 2 × 19 minutes, close to the
40-minute `headersTimeout`, and it holds up the production sweep's notes.

The default range runs back to the first Log entry, which is hundreds of
generations. The header should:

- say the billed-call rule applies (`CLAUDE.md` names `scripts/ai-search-eval.ts`
  and `--claude`, not this script);
- default `--concurrency` to 1 and drop the 3 from the example.

## Notes (investigate or accept)

### 13. The token budget doubled but the timeout didn't

`lib/prepared-note.ts:285`/`:296`. Confidence 5/10, medium confidence.

At the ~10 tok/s the comment records under load, a 40k reply needs about 66
minutes, so the 40-minute abort cuts it off after it has held the slot
throughout. The comment states the new bound (40k down to about 17 tok/s), so
this looks deliberate.

Watch for `prepared_note` timeouts in the pod logs. Pair any later budget raise
with the timeout and the claim lease.

### 14. A backfilled note's label uses the backfill run's time

`scripts/backfill-prepared-notes.ts:117`. Confidence 5/10, medium
confidence.

`preparedAt: new Date()` makes a past date read "Prepared Thu 2:14pm", where
Thu is the weekday the backfill ran. That reads as if the note was written
before the night it covers. Harmless if nobody steps back to those dates;
otherwise give backfilled notes a label of their own.

### 15. Today's Shortlist and the prompt's "today" rule

`lib/ai-search.ts:360`. Confidence 5/10, medium confidence.

The same paragraph says rows dated today are "what tonight already covers",
and that shortlist rows are "alternatives for one night still ahead". A
two-Pick today is both.

CONTEXT.md settles the data side: today counts, and a planned combination
reads as a Shortlist until midnight. The prompt wording doesn't say which
rule wins. Worth one clause at the next prompt bump.

### 16. No backtest snapshot can contain a Shortlist

`lib/snapshot.ts:684`. Confidence 5/10, medium confidence.

Backtest mode sets `currentDay = asOf` and keeps only entries before `asOf`,
so nothing is ever flagged. The v21 backtest numbers in
`scripts/backtest-runs/README.md` therefore say nothing about the Shortlist
wording v20/v21 were for. Note that in the README.

### 17. The resume check and the spread arms ignore `maxTokens`

`scripts/backtest.ts` `SETUP_FIELDS`. Confidence 5/10, medium confidence.

The eval records `maxTokens: "default"`, not the resolved number, and the
default moved from 20k to 40k on this branch. A resumed file or a spread arm
can mix the two budgets, and the budget decides whether a reply is cut off.
Record the resolved number.

## Test gaps

### 18. An assertion on a deleted string can never fail

`app/tonight-screen.test.tsx:2203`. Confidence 7/10.

`queryByText("The note left this one out")` is null forever, now that the
string is gone. Assert instead that Cherry's row has no rationale element at
all.

### 19. `snapshotForDay`'s `currentDay` wiring is untested

`lib/snapshot.ts:684`. Confidence 6/10, medium confidence.

The unit tests pass `currentDay` in directly. A change to `currentDay: asOf`
would turn every future Shortlist into eaten dinners, and no test would fail.
Add one DB-backed case under `vi.setSystemTime`.

### 20. `isNoSharedDinner`'s normalization is untested

`lib/no-shared-dinner.ts:17`. Confidence 5/10, medium confidence.

Every test spells it "No Shared Dinner". Add a table test: mixed case and
padding match, and "No Shared Dinners" does not.

## Advisory

- **[ADVISORY]** `scripts/backtest.ts:492`: the `--repeat` loop re-reads the
  saved file and repeats `runOnce`'s conflict check, only to skip a finished
  run. Moving the "every day ok, skip" test into `runOnce`'s resume block
  removes about 12 lines. Simplification specialist; optional.

Dropped after checking:

- **`meanRank` returning null/NaN on old run files.** All 40 saved files
  checked carry `scorable` and `candidates`.
- **`pipelining: 0`.** undici documents that 0 disables keep-alive (Node's
  undici 5.26.3 bump commit; 6.16 `client.js` rejects `keepAlive` in favour
  of it). Prior learning `node22-fetch-honours-undici7-agent` covers the
  bundled-fetch side.

## Exploratory QA and Verification Results

| Field | Value |
|---|---|
| Date / branch / revision | 2026-10-30 / grill-ai-precomputed-dinner-notes / f2f6051, clean tree |
| Caller / authority / depth | review, report-only; writes only under `.gstack/qa-reports/review-20261030-grill/`; smoke bound 300s / 12 probes |
| Surfaces / scope | functional: snapshot, ranking resolver, Tonight screen (jsdom), backtest and spread scripts |
| Runtime / native tools | vitest 2.1.9, `npx tsc --noEmit`, `npx tsx` (pnpm not on PATH) |
| Fixture ownership / destinations | unit fixtures only; probe 003 reads local untracked run files; no DB, no model |
| Probe budget / guarded command time / stop reason | 300s / ~12s over 3 captures / complete |

### Contract outcomes

| Contract and source | Exact probe / evidence | Expected → observed | Outcome |
|---|---|---|---|
| C1 changed unit suites pass | `npx vitest run` on the 7 changed test files (capture 001) | exit 0 → 7 files, 322 tests passed | pass |
| C2 typecheck | `npx tsc --noEmit` ([checkpoint 002](../.gstack/qa-reports/review-20261030-grill/functional/exploration-002.json)) | exit 0 → exit 0, no output | pass |
| C3 an arm is runs of one setup (`scripts/backtest-spread.ts` docstring) | spread over r1, r2, day22-r1 ([checkpoint 003](../.gstack/qa-reports/review-20261030-grill/functional/exploration-003.json)) | one-day probe kept apart → joined the arm; hits scored on 1 day | fail (finding 6) |

Verdict from the evidence tool: **fail**, because of C3. The failure is in a
dev-only script.

### Coverage limits

- **Browser surface not run.** The brief label float (finding 4) needs a
  layout engine. jsdom tests pin classes only, and gstack's headless Chromium
  is blocked by the sandbox here.
- **No DB-backed probes.** Nothing exercised `snapshotForDay`'s `currentDay`,
  the backfill, or `backtest-stored`. They need the dev database, and the
  backfill also needs the shared local model.
- **Probe 003 can't be reproduced from the committed tree.** It depends on
  untracked run files.

## Gate edits

Gate edits: none detected (22 listed, 10 read; patterns: RH-1,RH-3,RH-4,RH-12,RH-13,RH-14,RH-15,RH-16; unlisted idioms: none)

- The two RH-3 hunks are the new prompt snapshot files. They arrive with
  their owning test (`lib/prepared-note.test.ts`, "the production Prepared
  prompt").
- The other read hunks follow product changes recorded in DESIGN.md or the
  commit messages:
  - the dropped "left this one out" rationale;
  - the label's move;
  - `max_tokens` 40000.

## Summary

Pre-Landing Review: 20 issues (0 critical, 20 informational), plus 1
advisory. **INCOMPLETE**, for three reasons:

- the required QA smoke probe C3 failed;
- the Codex outside review was unavailable;
- the browser check of finding 4 was not run.

Specialist score 4.0/10 (12 specialist findings, all informational).

Start with finding 1, a decision recorded with nothing behind it. Then 2 and
3, which are the two that change what the model or the Household sees. The
rest are scripts, wording, and tests.

## Applied after the review

The mechanical fixes, uncommitted; tsc, lint and vitest (624 tests) pass:

- 5: `--repeat` appends `-r<i>` whether or not the `--json` path ends in `.json`.
- 6: the spread script keys arms on the day list too and prints its day count.
  A test covers a one-day probe beside full runs.
- 7: the stored-backtest comment says ranks close up, unlike Tonight's gaps.
- 11: backfill `--concurrency` and `--limit` exit unless a positive integer.
- 18: the Cherry check asserts no rationale line, not a string the code never renders.
- 20: `lib/no-shared-dinner.test.ts` covers case, padding and near-miss names.

Every other finding is a decision, a prompt-hash change, or needs the DB or a
browser.
