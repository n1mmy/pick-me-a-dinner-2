# Simplifications after the backtest round

Decided in the grilling of 2026-10-29, on `ai-ranking-backtest`, which is not
ready for `main`. The question was: the prompt-rules round (v10 to v11) and
the Option-code round (ADR-0013) were both the same rabbit hole — a model
misbehaved, a tolerant layer grew a branch per misbehaviour, and the fix was
to delete the layer and change what it tolerated. Where else is that shape
already visible, and what gets deleted now?

## Fixed, not up for change

- **Offline computation on a local model, shown at page load** (ADR-0011).
  The local model is a Qwen served from home — on a Strata server today, a
  llama.cpp server as the other candidate — chosen for running at home on
  solar, not for cost. ADR-0011 and the glossary's **Prepared note** entry
  now say so. A Claude-written note was measured at about twenty seconds and
  fourteen cents (`scripts/backtest-runs/prepared-v13-opus-5-5-low`) and the
  decision stood. The mechanism around the local model (brief-as-row,
  checklist, timeout, lease) is free to change; the shape is not.
- **A narrowing search shows its shortlist alone.** The open-query signal
  (`OPEN`, `backfillOmittedCandidates`) stays, mechanism free.
- **Everything lands on this branch.** The v13 and v14 local-model backtests
  are running in another worktree on the same branch; conflicts in
  `scripts/backtest-runs/` are resolved later, not avoided.

## Kept, with the reason written down

- **Per-Tag timing facts** (`tags` block, ADR-0012). They fixed a recorded
  Tag-level repeat. The v13 read's "sushi as a tag comes round every few
  days" is debatable, not wrong. Revisit only if a read shows the model due
  against a Tag the way it was due against the Interval.
- **Per-Tag Rejections**, as evidence rather than a rule. `CONTEXT.md`'s
  **Rejection** entry no longer says a too-soon reason "speaks for its Tags";
  it says the reach is a judgement. The 40-day v11 read found the Household
  contradicting the rule three times.
- **The brief as the last row.** A second call for the brief is a candidate
  for when the brief misbehaves (issue 12 notes it); the v13 reads found the
  briefs consistent with their top three.

## Steps

Each step is one issue under `.issues/ai-ranking-backtest/issues/` and at
least one commit; `pnpm typecheck`, `pnpm lint` and `pnpm test` pass at every
commit. Deletions first, since they need no read; then the hash; then the one
snapshot change with its read; then the two sweep fixes; then the docs pass.
Line anchors are at `420b2b8`.

### 1. The old harness and the text flags (issue 06)

Delete:

- `scripts/model-comparison/` whole — the September harness the backtest
  replaced (its JSON records, `README.md`, `summary.md`, the `.mjs` tools).
  `lib/ai-search.ts:791` cites `show-prompt.mjs` as the reason `splitUserTurn`
  is exported; `scripts/ai-search-eval.ts --snapshot` is the remaining
  caller, so the export stays and the comment names it.
- `scripts/backtest-baseline.ts` — scratch with a hard-coded day list;
  `scripts/backtest-score.ts` is the real baseline ranker.
- In `scripts/ai-search-eval.ts`: `--compare`, `--cells`, `--reps`,
  `--serial`, `COMPARE_CELLS`, the Fireworks cells, `ComparisonCell`, the
  compare JSON writer (`:16-23, :38-63, :88-190, :240-360`). What remains: a
  plain run, `--day`, `--snapshot`, `--backtest` and its flags.
- In `scripts/backtest.ts`: `RHYTHM_CLAIM_SUSPECTS`, `WEEKDAY_CLAIM`,
  `CADENCE_WORDS`, `STOPWORDS`, `contentWords`, `noteWords`, `nameWords`,
  `namedInBrief`, `householdWords` (`:55-96, :229-245, :268-300, :345-375`);
  `flags`, `briefNamed` and `briefMentionsDayNote` on `DayRecord`
  (`:157-164`); `briefNamedOutsideTop3`, `briefMissingDayNote`,
  `elapsedSuspects`, `weekdayClaims`, `timingOnlyTopRows` in `summarize`
  (`:427-435`); their printing in the per-day report and the table
  (`:649-684, :717`). `brief` itself stays on the record: the read section
  prints it.
- In `scripts/backtest-compare.ts`: the flag markers and columns (18 lines
  mention `flags`). Old JSON files still load: the flag fields are already
  optional in its `Day` type.
- In `scripts/backtest.test.ts`: the `RHYTHM_CLAIM_SUSPECTS` block (`:61-`)
  and the flag assertions (`:124-138, :154-155`).

