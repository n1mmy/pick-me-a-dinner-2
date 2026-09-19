# 03 — Tonight: suppression and the Closed disclosure

Status: ready-for-agent
Type: AFK

## Parent

[PRD: Closed days](../PRD.md)

## What to build

The deterministic half of the feature: a Restaurant closed on the **Selected
day** leaves Tonight's ranked list and collects in a **Closed disclosure** at
the foot of the screen.

**The predicate.** Put it in a pure helper, not inline in the page component, so
it is directly unit-testable: given a Restaurant's `closedDays` and the Selected
day's weekday, is it closed? Empty set → never closed. Use
`weekdayFromSqlDate` from issue 01 — do not derive the weekday a second way.

**The filter.** In `app/page.tsx`, applied **after** `rankTonight`, alongside
the existing Rejection filter. The ranking is untouched: no Score, affinity,
readiness, or recency value moves because a Restaurant is shut (ADR-0003,
ADR-0010).

Order matters. Apply the **Rejection** filter first, then take the closed set
from what remains — a Restaurant both closed and rejected on the Selected day
belongs in the Rejected disclosure only, never in both.

The rule is uniform across past, present, and future Selected days. Do not
special-case a past day: a weekday rule with a today-or-later exception is a
second rule to carry forever, and ADR-0008's "suppression stays purely
date-driven" holds.

**The disclosure** (full spec in `DESIGN.md`, "Closed disclosure
(2026-09-19)"). A sibling of `RejectedTonightDisclosure` in
`app/tonight-screen.tsx`, rendered **below** it — Rejected holds the
time-sensitive undo, so it keeps the closer position. Collapsed by default.
Heading `Closed tonight (N)` / `Closed on Friday (N)`, from the same `dayLabel`
helper, matching its sibling's lowercase casing.

Rows are `TonightRowItem` — the same component, so Pick, Reject-with-reason, the
chip row, and the Last note all come along. Make `rank` optional on that
component; when absent the `w-6` gutter still renders **empty**, so Option names
stay on the same vertical as the picker's above. Order the rows
**alphabetically** by name: this is a list, not a ranking, and a number here
would refer to an order nobody is looking at.

No per-row closure label — the heading already says why every row is there.

Rejecting a row writes an ordinary Rejection dated the Selected day, so
revalidation moves it into the Rejected disclosure with no special handling.
A Restaurant Picked anyway appears in the decided block unremarked.

**The empty-picker message.** `app/page.tsx:95`'s `allRejected` flag currently
distinguishes "filtered to nothing" from "the Catalog is empty". Generalize it
to one flag covering both filter causes, with copy that does not claim the
Household rejected something they never touched. Keep the distinction from an
empty Catalog; do **not** build a three-way matrix — it is a rare case and both
disclosures sit directly below.

## Acceptance criteria

- [ ] A pure, unit-tested predicate decides closure from `closedDays` plus the
      Selected day; empty `closedDays` never suppresses
- [ ] Unit tests cover: matching weekday suppresses, non-matching does not, all
      seven days suppresses every day, and the result is identical for a past,
      present, and future Selected day
- [ ] A Restaurant closed on the Selected day is absent from Tonight's ranked
      list and present in the Closed disclosure
- [ ] A Restaurant both closed and rejected on the Selected day appears in the
      **Rejected** disclosure only
- [ ] The Closed disclosure renders below the Rejected one, collapsed by
      default, headed `Closed tonight (N)` / `Closed on Friday (N)`
- [ ] Its rows are alphabetical, carry no rank numeral, and keep the empty `w-6`
      gutter so names align with the picker above
- [ ] Its rows carry working Pick and Reject-with-reason controls; rejecting one
      moves it to the Rejected disclosure on revalidation
- [ ] A Restaurant Picked from the disclosure appears in the decided block with
      no closure marking
- [ ] Stepping the Selected day changes which Restaurants are suppressed, and
      the heading's day name follows
- [ ] The empty-picker copy is honest when the list was emptied by closures
      alone, and still distinguishes that from an empty Catalog
- [ ] `lib/ranking.ts` is unmodified by this issue
- [ ] The disclosure is keyboard-operable with visible focus throughout
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green

## Blocked by

- Issue 01 (the column, `getTonightData`'s `closedDays`, and
  `weekdayFromSqlDate`)
- Issue 02 in practice — without it there is no way to record a Closed day to
  test against, though the code does not depend on it
