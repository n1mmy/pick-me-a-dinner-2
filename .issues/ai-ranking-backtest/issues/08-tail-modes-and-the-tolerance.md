# 08 — Delete the `full` and `drop` tail modes, and the `3|G|` tolerance

Status: ready-for-agent
Type: AFK

## Parent

[Spec: Backtest the AI ranking, then decide](../PRD.md) ·
[Plan: simplifications](../../../plans/simplifications-2026-10-29.md), step 3

## Why

`AI_TAIL_MODE` keeps three open-query prompt variants for an A/B that is
over; `pithy` is the only one ever run. The `3|G|` tolerance in
`readRankingRow` was added with the Option codes two commits ago; it is the
first new parser branch after the relabelling, and the instinct that built
the name column. ADR-0013 says a rank written where a code belongs is refused
and regenerated.

**Not touched:** the `OPEN` marker, the `open` flag and
`backfillOmittedCandidates`. A narrowing search shows its shortlist alone;
that is a product feature (grilling Q5, 2026-10-29).

## What to do

Two commits; see the plan, step 3.

1. Tail modes: `TailMode`, `resolveTailMode`, `AI_TAIL_MODE`, the `full` and
   `drop` instructions, `buildSystemPrompt`'s `mode` parameter, the
   `tailMode` log field, `--mode` in `scripts/ai-search-eval.ts`, the
   `.env.example` paragraph, the tests.
2. The tolerance: `readRankingRow` reads the first column only; the tests
   that read `3|G|…` as `G` assert the refusal instead.

## Acceptance

- [ ] No `AI_TAIL_MODE` outside `plans/` and `scripts/backtest-runs/`.
- [ ] A reply written `3|G|…` on every row is refused by both parsers.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` pass.
