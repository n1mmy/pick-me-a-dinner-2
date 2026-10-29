# 07 — One API generation: delete the model and thinking matrix

Status: ready-for-agent
Type: AFK

## Parent

[Spec: Backtest the AI ranking, then decide](../PRD.md) ·
[Plan: simplifications](../../../plans/simplifications-2026-10-29.md), step 2

## Why

`lib/ai-search.ts` carries budget-API models, adaptive models, always-on
models, bare-integer budgets, an explicit `disabled` for Fireworks, and a
stream/non-stream split. Each backtested model added a branch; production
runs one model at one effort. Review item 2 (`AI_EFFORT=off` throws on the
default model) is the first defect of the matrix. The user does not care
about the old models.

## What to do

See the plan, step 2. Adaptive thinking, streamed, `ADAPTIVE_MAX_TOKENS`,
`output_config.effort` from `AI_EFFORT` as `low` | `medium` | `high`,
default `low`. Delete `BUDGET_API_MODELS`, `usesAdaptiveThinking`,
`THINKING_ALWAYS_ON_MODELS`, `canDisableThinking`, `EFFORT_BUDGETS`,
`OUTPUT_HEADROOM_TOKENS`, the no-thinking `MAX_TOKENS`, the `off` and
`budget` arms, the bare-integer branch and both throws, the non-streamed
path. Follow in the tests, `.env.example`, and keep
`scripts/prepared-note-eval.ts --claude` on the same request shape.

## Acceptance

- [ ] `AI_EFFORT=off` falls back to `low` like any unrecognised value, and a
      test says so.
- [ ] Nothing in `lib/` names a Claude model family other than the default
      model id.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` pass.
