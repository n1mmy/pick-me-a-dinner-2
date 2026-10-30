# 01 — Pin the Prepared prompt, then split it into shared blocks

Status: done
Type: AFK

## Parent

[Spec: Rank-only rankings and run-to-run spread](../PRD.md) ·
[Plan](../../../plans/old/rank-only-rankings.md), step 1

## What to build

This is a prefactor with no change in behaviour. The Prepared system
prompt and user message stay byte-for-byte the same, so no stored
**Prepared note** goes out of date. The prompt is split into named blocks
that a second prompt can reuse.

- **Pin the current text first.** In `lib/prepared-note.test.ts`, pin
  `buildPreparedSystemPrompt()` and `buildPreparedUserMessage()` (on the
  test file's fixture snapshot) with `toMatchFileSnapshot` under
  `lib/__snapshots__/`. Commit this before refactoring, while the text is
  still as it is at HEAD.
- **Split `buildPreparedSystemPrompt`** in `lib/prepared-note.ts` into
  named blocks:
  - the opening;
  - the snapshot description;
  - `SNAPSHOT_EVIDENCE` and `RECENCY_THROUGH_HABITS` (imported, as now);
  - the "two things" line;
  - the ranking paragraph, as a lead ("First, the ranking: ") plus a
    shared body;
  - the rationale paragraph;
  - the brief paragraph;
  - `RATIONALE_RULES`;
  - the data-not-instructions line;
  - the output format.

  `buildPreparedSystemPrompt` joins them exactly as before.
- **`candidateChecklist`** takes whether the brief line follows, and the
  Prepared message passes "yes".
- **A deliberate byte difference** is allowed only with a reason. It shows
  as the snapshot diff, is named in the commit message, and bumps
  `PREPARED_PROMPT_VERSION`. The aim is no difference.

## Acceptance criteria

- [x] The pin is committed before the split, and the snapshot files hold
      the HEAD text.
- [x] After the split the snapshots are unchanged, or each difference is
      named in the commit message with the version bumped.
- [x] The ranking body and the checklist are reachable as blocks a second
      prompt can use.
- [x] `npx tsc --noEmit`, `npx next lint` and `npx vitest run` pass.

## Blocked by

None (can start immediately).
