# 12 — "Strata" means the server; the role is "the local model"

Status: done
Type: AFK

## Parent

[Spec: Backtest the AI ranking, then decide](../PRD.md) ·
[Plan: simplifications](../../../plans/simplifications-2026-10-29.md), step 7

## Why

Grilling of 2026-10-29, Q16: Strata is a server; the model it serves is a
Qwen; the other candidate is the same model family on a llama.cpp server;
both have OpenAI-compatible endpoints. From the app's side all of that is
"the local model", which is the only term the glossary needs (**Prepared
note** already says "a local model the Household runs at home"). The choice
of a local model is for where it runs, not what it costs; ADR-0011 now says
so.

## What to do

Docs and comments only. Where a comment attributes a behaviour to "Strata"
that belongs to the model — a reasoning model writing `reasoning_content`
before `content`; stopping at the last row; writing in the snapshot's schema;
dropping rows from the tail — say "the local model". Keep "Strata" beside a
measurement taken on it (tokens per second, the forty-minute bound, the
backtest run names). `CLAUDE.md`'s billed-call paragraph is right as it is.

Record here, as a candidate and not as work: the brief could become a second
call after the ranking, given the top rows, if a read ever finds the briefs
inconsistent with their top three. The v13 reads did not.

## Acceptance

- [x] `grep -n Strata lib/ scripts/*.ts CLAUDE.md docs/` shows server
      references and measurements only.
- [x] `pnpm lint` passes.

## Comments

- Done. Behaviours moved to "the local model": the brief-as-a-row stop (`lib/prepared-note.ts`), reasoning before content, the re-sort framing that made it ignore recency (`lib/ai-search.ts`), ranks written as codes (ADR-0013, a test), reasoning traces (ADR-0012, `scripts/backtest.ts`), and the eval scripts' replies. ADR-0011 now says a Qwen served on a Strata server. What `grep -n Strata lib/ scripts/*.ts CLAUDE.md docs/` still shows is the server (the module header, `LOCAL_AI_*`, the stream shape in a test fixture, free to call, serving other clients) or a measurement on it (six to ten minutes idle, ~10 tok/s under load, the repeated-run ADR-0012 measurements, a long run). `CLAUDE.md` is unchanged, as the issue says. The two-call brief stays a candidate, recorded above.