What stays in a record: `picks`, `bestRank`, `scorable`, `hit3/5/10`,
`pickTiming`, `tooSoonMisses`, `emptyTop10`, `catalogOrder`, `brief`,
`ranking`, `latencyMs`, `outputTokens`; in the aggregate: the hit counts,
mean and median rank, `daysWithTooSoonMiss`, `pickUnderIntervalDays`,
`pickUnderIntervalHit5`, `neverEatenTop5Slots`, `emptyTop10Reasons`,
`catalogOrderDays`.

Done when: the files are gone, the eval script's header lists only the flags
it still takes, a backtest JSON from before this step still compares against
one made after it, and the three checks pass.

### 2. The model and thinking matrix (issue 07)

`lib/ai-search.ts:316-499` and `:892-896`. One API generation: adaptive
thinking, streamed, `ADAPTIVE_MAX_TOKENS`, `output_config.effort` from
`AI_EFFORT` as `low` | `medium` | `high`, default `low`.

Delete: `BUDGET_API_MODELS`, `usesAdaptiveThinking`,
`THINKING_ALWAYS_ON_MODELS`, `canDisableThinking`, `EFFORT_BUDGETS`,
`OUTPUT_HEADROOM_TOKENS`, the no-thinking `MAX_TOKENS`, the `off` and
`budget` arms of `ThinkingChoice` (it becomes an effort level, or goes, with
`overrides.effort` in its place), the bare-integer branch and both throws in
`envThinkingChoice`, the `stream: false` path in `planThinking` and
`createAiSearchClient`, `describeThinking`'s two dead arms. The log line's
`thinking` field becomes `effort:<level>`.

Follow: `lib/ai-search.test.ts` (`:386-400, :505-610, :644-700`: the budget,
numeric, throw and `messages.create` cases go; the adaptive cases stay);
`app/api/ai-search/route.test.ts`; `.env.example`'s `AI_EFFORT` paragraph
shrinks to the three levels; `scripts/prepared-note-eval.ts --claude` keeps
its own `--effort` and builds the same request shape.

Done when: `AI_EFFORT=off` is an unrecognised value that falls back to `low`
(a test says so), nothing in `lib/` names a model family, and the three
checks pass. Review item 2 (`plans/code-review-2026-10-28.md`) is closed by
this step.

### 3. Tail modes, and the `3|G|` tolerance (issue 08)

Two commits.

**Tail modes.** `lib/ai-search.ts:501-530, :654-690, :727-733, :772`.
`pithy` is the only open-query instruction; `full` and `drop` go, with
`TailMode`, `resolveTailMode`, `AI_TAIL_MODE`, the `mode` parameter of
`buildSystemPrompt`, and the `tailMode` log field. `EVERY_CANDIDATE_INSTRUCTION`
folds into the one instruction. Follow: `lib/ai-search.test.ts:210-240,
:749, :783`; `scripts/ai-search-eval.ts --mode` and `:466, :528-537`;
`.env.example`'s `AI_TAIL_MODE` paragraph; the module header's "tunable via
`AI_TAIL_MODE`" line. The `OPEN` marker, `parseRankingText`'s `open` flag and
`backfillOmittedCandidates` are untouched: a narrowing query's shortlist
stands alone (grilling Q5).

**The tolerance.** `readRankingRow` (`lib/ai-search.ts:129-146`) reads the
first column only; the second `resolve` goes. A reply written `3|G|…` resolves
no rows and is refused under `MIN_RANKED_SHARE`, as ADR-0013 says. The tests
that assert `3|G|…` reads as `G` (`lib/prepared-note.test.ts`,
`lib/ai-search.test.ts`) assert the refusal instead.

Done when: no `AI_TAIL_MODE` anywhere outside `plans/` and the recorded runs,
`readRankingRow` has one resolution path, and the three checks pass.

### 4. Hash what is sent (issue 09)

`lib/prepared-notes.ts:49-53`. `inputHash` takes the built snapshot and the
model and hashes `[model, buildPreparedSystemPrompt(),
buildPreparedUserMessage(built)]` — the bytes the local model receives.
`PREPARED_PROMPT_VERSION` stays as the label the eval scripts put in file
names and `meta`; it no longer feeds the hash, and the comment at
`lib/ai-search.ts:721-722` about the two versions moving together goes.
`preparedNoteFor` (`:206-`) passes the built value it already has. Every
stored note regenerates once after deploy; that is accepted.

