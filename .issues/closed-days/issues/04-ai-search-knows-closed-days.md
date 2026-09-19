# 04 — AI search: drop closed candidates, and tell the model why

Status: ready-for-agent
Type: AFK

## Parent

[PRD: Closed days](../PRD.md)

## What to build

The AI half. Two changes that look redundant but are not.

**1. Drop closed Restaurants from the candidate set.** In `buildSnapshot`,
Restaurants closed on `asOf` leave the candidate `options` **and** `idByIndex`,
exactly as anchor-day-rejected ones do — so `parseRankingText` drops the number
if the model returns it anyway, and a closed Restaurant cannot resurface as a
result. This is the guarantee.

Numbering still covers the **whole** Catalog, so a closed Restaurant keeps a
stable number for its Log and Rejection rows and its eating history still reads
as history. Dropping its history too would distort the patterns the model reads.

`app/tonight-actions.ts` passes `closedDays` through in its `options.map`.

**2. Send each remaining candidate's Closed days.** `SnapshotOption` and
`SnapshotModelOption` gain `closedDays`, serialized as **weekday names** —
`["Sunday", "Monday"]` — matching the snapshot's existing human-readable dates;
the model reads a name without arithmetic and cannot mis-index it. **Omit the
key entirely** when the Restaurant has none, so an always-open Restaurant and
every Home meal cost nothing.

Closed days are app-derived structure, not Household-authored text — do **not**
wrap them in `<household-text>` delimiters.

Confront the obvious objection before implementing: if closed Restaurants are
already dropped, every candidate the model sees is open, so why send the field?
Because the prompt asks the model to find *"Options or Tags that have quietly
dropped out of rotation"*, and a Restaurant closed two days a week has a
structurally thinner history that reads as waning interest. This is the field's
whole payoff, and it is why the prompt change below is not optional decoration.

**3. The prompt.** Add a short paragraph to `buildSystemPrompt`: Closed days are
a fact about the restaurant; the candidates shown are already open on today's
date; use closures to **explain gaps in the history** rather than reading them
as an Option the household has gone off.

Do **not** add a "never recommend a closed Option" rule. The candidate drop
already makes that impossible, and a rule against an impossible failure only
competes for attention with the rules that do work.

While in there: ADR-0006's `"closed on Sundays"` example in the Rejections
paragraph is now the wrong concept — it describes a **Closed day**, not a
standing Rejection. Replace it with a genuine standing-dislike example.

## Acceptance criteria

- [ ] A Restaurant closed on `asOf` is absent from the snapshot's candidate
      `options` and from `idByIndex`
- [ ] Its number is still assigned, and its Log and Rejection rows still carry
      that number
- [ ] `parseRankingText` drops a closed Restaurant's number if the model returns
      it
- [ ] A candidate's `closedDays` serializes as weekday names; the key is absent
      when the Restaurant has none
- [ ] Closed days are not `<household-text>`-wrapped
- [ ] A Restaurant both closed and anchor-day-rejected is dropped once, with no
      duplicate entry and no crash
- [ ] The system prompt explains Closed days and their use in reading history
      gaps, and carries no "never recommend a closed Option" rule
- [ ] The prompt's `"closed on Sundays"` Rejection example is replaced
- [ ] All the above covered in `lib/ai-search.test.ts`; no live Anthropic call
      in any test
- [ ] One hand-verified smoke check against a live AI search confirms a closed
      Restaurant is absent from the results
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green, and
      `pnpm build` passes with no env vars set

## Blocked by

- Issue 01 (the column and `getTonightData`'s `closedDays`)
