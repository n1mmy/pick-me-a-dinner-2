# Option codes: ending the rank/number confusion

The first fix out of `plans/old/code-review-2026-10-28.md`, taken ahead of the
rest of that review. Decided in the grilling of 2026-10-28; the decision is
ADR-0013, the term is **Option code** in `CONTEXT.md`.

## The defect

The snapshot numbers Options `1..N` (`lib/snapshot.ts:393`). A ranking is a
list of positions `1..N`. A model that writes its rank position where the
Option number belongs produces a row that is valid in every way the parser
can check, and the ranking that results is the Catalog in alphabetical order.

Recorded, across the 20 backtest runs:

| Run | Catalog-order rankings accepted as good |
|---|---|
| strata-v9 | 2026-10-02 (scored hit@5), 2026-10-14 (partial) |
| strata-v12 | 2026-10-08, every row `rank\|number\|name\|…` (scored hit@5) |
| ai-search-v12 GLM 5.3 | 2026-10-08 (scored hit@5), 2026-10-10 |
| prepared-v13 Opus | 2026-10-09, 2026-10-16 — rescued by the name column |

Both parsers are affected: AI search has no name column at all. The v10 name
column was a patch for this, and brought shared-name, `|`-in-name and
leaking-name defects of its own.

## The fix

Make the two namespaces disjoint by type. Options get **letter codes**
(`A`…`Z`, `AA`…, in the same alphabetical order), the name column goes, and
both parsers read one row shape. A rank written as a code resolves to no
candidate, the row drops, the reply falls under `MIN_RANKED_SHARE` and is
refused — loud, with no new parser branch.

Defaults taken without asking (say so if you want them otherwise):

- The JSON keys the model sees stay `id` (on an Option) and `optionId` (on a
  Log or Rejection row); only their values change, from `7` to `"G"`. The
  prose calls the value the Option's code.
- Codes are read case-insensitively (`g` resolves as `G`).
- One tolerance survives, now safe: a row whose first column is not a code
  but whose second is (`3|G|…`) reads the second. A first column of digits
  can never be an Option.

## Steps

Each step ends on its completion criterion. Steps 1–4 are one commit (the
tests don't pass between them); 5 and 6 are their own.

### 1. Codes in the snapshot (`lib/snapshot.ts`, `lib/rejections.ts`)

- `optionCode(i)`: 0-based index → `A`…`Z`, `AA`…`AZ`, `BA`…; and
  `codeIndex(code)` back, for ordering in the backtest.
- `SnapshotModelOption.id`, `SnapshotModelLogEntry.optionId`,
  `SnapshotTagRejection.optionId` (and the Rejections block row) become
  `string`. The ordering rule is unchanged: alphabetical by name, tie on
  Option id (`lib/snapshot.ts:391`).
- `idByIndex: Map<number, string>` → `idByCode: Map<string, string>`;
  `indexByOptionId` → `codeByOptionId` (`lib/rejections.ts:106-163`).
- Doc comments at `lib/snapshot.ts:116-122, 246-255, 272-277, 303-306` say
  code, and why letters (one line, pointing at ADR-0013).
- `leanSnapshot` and `otherOptions` carry the code through unchanged.

Done when: `lib/snapshot.test.ts` numbering tests (`:67-78, :210, :227,
:359, :633, :929, :962-981`) assert codes, and `pnpm typecheck` is clean for
`lib/`.

### 2. One row reader (`lib/ai-search.ts`, `lib/prepared-note.ts`)

- `toIndex` → `toCode`: `/^[A-Za-z]+$/`, upper-cased, else `null`.
- Extract the row reading from `parseRankingText` (`:199-222`) into
  `readRankingRow(line, idByCode): AiRankingRow | null` with the one
  tolerance above. `parseRankingText` keeps its sentinel and `OPEN` handling
  and calls it.
- `parsePreparedReply` becomes: for each line, `brief|…` → the brief,
  otherwise `readRankingRow`; first row per Option kept; rationale capped at
  `MAX_PREPARED_RATIONALE_LENGTH`; `requireBrief` and the brief bound stay.
- Delete: `idByName`, the name-wins rule, `resolvedByName` and
  `ParsedPreparedReply` (callers take `PreparedNote`), `PREPARED_MARKER` and
  the two-sided above/below reading, the `nameById` parameter.
- `onReply` (`lib/prepared-note.ts`) stops reporting `resolvedByName`.

Done when: `lib/prepared-note.test.ts` has, replacing `:175-210`:
- a reply written in rank positions (`1|…`, `2|…`, …) returns `null`;
- `3|G|…` reads as `G`;
- two Options sharing a name both rank, each by its code;
- an Option whose name contains `|` ranks by code with its rationale whole;
- a `|` inside a rationale is kept.
And `lib/ai-search.test.ts:71` reads `code|rationale` rows, plus the same
rank-positions-refused case through `parseRankingText` (returns `null` when
no row resolves).

### 3. Both prompts, version 14

`lib/prepared-note.ts` (`:99-182`, `:420-427`) and `lib/ai-search.ts`
(`:683-695`, `:715-751`):

- "number" → "code" throughout; the output line is `<code>|<rationale>`.
- The code instruction is positive and names its source: "the code is the
  Option's `id` from its own entry in `options` (a letter or two, like `G` or
  `AB`)". The sentence "never its position in your ranking" goes; nothing
  else mentions positions.
