# Code review: `ai-ranking-backtest` against `main`

Pre-landing review (`/review`) of `git diff main...HEAD` at `0afa592`. The
branch carries:

- the AI ranking backtest harness and its recorded runs;
- prompts v10 to v13;
- the timing facts in the snapshot (ADR-0012);
- the removal of `<household-text>` delimiters from snapshot values;
- the thinking-off guard for always-thinking models.

Line anchors are in `6931b4c`. That commit holds the mechanical fixes listed
at the end; nothing below it is changed yet.

**Sources:**

- **Core checklist pass.**
- **Specialists:** testing, maintainability, security, performance, data
  migration, API contract, design, state machines, simplification, red team.
- **Claude adversarial pass.**
- **Codex (gpt-6-luna through Paseo/omp).** It returned two P2 findings and
  no P0/P1.
- **Functional QA smoke run.** Typecheck, lint and 596 unit tests pass, and
  one probe of the parser fails.
- **The recorded runs in `scripts/backtest-runs/`,** read as evidence of what
  the models actually write.

## Decisions needed

### 1. The Prepared reply parser misreads a row Strata really writes (critical)

`parsePreparedReply`, `lib/prepared-note.ts:252-268`. The prompt asks for
`number|name|rationale`, and the parser reads it as follows:

- `parts[0]` is taken as the number.
- `parts[1]` is tried as a name.
- The name wins over the number when it matches a candidate.

Four reply shapes go wrong.

**a. `rank|number|name|rationale` reads the rank as the number.**
`strata-v12.json`, 2026-10-08: all 37 rows have this shape.

- Rank positions 1..N map onto almost every candidate, so the 90%
  `MIN_RANKED_SHARE` check passes.
- `parts[1]` is a number, so it matches no name, and `resolvedByName`
  stays 0.
- The note is accepted with the ranking in alphabetical Catalog order. Every
  rationale sits on the wrong Option and starts with a literal `20|Mazra|`.
  For example, rank 1 shows Aji Ichi with Mazra's reasoning.
- In production the sweep stores this as a good note.

The README records that Opus on v13 also wrote rank positions on 2 of 20
days. Those were 3-column rows, which the name column rescued; a 4-column
row defeats it.

**b. A name column that matches no candidate leaks into the rationale.**
- The QA probe gave `3|Pho|…` → reason `"Pho|The standing Thursday choice."`.
- The same leak is in the recorded runs: strata-v10 on 2026-10-10
  (`Societea|…`) and 2026-10-12, and strata-v12 on 2026-10-07.
- The test at `lib/prepared-note.test.ts:197-209` currently enshrines
  `"Not a name|Skip it."` as the expected reason.

**c. Two Options with the same name collapse into one.** This was found by
the red team and by Codex.

- `options.name` has no unique constraint.
- `idByName` (`:241`) keeps the last candidate of a name, and the name
  overrides the number.
- Both rows resolve to one id, and the second is dropped as a repeat.
- One Option silently leaves an accepted ranking, and the other wears its
  rationale.

**d. An Option name containing `|` splits the row.** Found by Codex. The
name cannot match, so the parser falls back to the number and the fragment
leaks into the reason, as in (b). No current Option has a `|`.

Options:

- **A. Tolerant parse of the shapes seen.**
  - When `parts[1]` is all digits and there are 4 or more columns, read
    `parts[1]` as the number and `parts[2]` as the name.
  - With 3 or more columns, always drop the name column from the reason.
  - Build `idByName` from unique names only, so an ambiguous name falls back
    to the number.
  - Write a failing test for each shape first; the enshrined test changes.
- **B. A, plus a guard.** Refuse a reply where most rows resolve by number
  but their name column names a different candidate, or nothing. A refused
  reply is regenerated next sweep, so a bad shape costs a generation rather
  than showing a wrong note.
- **C. Change the output format.** For example, drop the number and resolve
  by name alone. This needs a prompt bump (v14), a new Strata backtest, and
  still needs (c) solved.
- **D. Leave it.**

**Recommendation: B.** A covers every shape in the recorded runs. The guard
is a few lines and catches the next shape nobody has seen yet. For (d),
reject `|` in an Option name at save time (`app/catalog/actions.ts`) rather
than teaching the parser to guess. Then run item 5.

### 2. `AI_EFFORT=off` with the default model now fails every search

`lib/ai-search.ts:870-875`.

- On `main`, `off` sent no thinking parameter (`main:lib/ai-search.ts:775`),
  so an always-thinking model just used its default, and search worked.
