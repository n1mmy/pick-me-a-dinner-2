# 03 — AI search: result hardening and empty state

Status: ready-for-agent
Type: AFK

## Parent

[PRD: AI search on Tonight](../PRD.md)

## What to build

Harden the AI result so a sloppy or empty model response still produces a clean
screen.

Complete `parseAndValidate` in `lib/ai-search`: beyond dropping hallucinated
`id`s (issue 01), **dedupe** repeated `id`s — keeping the first occurrence —
and **truncate** any AI rationale longer than ~80 characters. The rationale is
plain text; no markdown.

On Tonight, handle an **empty AI result** — the model legitimately returning
zero Options for a query nothing fits ("something light" when nothing
qualifies). Render a plain empty-state message with a clear/retry control,
mirroring the existing "No Options match the current filter" state.

## Acceptance criteria

- [ ] `parseAndValidate` dedupes repeated `id`s, keeping the first occurrence
- [ ] `parseAndValidate` truncates any rationale over ~80 characters and leaves
      a short one unchanged
- [ ] An empty AI result renders a plain empty-state message with a clear/retry
      control
- [ ] The clear/retry control returns the screen to the deterministic list
- [ ] Unit tests cover dedup, rationale truncation, and a short rationale left
      unchanged
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green

## Blocked by

- Issue 01 — AI search: end-to-end skeleton
