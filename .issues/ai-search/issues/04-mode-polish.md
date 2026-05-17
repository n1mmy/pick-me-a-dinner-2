# 04 — AI search: mode polish and accessibility

Status: ready-for-agent
Type: AFK

## Parent

[PRD: AI search on Tonight](../PRD.md)

## What to build

Make AI search a clean, accessible **mode**, not a bare list swap.

While an AI result is shown, **hide the filter zone** — the
All/Home/Restaurant kind segment and the tri-state Tag filter chips — so the
query is the single ranking authority. Clearing the search restores both the
deterministic list and its filter controls.

While a search is **in flight**, show a pending indicator and **disable the
search box**; the deterministic list stays visible underneath until the result
arrives, then swaps. Disabling the box means only one search runs at a time, so
a slow response can never overwrite a newer query — no separate race guard is
needed.

Accessibility: announce the swap between the deterministic list and the AI
result, and announce the pending and error states, to assistive tech. The
search box, the submit control, and the clear control are keyboard-reachable
with visible focus and have adequate touch targets on phone and desktop.

## Acceptance criteria

- [ ] The kind segment and Tag filter chips are hidden while an AI result is
      shown, and restored when the search is cleared
- [ ] The search box shows a pending state and is disabled while a search is in
      flight; the deterministic list stays visible underneath until the result
      arrives
- [ ] The swap between deterministic list and AI result, and the pending and
      error states, are announced to assistive tech
- [ ] The search box, submit, and clear controls are keyboard-operable with
      visible focus and have adequate touch targets
- [ ] A screen-level test covers clearing-restores-the-filter-zone and the
      in-flight disable
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green

## Blocked by

- Issue 01 — AI search: end-to-end skeleton
