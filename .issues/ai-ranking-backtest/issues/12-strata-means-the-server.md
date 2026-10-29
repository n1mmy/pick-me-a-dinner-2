# 12 — "Strata" means the server; the role is "the local model"

Status: ready-for-agent
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

- [ ] `grep -n Strata lib/ scripts/*.ts CLAUDE.md docs/` shows server
      references and measurements only.
- [ ] `pnpm lint` passes.