Test (`lib/prepared-notes.db.test.ts`, `pnpm test:db`, needs Postgres): a
stored note reads `current`; a change to a shared prompt block with no version
bump reads `out-of-date`. A pure test in `lib/prepared-note.test.ts` can cover
the hash function if it is exported.

Done when: the hash input is the system prompt, the user message and the
model, and the tests above pass (`test:db` run locally if Postgres is up;
say so if it was not).

### 5. Weekday counts leave the snapshot (issue 10)

The Interval story one field over: a summary number the model turned into
claims on flat counts, a strict test added (v10) and removed (v11), the claim
rate up again on the 40 days. Every Log date carries its weekday, so a real
habit is still findable.

- `lib/snapshot.ts`: `weekdays` off `SnapshotModelOption` (`:145-152`),
  `weekdayCountsOf` (`:605-625`) and its call (`:461`); the `buildSnapshot`
  doc bullet (`:303-310`). `WEEKDAY_NAMES` stays for `closedDays` and dates.
- `lib/ai-search.ts` `SNAPSHOT_EVIDENCE` (`:558-569`): the timing bullet
  names `eaten`, `daysSinceLast` and `recentGaps` only; the `weekdays`
  sentence goes. `RATIONALE_RULES`: "a weekday habit the counts bear out"
  becomes "a weekday habit the Log bears out", which is the glossary's
  wording already.
- `lib/prepared-note.ts:155`: `weekdays` leaves the list of field names.
- Both prompt versions become `"15"`.
- `lib/snapshot.test.ts:91, :707, :736-742`.
- ADR-0012: a fourth amendment line; the sentence "and its eats per weekday"
  and "A `tags` block carries all but the weekdays" rewritten in place.
- `CONTEXT.md`: **Recent gaps** and **AI rationale** are already written
  without the counts; check **Prepared note**'s "weekday habits" still reads
  as something the brief may say, not a snapshot field.

**Read.** One Opus 5.5 AI-search run of v15 on the original 20 days
(`--days=` from `ai-search-v13-opus-5-5-pithy.json`'s `meta`), compared
against that v13 run through `backtest-compare`. Twenty billed calls, about
three dollars; approved in the grilling of 2026-10-29, and the count is still
stated before the run, per `CLAUDE.md`. What to read for: weekday claims on
counts of one or two gone from the top 10; the swim Tuesdays still top-5
hits; hit@N within the noise floor of v13. The local-model read of v15 queues
behind the v13 and v14 runs in the other worktree and is run from whichever
worktree holds v15 at the time; it is not a gate for this step.

Done when: no `weekdays` in `lib/`, the Opus run is recorded as
`ai-search-v15-opus-5-5-pithy.{json,log}` with its read as a comment on the
issue, and the three checks pass.

### 6. Two sweep fixes (issue 11)

`lib/prepared-notes.ts`, review item 3a and 3b. The other two (3c retry
forever, 3d a deploy holds a claim) are accepted and not done.

- **3a.** `runSweep` (`:151`) reads the eligible dates once and a pass can
  run for hours. At the top of each iteration, recheck that `day` is not
  before `todaySqlDate(new Date(), timeZone)` — a fresh clock, not the
  sweep's `now` — and skip it if it is, so a generation that finishes after
  midnight never writes onto a date Tonight now treats as frozen.
- **3b.** `preparedNoteFor` (`:206-`) reports a date with no candidates as
  `frozen`, mirroring the sweep's skip at `:160`, instead of hashing an
  empty snapshot and reporting `out-of-date` forever.

Tests in `lib/prepared-notes.db.test.ts`.

Done when: both tests pass under `pnpm test:db` (or the run is reported as not
possible), and the three checks pass.

### 7. "Strata" means the server (issue 12)

Docs only. "Strata" is the server; the model is a Qwen; the alternative is the
same model on llama.cpp; the role is "the local model". Where a comment or
doc attributes a behaviour to "Strata" that belongs to the model (a reasoning
model writing `reasoning_content` first; stopping at the last row; writing in
the snapshot's schema), say "the local model", and keep "Strata" beside a
measurement taken on it (tokens per second, the forty-minute bound). Record
the two-call brief as a candidate in this issue's text, not as work.

Done when: `grep -n Strata lib/ scripts/*.ts CLAUDE.md docs/` shows only
server references and measurements.

## Out of scope

- Replacing the local model with Claude (grilling Q1: no, for where it runs).
- Appending unranked Options to a narrowing search (Q5: no, product feature).
- The dark-mode contrast of the brief (review item 7): off-branch, through
  `/design-review`.
- Tonight's `Promise.all` (review item 6): measure first, not part of this.
