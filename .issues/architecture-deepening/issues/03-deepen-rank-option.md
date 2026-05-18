# 03 — Deepen rankOption so the Archived-Option rule lives behind its interface

Status: done
Type: AFK

## What to build

`rankOption` in `lib/ranking.ts` computes the single-Option ranking view for
the Option detail page. Its interface forces the caller to know a subtle rule:
`getTonightData` feeds the ranking only **active** Options' Log entries, so to
rank an **Archived** Option the caller must first splice that Option's own Log
history back into the entries it passes. `app/catalog/[id]/page.tsx` does
exactly that — an `if (!option.active)` loop with an explanatory comment. That
domain knowledge belongs inside the ranking module, not in a page component.

Move it behind the interface. `rankOption` takes a single input object:

- `target` — the Option being ranked.
- `activeOptions` — the active Catalog (the per-Tag **Recency** carriers).
- `activeLog` — the active Catalog's non-future Log entries.
- `targetLog` — the `target` Option's own Log entries.
- `today` — today as an epoch-day.

Per-Option **Recency** always derives from `targetLog`; per-Tag recency from
`activeLog` over `activeOptions`; the **Score** stays `null` when `target` is
not among `activeOptions` (an Archived Option is excluded from the ranking but
still gets factual recency). For an active Option the result is unchanged —
its own entries are present in `activeLog` either way, and `targetLog` is just
its own history.

`app/catalog/[id]/page.tsx` then drops the `if (!option.active)` splice
entirely and passes `getOptionLog`'s result straight in as `targetLog`.

This does not touch ADR-0003: the ranking stays a pure TypeScript function.

## Acceptance criteria

- [x] `rankOption` takes one input object and handles the active/archived
      distinction internally — no caller pre-massages its input
- [x] The Option detail page no longer splices an Archived Option's history
      into the ranking input; the `if (!option.active)` block is removed
- [x] For an active Option, `rankOption` still equals that Option's
      `rankTonight` row over the same inputs (the existing equivalence test
      holds, adapted to the new interface)
- [x] `lib/ranking.test.ts` adds a direct Archived-Option case — Score
      `null`, per-Option Recency computed from the Option's own history
- [x] No `CONTEXT.md` or ADR changes are needed (ADR-0003 is untouched)
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green, and
      `pnpm build` passes with no env vars set

## Blocked by

- None - can start immediately
