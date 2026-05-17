# 05 — AI search: config gating and observability

Status: ready-for-agent
Type: AFK

## Parent

[PRD: AI search on Tonight](../PRD.md)

## What to build

Gate AI search on configuration, and make each model call observable.

Add `aiSearchEnabled()` to `lib/ai-search`, returning whether
`ANTHROPIC_API_KEY` is set — mirroring `placesEnabled()`. The Tonight page
passes a "search enabled" flag to the screen; the search box is **hidden
entirely** when the key is absent (Tonight is then exactly v1) or when the
Catalog is empty.

Make the model env-configurable: a new `AI_MODEL` env var selects the model id,
defaulting to a current Claude Sonnet model. Add `ANTHROPIC_API_KEY` and
`AI_MODEL` to `.env.example`. The build must still succeed with no env vars
set.

Emit one **structured log line per model call**: query length, model id,
latency, outcome (`ok` or `fallback:<class>`), and the count of Options
returned.

`lib/check-env.ts` is **not** modified — `ANTHROPIC_API_KEY` is optional and
does not belong in the hard-required boot set.

## Acceptance criteria

- [ ] `aiSearchEnabled()` reports whether `ANTHROPIC_API_KEY` is set
- [ ] The search box is hidden when the key is absent or the Catalog is empty
- [ ] `AI_MODEL` selects the model id, defaulting to a Sonnet model;
      `ANTHROPIC_API_KEY` and `AI_MODEL` are in `.env.example`
- [ ] Each model call emits one structured log line (query length, model,
      latency, outcome, result count) on both the ok and the fallback paths
- [ ] A screen-level test covers the search box hidden when search is not
      enabled
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green, and
      `pnpm build` passes with no env vars set

## Blocked by

- Issue 01 — AI search: end-to-end skeleton