- The checklist reads "Rank all 37 candidates: A, B, C, …, AK."
- The Prepared format drops the name column and its "the number and the name
  must be the same Option's" sentence.
- `PREPARED_PROMPT_VERSION` and `AI_SEARCH_PROMPT_VERSION` → `"14"`.
- The comment at `lib/ai-search.ts:700` about the versions moving together
  is left for review item 4.

Done when: the prompt tests (`lib/prepared-note.test.ts:320-332, :425`;
`lib/ai-search.test.ts:218`) assert the code wording and the lettered
checklist, and neither prompt contains "number" in the sense of an Option
label (grep the built prompts in a test).

### 4. Scripts and the backtest record

- `scripts/backtest.ts`: `numberById` → `codeById`; `catalogOrder` compares
  `codeIndex` (so `AA` sorts after `Z`); drop `resolvedByName` from the
  record (`:155-156, :329-331`) and from any printing; row labels print the
  code (`#G`).
- `scripts/backtest-score.ts:37`, `scripts/prepared-note-eval.ts:142, :240,
  :258-325`, `scripts/ai-search-eval.ts`: `idByIndex` → `idByCode`; the eval
  no longer prints rows resolved by name.
- `scripts/backtest.test.ts` follows.

Done when: `pnpm typecheck`, `pnpm lint`, `pnpm test` pass.

### 5. Records and docs (own commit)

- `scripts/backtest-runs/README.md`: one paragraph after the run list naming
  the Catalog-order days that counted as hits (strata-v9 10-02, strata-v12
  10-08, GLM 10-08) and that v14 codes make the shape refusable; the
  `prepared-v13` line's "resolved by name" sentence stays as history.
- `CONTEXT.md` **Option code** and ADR-0013 are already written; ADR-0011
  carries its amendment line.
- `.issues/ai-ranking-backtest/`: file the defect and its fix per
  `docs/agents/issue-tracker.md`, pointing at the recorded days as evidence.

Done when: the README paragraph exists and the issue is filed.

### 6. Measure: Strata on v14 (free)

`scripts/prepared-note-eval.ts --backtest` over the same 20 days as
`prepared-v13-opus-5-5-low`, in two halves under the 2-hour background
limit, the second with `--resume`. Then `scripts/backtest-compare.ts`
against `strata-v10` (first ten days) and `prepared-v13-opus-5-5-low`.

Done when: the run is recorded as `strata-v14` with `catalogOrder` false on
every day, the count of refused days is in the README line, and hit@3/5/10
are recorded beside v10's 7/8/8.

## Out of scope here

The rest of `plans/old/code-review-2026-10-28.md`, to be grilled after this
lands: the midnight store guard (3a), frozen for a zero-candidate date (3b),
accepting 3c/3d, hashing what is sent (4), the Tonight `Promise.all` (6),
dark-mode contrast off-branch (7), the lean-rows simplification (8). Item 1
(parser), 1c and 1d (names), 5 (v13 on Strata) and the v9-fallback
simplification are closed by this plan.
