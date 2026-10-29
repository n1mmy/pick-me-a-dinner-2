# 05 — Option codes: a rank written as an id resolves to nothing

Status: done
Type: AFK

## Parent

[Spec: Backtest the AI ranking, then decide](../PRD.md)

## Why

The snapshot numbered Options `1..N` by alphabetical position, and a ranking
is a list of positions `1..N`. A model that wrote its rank where the Option
number belonged produced a row that was valid in every way the parser could
check, and the ranking that came back was the Catalog in alphabetical order.
Nothing caught it: the ranked-share check passed, the sweep would have
stored it, Tonight would have shown the first Option alphabetically wearing
another Option's reasoning.

Recorded, in `scripts/backtest-runs/`:

| Run | Catalog-order rankings accepted as good |
|---|---|
| `strata-v9` | `2026-10-02` (37 rows alphabetical, scored hit@5), `2026-10-14` (partial) |
| `strata-v12` | `2026-10-08`, every row `rank\|number\|name\|…` (scored hit@5) |
| `ai-search-v12-glm-5p3-low-pithy` | `2026-10-08` (scored hit@5), `2026-10-10` |
| `prepared-v13-opus-5-5-low` | `2026-10-09`, `2026-10-16` — rescued by the v10 name column |

The v10 name column was a patch for this, and brought defects of its own:
two Options of one name collapsed, a `|` in a name split the row, an
unmatched name leaked into the rationale, and a four-column row defeated
the check (the v12 day above). Each new reply shape needed a new parser
branch. The pre-landing review of 2026-10-28 (`plans/old/code-review-2026-10-28.md`,
item 1) proposed a fifth.

## What changed

Decision: ADR-0013. Term: **Option code** in `CONTEXT.md`. Plan:
`plans/option-codes.md`.

- `lib/snapshot.ts`: Options are coded `A`…`Z`, `AA`… by alphabetical
  position (`optionCode`, `codeIndex`); `idByCode` replaces `idByIndex`;
  every `id`/`optionId` the model sees is a code.
- `lib/ai-search.ts`: `readRankingRow` reads one `<code>|<rationale>` line
  for both rankers, with one tolerance (`3|G|…` reads `G`); `toCode` accepts
  letters only. A rank written as a code is no candidate, so the row drops
  and a reply written in ranks falls under `MIN_RANKED_SHARE` and is refused.
- `lib/prepared-note.ts`: the name column, `idByName`, `resolvedByName`, the
  v9 marker and the two-sided reading are gone; the parser is the shared row
  reader plus the `brief|` line.
- Both prompts at version 14 say "code", give its source positively ("its id
  in its own options entry"), and the checklist reads `A, B, …, AK`.
- `scripts/backtest.ts`: `catalogOrder` orders by `codeIndex` and stays as
  the sentinel; `resolvedByName` is dropped from the record.

## Acceptance

- [x] A reply written in rank positions (`1|…`, `2|…`) is refused by both
      parsers (`lib/prepared-note.test.ts`, `lib/ai-search.test.ts`).
- [x] Two Options sharing a name, and a name containing `|`, each rank by
      code.
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test` pass.
- [ ] `strata-v14`: the Strata backtest of prompt v14 over the 20 days,
      `catalogOrder` false on every day, hit@3/5/10 recorded beside v10's
      7/8/8 (not run yet; free).
