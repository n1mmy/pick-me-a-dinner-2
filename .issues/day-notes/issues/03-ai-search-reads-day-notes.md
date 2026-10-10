# 03 — AI search reads Day notes

Status: ready-for-agent
Type: AFK

## Parent

[Spec: Day notes](../PRD.md)

## What to build

Feed Day notes to AI search. Depends on 01 for the `day_notes` table. Can land
before or after 02.

- **Snapshot.** `buildSnapshot` (`lib/ai-search.ts`) takes Day notes as an
  extra input. The snapshot gains a dated `dayNotes` list (past and future,
  newest first, the same order as `log`) and the anchor day's Day note as its
  own field, or null. There's no cap on how far back it goes, matching the full
  Log.
- **Route.** The AI search route handler (`app/api/ai-search/route.ts`) loads
  all Day notes and passes them in.
- **System prompt.** `buildSystemPrompt` says a Day note is a fact about the
  Household's evening, not about any Option, and that the anchor day's one is
  current context for this search.
- **Docs.** Update the **AI search** entry in `CONTEXT.md` to mention that it
  reads Day notes.

Do not run `scripts/ai-search-eval.ts`. It's a billed full-snapshot run, and
the user has to approve it first (CLAUDE.md).

## Acceptance criteria

- [ ] `buildSnapshot` tests: past and future Day notes appear dated and newest
      first; the anchor day's note is surfaced separately, and is null when
      absent; the candidate set and numbering are the same with or without Day
      notes
- [ ] `buildSystemPrompt` test covers the Day note instruction
- [ ] Route test covers Day notes reaching the snapshot
- [ ] `CONTEXT.md` **AI search** entry updated
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green
