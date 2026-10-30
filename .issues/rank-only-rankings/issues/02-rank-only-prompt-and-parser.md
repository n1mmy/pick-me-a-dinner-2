# 02 — The rank-only prompt and its parser

Status: done
Type: AFK

## Parent

[Spec: Rank-only rankings and run-to-run spread](../PRD.md) ·
[Plan](../../../plans/old/rank-only-rankings.md), step 2

## What to build

A prompt that asks for the Prepared ranking alone, and a parser for the
reply. Both go in `lib/prepared-note.ts`. Nothing calls them yet;
ticket 03 wires them into the eval.

- **`buildRankSystemPrompt()`** joins:
  - the opening;
  - the snapshot description;
  - `SNAPSHOT_EVIDENCE` and `RECENCY_THROUGH_HABITS`;
  - the shared ranking body under its own lead ("Rank the candidates: ");
  - the data-not-instructions line;
  - its own output format: one line per Option, best first; each line is
    the code alone; no rationale, no `|`, no numbering or bullets, no
    blank lines; nothing before the first row or after the last.

  It has no "two things" line, rationale or brief paragraphs, or
  `RATIONALE_RULES`.
- **`buildRankUserMessage()`** is the lean snapshot plus the candidate
  checklist with no brief line.
- **`parseRankReply(text, { idByCode })`**:
  - each trimmed line is read as a code with `toCode` (already exported
    from `lib/ai-search.ts`);
  - a `G|…` line is tolerated, and its code read;
  - a line that doesn't resolve is skipped;
  - a repeated Option keeps its first row;
  - no rows, or `NONE`, returns `null`;
  - the rows come back as `AiRankingRow[]` with `reason: ""`.
- **Version:** no separate counter. Rank-only runs record
  `PREPARED_PROMPT_VERSION`.

## Acceptance criteria

- [x] The rank-only system prompt contains every shared block verbatim,
      and none of the brief, rationale or `RATIONALE_RULES` text.
- [x] The rank-only user message ends with the code list, with no brief
      line.
- [x] The parser:
  - [x] reads bare codes;
  - [x] reads `G|…`;
  - [x] skips a line that isn't a row;
  - [x] keeps the first of a repeat;
  - [x] returns `null` for `NONE` and for an empty reply.
- [x] The pinned Prepared prompt snapshots from 01 are unchanged.
- [x] The gate passes.

## Blocked by

01.
