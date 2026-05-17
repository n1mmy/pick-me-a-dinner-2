# 02 — Rejections: see and undo today's Rejections

Status: ready-for-agent
Type: AFK

## Parent

[PRD: Rejections on Tonight](../PRD.md)

## What to build

Building on the reject path, give the Household a way to see today's Rejections
and undo a mistaken one.

Add a **"Rejected tonight (N)" disclosure** pinned at the bottom of the Tonight
picker list, after the ranked rows, **collapsed by default** so it costs no
screen space until the Household scrolls to it — the pattern mirrors decided
mode's "Add another option" disclosure. The heading carries a count of today's
Rejections. Expanded, it lists each of today's Rejections — the Option name, and
the reason when one was given — each with a **"Bring back"** control.

"Bring back" calls a new `bringBackRejection` server action
(`authedAction`-wrapped) that **deletes** the Rejection record by id. Deleting
it returns the Option to tonight's list immediately and — because the record is
gone, not merely expired — ensures a mis-tapped Rejection never reaches AI
search. "Bring back" is offered only for today's Rejections; managing the
historical Rejection log is out of scope (see the PRD).

The disclosure renders in picker mode and in decided mode's reopened picker
alike.

## Acceptance criteria

- [ ] A "Rejected tonight (N)" disclosure pinned at the bottom of the picker
      list, collapsed by default, showing a count of today's Rejections
- [ ] Expanded, it lists today's Rejections with the Option name and the reason
      when one was given
- [ ] Each entry has a "Bring back" control calling the `authedAction`-wrapped
      `bringBackRejection`
- [ ] "Bring back" deletes the Rejection record and returns the Option to
      tonight's list immediately
- [ ] Only today's Rejections appear in the disclosure
- [ ] The disclosure renders in picker mode and in decided mode's reopened
      picker
- [ ] The disclosure toggle and every "Bring back" control are
      keyboard-operable with visible focus and adequate touch targets
- [ ] `bringBackRejection` is `authedAction`-wrapped and rejects an
      unauthenticated caller
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green

## Blocked by

- [01 — Rejections: reject an Option, suppressed for the day](./01-reject-and-suppress.md)
