# 03 — Rejections: feed AI search

Status: done
Type: AFK

## Parent

[PRD: Rejections on Tonight](../PRD.md)

## What to build

Make the Household's Rejections shape future **AI searches** (ADR-0006).

Add a pure `lib/rejections.ts` module: given the Rejection rows (each with its
Option's name / kind / Tags for readability) and today's date, it **partitions**
them into *rejected tonight* and *earlier*, derives the **suppression set** of
today's rejected Option ids, and shapes the **snapshot block** — reasons wrapped
in `<household-text>` delimiters, dates formatted with weekday (the ADR-0005
date-with-weekday format), newest first, parallel to the Log block.

Extend the AI search snapshot: `ModelSnapshot` gains a Rejections block with
`rejectedTonight` (Options dropped from the candidate set, each with reason +
date) and `earlierRejections` (Options still candidates, each with reason +
date). `buildSnapshot` drops today's-rejected Options from the candidate
`options` array — that is the AI-result suppression — and attaches the block.
Extend `SYSTEM_PROMPT`: the Rejections block is the Household's record of
Options turned down and why; the model reads each reason with its date and
frequency and decides for itself which Rejections are standing and which were
one-off (ADR-0006); "rejected tonight" Options are deliberately not candidates,
but their reasons may inform the ranking of other Options. The block is raw
dated history, consistent with ADR-0005 — no pre-digested signal.

The query feeding the snapshot returns Rejections of **active** Options only,
mirroring how the Log already excludes Archived Options' entries.

## Acceptance criteria

- [x] `lib/rejections.ts` partitions Rejection rows into rejected-tonight and
      earlier on an exact today boundary, derives the today suppression set, and
      shapes the snapshot block (delimited reasons, weekday dates, newest first,
      a null reason carried as null)
- [x] `buildSnapshot` drops today's-rejected Options from the candidate
      `options` and attaches a Rejections block with the `rejectedTonight` and
      `earlierRejections` groups
- [x] An earlier-rejected Option still appears in the candidate `options`
- [x] `SYSTEM_PROMPT` explains the Rejections block and that the model judges
      standing versus one-off itself
- [x] A rejected Option is absent from AI search results for the rest of the day
- [x] Rejections of Archived Options are excluded from the snapshot
- [x] A Rejection with no reason is still carried into the snapshot
- [x] Unit tests cover `lib/rejections.ts` in full and extend
      `lib/ai-search.test.ts` for the candidate-drop and the Rejections block
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green

## Blocked by

- [01 — Rejections: reject an Option, suppressed for the day](./01-reject-and-suppress.md)
