# 06 — Option detail page Rejection management

Status: ready-for-agent
Type: AFK

## Parent

[PRD: Dated Rejections on the Log](../PRD.md)

## What to build

The **Option detail page**'s Rejections section gains the same inline
management as the Log.

Every **Rejection** of that Option — past, today, or future — is inline-editable
(Option, date, reason) and deletable, reusing the rejection row component built
in issue 05. The section's current today-only **Bring back** button is subsumed
by the always-available Delete. Editing or deleting updates the page in place
(the issue-04 actions revalidate `/catalog/[id]`).

Tonight's "Rejected tonight" disclosure is untouched — **Bring back** there
stays the today-only quick-undo.

## Acceptance criteria

- [ ] The Option detail page's Rejections section offers inline edit and delete
      on every Rejection row, regardless of age
- [ ] Edit changes the Option, date, or reason; a duplicate shows the inline
      "Already rejected for that date" error
- [ ] Delete uses the inline-confirm and removes the Rejection entirely
- [ ] The today-only "Bring back" button on the detail page is replaced by the
      always-available Delete
- [ ] Editing or deleting updates the detail page in place
- [ ] Tonight's "Rejected tonight" disclosure and its "Bring back" are
      unchanged
- [ ] Controls are keyboard-operable with visible focus and adequate touch
      targets; action results are announced to assistive tech
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green, and
      `pnpm build` passes with no env vars set

## Blocked by

- [05 — Log screen Rejection management UI](./05-log-rejection-ui.md)
  — reuses the rejection row component built there
- [04 — Rejection server actions + Log Rejections query](./04-rejection-actions.md)
