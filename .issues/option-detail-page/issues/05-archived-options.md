# 05 — Option detail page: Archived Options

Status: ready-for-agent
Type: AFK

## Parent

[PRD: Option detail page](../PRD.md)

## What to build

Make **Archived** Options first-class on the **Option detail page**, and
reachable again.

An Archived Option's detail page renders its fields, **Log** history, and
**Rejections** normally. Because an Archived Option is excluded from the
ranking, its **Score** is replaced with the text "Archived — not ranked" — but
its **per-Option recency** line and its **Tag** heatmap chips still render:
those are factual recency data, not a Score. (`rankOption` from issue 01 should
already return `score: null` for an Archived Option.)

The page's Archive control becomes an Archive / **Un-archive** toggle: on an
Archived Option it offers Un-archive, which keeps the member on the page and
turns it back into a normal ranked detail page. Un-archive is a new
`unarchiveOption` server action — `authedAction`-wrapped, sets `active = true`,
revalidates — mirroring the existing Archive action.

Archived Options are reached from the **Catalog** screen via a new collapsed
**"Archived" disclosure** pinned at the bottom, after the Home meals and
Restaurants sections — the same disclosure pattern as Tonight's "Rejected
tonight". Expanded, it lists Archived Options as links to their detail pages.
The active Catalog list is unchanged.

## Acceptance criteria

- [ ] An Archived Option's detail page renders its fields, Log history, and Rejections normally
- [ ] An Archived Option's Score is replaced with "Archived — not ranked"
- [ ] An Archived Option's per-Option recency line and Tag heatmap chips still render
- [ ] The detail page offers Un-archive for an Archived Option via a new `unarchiveOption` action
- [ ] Un-archiving keeps the member on the page, which becomes a normal ranked detail page
- [ ] The Catalog screen has a collapsed "Archived" disclosure listing Archived Options as links to their detail pages
- [ ] The active Catalog list is unchanged
- [ ] The full gate passes — `pnpm typecheck`, `lint`, `test`, `build`

## Blocked by

- [01 — Option detail page: core](./01-detail-page-core.md)
- [04 — Option detail page: Option controls](./04-option-controls.md)
