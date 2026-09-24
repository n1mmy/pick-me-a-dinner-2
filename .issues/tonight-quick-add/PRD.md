# PRD: Add an Option from Tonight

Status: ready-for-agent

Vocabulary: [`CONTEXT.md`](../../CONTEXT.md) — **Option**, **Restaurant**,
**Home meal**, **Pick**, **Rejection**, **Bring back**, **Closed day**, **Closed
disclosure**, **Selected day**, **Archived**, and **AI search** govern this PRD.
Respects
[`docs/adr/0007-expose-every-sensible-control.md`](../../docs/adr/0007-expose-every-sensible-control.md)
(every control wherever it makes sense; a control behaves identically wherever
it is placed) and
[`docs/adr/0009-tonight-ranks-a-selected-day.md`](../../docs/adr/0009-tonight-ranks-a-selected-day.md)
(everything on Tonight anchors on the Selected day).

---

## Problem Statement

When the Household is deciding dinner and wants an Option that isn't in the
Catalog yet — a new restaurant, a new recipe — the only path is: leave Tonight,
open Catalog, add it there, come back to Tonight, find it, Pick it. The moment
the gap is noticed is almost always in Tonight's search box: the name is typed,
nothing matches.

A related trap sits in the same box. The typeahead's candidates are the
picker's rows, so an Option that is **Closed** or **Rejected** on the Selected
day never matches. A Household member who knows what they want, types it, and
sees nothing cannot tell "not in the Catalog" from "shut today" — and would be
invited to add a duplicate once an Add affordance exists.

## Solution

Tonight's search box becomes the place to find *any* active Option and to add a
missing one:

1. **The typeahead lists every active Option.** Closed and Rejected Options on
   the Selected day appear with a muted note (`· closed Mondays`, `· rejected
   tonight`). Selecting one does not Pick immediately — an inline confirm under
   the box says why it was hidden and offers **Pick anyway / Cancel**, plus a
   link to the Option detail page (where a wrong Closed day gets fixed). Options
   already Picked on the Selected day appear as a non-selectable `already
   picked` row.
2. **An "Add 'X'…" row** closes the list whenever no active Option's name
   equals the query (case-insensitive). It is never the default highlight, so
   Enter with nothing highlighted still runs AI search.
3. **Selecting it expands the full `OptionForm` inline** below the search box,
   prefilled with the typed name, kind Restaurant (switchable to Home meal), with
   Places search available. It warns when the name matches an **Archived**
   Option. Two buttons: primary **Add & Pick for tonight** / **Add & Pick for
   Friday** (any Selected day, past included), and secondary **Add**.
4. **A Pick supersedes that date's Rejection — everywhere.** Picking an Option
   on a date it carries a Rejection deletes the Rejection, in both server-side
   Pick paths, so Tonight, Log, and the Option detail page agree (CONTEXT.md,
   **Pick**).

## User Stories

1. As the Household, I type a new restaurant's name on Tonight and add it
   without leaving the screen.
2. As the Household, I add it and Pick it for the Selected day in one action.
3. As the Household, I can add it without Picking, so it joins the rotation.
4. As the Household, I can add a Home meal the same way by switching the kind.
5. As the Household, typing "Thai Basil" when only "Thai Orchid" exists still
   offers to add "Thai Basil".
6. As the Household, when I type an Option that's closed today, I see it with a
   "closed" note and am asked before it's Picked — so I learn it's shut instead
   of assuming it isn't in the Catalog.
7. As the Household, when I type something I rejected earlier tonight and Pick
   it anyway, the Rejection goes away.
8. As the Household, typing something already in tonight's Dinner shows it as
   already picked rather than nothing.
9. As the Household, adding a name that matches an Archived Option warns me and
   links to it, so I can Un-archive instead of duplicating.
10. As the Household, typing a craving ("something light") and pressing Enter
    still runs AI search, even though an Add row is shown.

## Implementation Decisions

- The Rejection-superseding rule lives in the server actions (`pickTonight`,
  `logForDate` in `app/log/actions.ts` — the only two `dinner_log` insert
  paths), not in UI, so every screen behaves the same.
- The typeahead's candidates widen from the picker rows to picker + closed +
  rejected + Picked-on-day, each tagged with its `Suppression`
  (`lib/day-suppressions.ts` already names `"picked" | "rejected" | "closed"`).
- The "exact name exists" check for the Add row runs against that full active
  set. The Archived-name warning is a separate check when the form opens.
- `createOption` returns the new Option's id so Add & Pick can log it.
- Kind default is always Restaurant (not derived from the KindSegment).
- The inline confirm reuses `app/confirm-pair.tsx`; no modal (DESIGN.md).

## Out of Scope

- Un-archiving from the typeahead (the form's warning links to the detail page).
- The reverse rule — Rejecting an Option already Picked on that date. Behaviour
  unchanged by this PRD.
- Changing the Catalog's own add flow.
