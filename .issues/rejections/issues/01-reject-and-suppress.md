# 01 — Rejections: reject an Option, suppressed for the day

Status: ready-for-agent
Type: AFK

## Parent

[PRD: Rejections on Tonight](../PRD.md)

## What to build

The first complete path through **Rejections**, end to end: a member of the
Household turns down an **Option** on the **Tonight** picker for tonight's
decision, the Option leaves tonight's list, and it returns on its own the next
day.

Add a new `rejections` table — an Option reference (`ON DELETE CASCADE`, so a
Rejection never blocks an Option's hard-delete), an optional `reason`, the
`rejected_on` date (the Household's calendar day in `APP_TZ`), and a created
timestamp — with its Drizzle migration (applied out-of-band per the deploy
model). A Rejection is not a Log entry and carries no Score weight.

On each Tonight picker row add a **secondary, low-emphasis** reject control,
subordinate to the primary Pick button (visual treatment per `DESIGN.md`).
Tapping it inline-expands a reason box on the row — an autofocused text input
with **Submit** and **Cancel**. The reason is **optional**. Submit calls a new
`rejectOption` server action (`authedAction`-wrapped) that records the Rejection
dated today; Cancel collapses the box with nothing recorded. The two-step
(reject → Submit) is the mis-tap guard; there is no separate post-submit undo on
the row.

A submitted Rejection removes the Option from the deterministic Tonight list
immediately. Suppression is **server-derived** from the `rejections` rows where
`rejected_on` is today — so it survives a page reload — and is a **presentation
filter only**: `lib/ranking.ts` and the Score are untouched (ADR-0003,
ADR-0006). Because `rejected_on = today` empties on a new calendar day, a
rejected Option reappears with no day-boundary logic. Rejecting works in picker
mode and in decided mode's reopened picker alike, and works whether or not
`ANTHROPIC_API_KEY` is configured.

The "Rejected tonight" disclosure and the AI-search wiring are deliberately out
of this slice — they are the issues blocked on this one.

## Acceptance criteria

- [ ] A `rejections` table (Option ref `ON DELETE CASCADE`, optional reason,
      `rejected_on` date, created timestamp) with a Drizzle migration; an
      Option's hard-delete is not blocked by its Rejections
- [ ] Every Tonight picker row has a secondary reject control, subordinate to
      Pick, in both picker mode and decided mode's reopened picker
- [ ] Tapping reject inline-expands an autofocused reason box with Submit and
      Cancel; the reason is optional
- [ ] Submit records the Rejection dated today via the `authedAction`-wrapped
      `rejectOption`; Cancel records nothing
- [ ] A rejected Option leaves the deterministic Tonight list immediately and
      stays gone across a page reload
- [ ] A rejected Option reappears on its own the next calendar day
- [ ] Rejecting every remaining Option leaves a plain empty-list state, not a
      broken screen
- [ ] `lib/ranking.ts`, the Score, and `rankTonight`'s tests are unchanged —
      suppression is a presentation filter
- [ ] Rejecting works with no `ANTHROPIC_API_KEY` set
- [ ] The reject control, reason box, Submit, and Cancel are keyboard-operable
      with visible focus and adequate touch targets; the reason box's open
      state and the row's removal are announced to assistive tech
- [ ] `rejectOption` is `authedAction`-wrapped and rejects an unauthenticated
      caller
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green, and
      `pnpm build` passes with no env vars set

## Blocked by

- None — can start immediately
