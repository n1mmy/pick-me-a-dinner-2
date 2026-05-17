# 04 — Option detail page: Option controls

Status: ready-for-agent
Type: AFK

## Parent

[PRD: Option detail page](../PRD.md)

## What to build

The Option-level controls on the **Option detail page** — so a member of the
Household can act on an **Option** from its full view, not only from the screen
that happens to carry each control (ADR-0007).

The page can **Pick** the Option (creating today's **Log entry**), **Reject**
it with an optional reason, **Edit** its fields inline via the reused Option
form, **Archive** it, and **Delete** it. Each control reuses the existing
server action rather than a new one. Destructive actions (Archive, Delete) take
an inline-confirm step, consistent with the Catalog row and `DESIGN.md` §17.

Pick, Reject, and Edit update the page in place. A successful **Delete** sends
the member back to the **Catalog** screen — the Option no longer exists, so the
page cannot stay; a stale link to a Deleted Option lands on the not-found page
(already handled in issue 01). A Delete blocked because the Option has Log
entries (the **Hard-delete** rule, ADR-0001) shows the existing inline error
and keeps the page.

The reused actions' revalidation is extended so a change made on the detail
page also revalidates `/catalog/[id]`.

(The Archive control is completed into an Archive / **Un-archive** toggle in
issue 05; this slice ships Archive.)

## Acceptance criteria

- [ ] The detail page can Pick the Option, creating today's Log entry, and updates in place
- [ ] The detail page can Reject the Option with an optional reason and updates in place
- [ ] The detail page can edit the Option's fields inline via the reused Option form
- [ ] The detail page can Archive the Option behind an inline-confirm step
- [ ] The detail page can Delete the Option behind an inline-confirm step
- [ ] A successful Delete returns to the Catalog screen
- [ ] A Delete blocked by existing Log entries shows an inline error and keeps the page
- [ ] Changes made on the detail page revalidate `/catalog/[id]`
- [ ] The full gate passes — `pnpm typecheck`, `lint`, `test`, `build`

## Blocked by

- [01 — Option detail page: core](./01-detail-page-core.md)