- Now `off` sends `thinking: {type: "disabled"}` (`:458`).
- For a model in `THINKING_ALWAYS_ON_MODELS` (Opus 5.5, the default; Sonnet
  5.5; Fable 5; Mythos 5), client construction throws. Every search then
  falls back to "Search unavailable".
- `check-env` doesn't look at `AI_*`, so nothing warns at startup.
- `6931b4c` documents this in `.env.example` and makes the error name the
  value it was given.
- Only the eval override path is tested, not the env path.

Options:

- **A. Keep the throw and add the env-driven test.** The testing specialist
  drafted one: `AI_EFFORT=off` and `0` on the default model.
- **B. Restore `main`'s behaviour for these models.** `off` would mean "the
  model's default". That is quiet, but `off` then silently means thinking on.
- **C. Validate `AI_EFFORT` against `AI_MODEL` in `check-env`,** so the
  misconfiguration stops the boot instead of every search.

**Recommendation: A.** Add C only if a deploy actually sets `AI_EFFORT=off`.
B hides a setting that does nothing.

### 3. Sweep and Tonight edge cases

`lib/prepared-notes.ts`.

- **a. A sweep running past midnight rewrites a frozen date.** `runSweep`
  (`:151`) reads `eligibleDays` once, and a sweep can run for hours (seven
  dates at up to 40 minutes each). `storeNote` refuses only decided dates.
  So a generation that finishes after midnight is stored on a date Tonight
  now treats as frozen (`preparedNoteFor`, `day < today`). Fix: recheck
  `day >= todaySqlDate(new Date(), timeZone)` at the top of each iteration.
- **b. A date with no candidates shows "updating" forever.** The sweep skips
  a zero-candidate date (`:160`), but `preparedNoteFor` (`:220-229`) still
  compares hashes and reports `out-of-date`. Fix: report such a date as
  frozen, mirroring the sweep's rule.
- **c. A date that always fails is retried every 10 minutes.** A thin
  ranking or a `length` cut-off can fail on every pass, and each attempt
  spends 6–40 minutes of shared Strata GPU.
- **d. A deploy holds the in-flight date for 45 minutes.** A pod killed
  mid-generation keeps its claim until the lease runs out, so the new pod
  skips that date, often today.

**Recommendation:** fix a and b, each a few lines with a test in
`lib/prepared-notes.db.test.ts`. Accept c and d: a skip-after-N counter and
releasing the claim on SIGTERM are the kind of machinery `CLAUDE.md`'s scope
rule warns against. Revisit c only if Strata's shared load becomes a
problem.

### 4. The input hash doesn't cover the prompt actually sent

`inputHash` (`lib/prepared-notes.ts:52`) hashes three things:

- `PREPARED_PROMPT_VERSION`;
- the model;
- the full snapshot.

What is actually sent differs:

- The system prompt is built partly from constants imported from
  `lib/ai-search.ts`: `SNAPSHOT_EVIDENCE`, `RECENCY_THROUGH_HABITS` and
  `RATIONALE_RULES`.
- The user message comes from `leanSnapshot` and `candidateChecklist`.

So an AI-search prompt edit, or a change to `leanSnapshot`, leaves every
stored note marked "current" unless someone remembers to bump the Prepared
version too. `lib/ai-search.ts:700` relies on the two versions moving
together by hand.

Options:

- **A. Hash what is sent.** Hash `buildPreparedSystemPrompt()` and the
  built user message, plus the model, and keep the version as a label. Every
  stored note regenerates once on deploy.
- **B. Keep the manual version** and add a test that fails when the prompt
  text changes without a version bump.
- **C. Leave it.**

**Recommendation: A.** It removes a manual step instead of policing it. It
also stops regenerations for snapshot fields the lean form never sends.

### 5. Prompt v13 has never run on Strata

Production would send v13 to Strata (`LOCAL_AI_MODEL`). Strata has only run:

- v9 on 20 days;
- v10 and v12 on 10 days each.

v12 scored 5/6/10 against v10's 7/8/8 and produced the reply in 1a. v13 has
been measured only on Opus.

**Recommendation:** after the parser fix, run
`scripts/prepared-note-eval.ts --backtest` on Strata over the same 20 days.
Strata is free. Check `catalogOrderDays` and `rowsResolvedByName`. The run
takes 6–35 minutes a day, so split it into halves under the 2-hour
background limit (`--resume`).

