# 03 — Option detail page: Rejection history section

Status: ready-for-agent
Type: AFK

## Parent

[PRD: Option detail page](../PRD.md)

## What to build

The **Rejection** history section of the **Option detail page**: every
Rejection ever made for one **Option**, in one place.

The section lists the Option's Rejections newest first, each showing its date
and the reason when one was given (the reason is omitted cleanly when none was
given). An Option that has never been rejected shows a quiet empty state.

A Rejection made *today* carries a **Bring back** control: bringing it back
deletes the Rejection entirely and updates the page in place. A Rejection from
an earlier day is settled history — it renders plain, with no Bring back. Use
the existing `lib/rejections.ts` today-vs-earlier partition to decide which
Rejections are still undoable, and the existing Bring back action rather than a
new one.

## Acceptance criteria

- [ ] The detail page lists every Rejection ever made for the Option, newest first
- [ ] Each Rejection shows its date and reason; a Rejection with no reason renders cleanly without one
- [ ] A Rejection made today carries a Bring back control
- [ ] Bringing back a Rejection deletes it and updates the page in place
- [ ] A Rejection from an earlier day renders as plain history with no Bring back
- [ ] An Option that has never been rejected shows a quiet empty state
- [ ] The full gate passes — `pnpm typecheck`, `lint`, `test`, `build`

## Blocked by

- [01 — Option detail page: core](./01-detail-page-core.md)
