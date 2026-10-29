# 08 — Delete the `full` and `drop` tail modes, and the `3|G|` tolerance

Status: done
Type: AFK

## Parent

[Spec: Backtest the AI ranking, then decide](../PRD.md) ·
[Plan: simplifications](../../../plans/old/simplifications-2026-10-29.md), step 3

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

- [x] No `AI_TAIL_MODE` outside `plans/` and `scripts/backtest-runs/`.
- [x] A reply written `3|G|…` on every row is refused by both parsers.
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test` pass.

## Comments

- Done in one commit rather than two, at the user's request (one commit per issue). The pithy prompt is byte-identical (`EVERY_CANDIDATE_INSTRUCTION` folded into `OPEN_QUERY_INSTRUCTION`), so the prompt version did not move. Backtest file names keep the `-pithy` suffix so v15 lands as `ai-search-v15-opus-5-5-pithy`; `backtest-compare` still prints an old file's `meta.tailMode`. The parser doc no longer says an empty rationale is pithy's verdict: the prompt asks for "never nothing".