### 6. Tonight reads the Prepared note after everything else

`app/page.tsx:71`.

- `preparedNoteFor` is awaited after the page's `Promise.all` (`:48`).
- Inside it, `getPreparedNote`, `getDecidedDates` and `snapshotForDay` (a
  full Log read) run one after another.
- So a Tonight render with the local model configured pays for the note's
  reads in series after its own.

**Recommendation:** start `preparedNoteFor` inside the `Promise.all`. It is a
small change that doesn't change behaviour. The specialist's confidence was
6, so measure before and after with the dev DB.

### 7. The brief misses the contrast bar in dark mode

`app/prepared-brief.tsx:72` renders `text-muted` on `bg-raised`, as
DESIGN.md "Prepared brief" specifies.

- Dark mode: `#8b8f98` on `#2c2f33` is **4.15:1**, under DESIGN.md's 4.5:1
  bar.
- Light mode: 4.58:1, which passes.
- The AI rationale line shares the look, so this is design-system debt the
  brief inherits, not something this branch introduced.

Options:

- **A. Lighten dark `muted` until it clears 4.5:1 on `raised`.** About
  `#9a9ea6`. Update DESIGN.md in the same commit; this changes every muted
  label in dark mode.
- **B. Give AI prose its own token.**
- **C. Leave it.**

**Recommendation: A**, through `/design-review`, since it is a token change
that needs your approval under DESIGN.md.

### 8. Simplifications (advisory)

The simplification specialist's suggestions come to about −99 lines. None is
a defect.

| Where | What | Lines |
|---|---|---|
| `scripts/backtest-baseline.ts:46` | Reuse the backtest's scoring instead of a parallel loop | ~38 |
| `lib/snapshot.ts:677` | Build the lean rows directly instead of projecting the full ones | ~25 |
| `scripts/prepared-note-eval.ts:88` | `captureLogLine` duplicates the eval's capture helper | ~15 |
| `lib/prepared-note.ts:240` | The v9 marker fallback, now that v13 is current | ~12 |
| `lib/prepared-label.ts:8` | One `toLocaleTimeString` call instead of hand formatting | ~7 |
| `scripts/backtest-compare.ts:19` | A local helper the backtest already exports | ~2 |

**Recommendation:**

- Take the v9 marker fallback only if no stored note predates v10; the sweep
  regenerates them anyway.
- Take the lean-rows change together with item 4, which touches the same
  code.
- Leave the script ones unless you are editing those scripts.

## Informational

- **Test gaps.** No test covers the backtest's `catalogOrder` flag (the
  detector for 1a) or `pickUnderIntervalDays`/`pickUnderIntervalHit5`.
- **Household text is no longer delimited** in the snapshot; only the query
  is. This was a documented choice: the authors are the Household behind one
  password. The one outside source is Restaurant names filled from Google
  Places, and model output renders as React text.
- **The gate check found five hunks that removed tests.** All five were
  moved or justified, not weakened:
  - The `buildSnapshot` tests moved to `lib/snapshot.test.ts`.
  - The Pick-supersedes-Rejection tests moved to
    `lib/day-decisions.db.test.ts`.
  - The route's snapshot-assembly tests moved to `lib/snapshot.db.test.ts`.
  - The delimiter tests went with the delimiters.
  - Coverage of this check was partial: 50 of 133 eligible hunks read.

## Not run

- `pnpm test:db` (needs Postgres) and `pnpm build`.
- A browser pass: gstack's headless Chromium can't start in this container.
- A live Strata sweep.
- Codex's own CLI: its sandbox can't start here, so the outside pass went
  through Paseo/omp instead.

## Fixed in `6931b4c`

- **Snapshot numbering** breaks a tie between same-name Options on id, so
  their numbers and the input hash don't depend on Postgres row order.
- **The backtest:**
  - It counts never-eaten top-5 slots on scored days only, matching its
    `scored * 5` denominator.
  - It refuses a non-numeric `--count`/`--window`.
- **`ai-search-eval --snapshot`** prints the lean snapshot actually sent.
- **The thinking-off error** names the `AI_EFFORT` value.
- **Docs:**
  - `.env.example` documents `off` with always-thinking models.
  - `CLAUDE.md` says `prepared-note-eval --claude` is billed.
- **Stale comments:**
  - the `todayDayNote` "Delimited" comment;
  - the dead `maxRationaleLength` parameter and its docstring;
  - the `backtest-baseline.ts` header;
  - a double blank line.
