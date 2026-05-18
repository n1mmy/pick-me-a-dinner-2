# 06 — Option detail page: links from Tonight and Log

Status: done
Type: AFK

## Parent

[PRD: Option detail page](../PRD.md)

## What to build

Make the **Option detail page** reachable from the remaining two screens that
show an **Option**'s name.

The Option name becomes a link to `/catalog/[id]` on **Tonight** rows and on
**Log** entry rows (the Catalog row link already shipped in issue 01). The link
is styled so it is visually distinct from the row's action controls — Pick,
Reject, Edit, Delete — sitting beside it, and tapping the name never triggers
those controls.

## Acceptance criteria

- [x] The Option name on a Tonight row links to its detail page
- [x] The Option name on a Log entry row links to its detail page
- [x] The name link is visually distinct from the row's action controls and does not interfere with them
- [x] The full gate passes — `pnpm typecheck`, `lint`, `test`, `build`

## Blocked by

- [01 — Option detail page: core](./01-detail-page-core.md)
