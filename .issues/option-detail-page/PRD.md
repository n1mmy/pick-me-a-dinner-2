# PRD: Option detail page

Status: ready-for-agent

Vocabulary: [`CONTEXT.md`](../../CONTEXT.md) — the **Option detail page** term
governs this PRD, alongside **Option**, **Home meal**, **Restaurant**,
**Score**, **per-Option recency**, **per-Tag recency**, **Log entry**,
**Planned dinner**, **Rejection**, **Bring back**, **Archived**, **Archive**,
**Hard-delete**. Decision:
[`docs/adr/0007-expose-every-sensible-control.md`](../../docs/adr/0007-expose-every-sensible-control.md)
— every place an item is shown carries every control that makes sense for it.
Respects [`docs/adr/0003-ranking-in-typescript.md`](../../docs/adr/0003-ranking-in-typescript.md)
(the ranking math is reused, not changed) and
[`docs/adr/0001-unified-options-table.md`](../../docs/adr/0001-unified-options-table.md)
(one `options` table, the Hard-delete rule).

This PRD adds the **Option detail page** — a per-Option screen at
`/catalog/[id]`. It does not change the ranking math, the Score formula, the
Log model, or the Rejection model.

---

## Problem Statement

The app shows an **Option** only ever as a *row* — one line on **Tonight**, in
the **Log**, in the **Catalog**. A row is deliberately terse: a name and a
couple of chips. There is nowhere to see everything about a single Option at
once.

So a member of the **Household** wondering "when did we last have this, and how
often — and didn't we turn it down a while back?" has no answer. Its **Log
entries** are scattered down the Log screen among every other Dinner; its
**Rejections** are visible only on the day they were made and then vanish from
view; a **Restaurant**'s address and phone live only inside the Catalog edit
form. To act on an Option — Pick it, Reject it, edit it, Archive it — the
member must also remember *which* screen carries *which* control.

And an **Archived** Option is worse off still: it drops out of the Catalog list
entirely, so its history becomes unreachable even though the data is all there.

## Solution

A dedicated **Option detail page** at `/catalog/[id]` that shows everything
about one Option on a single screen: its fields, its **Restaurant** address /
phone / map link when it is one, its ranking data (**Score**, **per-Option
recency**, **Tag** chips on the recency heatmap), its full **Log** history, and
its full **Rejection** history.

It is reached by tapping the Option's name anywhere it appears — Catalog,
Tonight, or Log. Following ADR-0007, the page carries *every* control that
makes sense for an Option: **Pick**, **Reject** (and **Bring back** for a
Rejection made today), **Edit**, **Archive** / **Un-archive**, and
**Delete** — and each **Log entry** in the History section is itself editable
and deletable in place.

**Archived** Options are first-class here: the page renders fully for one (the
**Score** alone is replaced with "Archived — not ranked", since an Archived
Option is excluded from the ranking), and a new collapsed **"Archived"
disclosure** at the bottom of the Catalog screen makes them reachable again.

## User Stories

### Reaching the detail page

1. As a member of the Household, I want to open an Option's detail page by
   tapping its name on the Catalog screen, so that I can drill into an Option
   from the screen that manages them.
2. As a member of the Household, I want to open an Option's detail page by
   tapping its name on the Tonight screen, so that I can inspect a ranked
   Option without losing my place in deciding.
3. As a member of the Household, I want to open an Option's detail page by
   tapping its name on the Log screen, so that I can jump from a logged Dinner
   to the full picture of what we ate.
4. As a member of the Household, I want the detail page to be a normal page
   navigation, so that the browser Back button returns me to where I came
   from.
5. As a member of the Household, I want a detail-page link to be visually
   distinct from the row's action controls, so that opening the page is never
   confused with Picking or Rejecting.
6. As a member of the Household, I want a detail page for a Home meal and for a
   Restaurant alike, so that every Option has the same complete view.

### Seeing the Option's identity and details

7. As a member of the Household, I want the detail page to show the Option's
   name prominently, so that I am sure which Option I am looking at.
8. As a member of the Household, I want the detail page to show whether the
   Option is a Home meal or a Restaurant, so that its kind is unambiguous.
9. As a member of the Household, I want the detail page to show the Option's
   notes, so that any free-text reminder I saved is visible.
10. As a member of the Household, I want the detail page to show the Option's
    link (menu / delivery / recipe URL) as a clickable link, so that I can open
    it directly.
11. As a member of the Household, I want the detail page to show the Option's
    Tags, so that I can see how it is categorized.
12. As a member of the Household viewing a Restaurant, I want the detail page
    to show its address and phone number, so that I have the practical details
    to visit or call.
13. As a member of the Household viewing a Restaurant, I want a link to the
    Restaurant's place data on Google Maps, so that I can get directions in one
    tap.
14. As a member of the Household viewing a Home meal, I want the page to omit
    the Restaurant-only fields entirely, so that the page shows nothing
    irrelevant.

### Seeing ranking data

15. As a member of the Household, I want the detail page to show the Option's
    Score, so that I can see how strongly the ranking favors it.
16. As a member of the Household, I want the Score shown as a rounded whole
    number with a one-line caption explaining it is a point-in-time,
    comparative figure, so that I do not mistake it for a fixed property of the
    Option.
17. As a member of the Household, I want the detail page to show the Option's
    per-Option recency — how long since we last had this exact Option, or
    "new" — so that I can see at a glance whether it is overdue.
18. As a member of the Household, I want the detail page to show the Option's
    Tag chips tinted on the red→green recency heatmap by each Tag's per-Tag
    recency, so that the same factual recency signal I read on Tonight is here
    too.
19. As a member of the Household, I want the ranking data on the detail page to
    match exactly what Tonight would show for the same Option, so that the two
    screens never disagree.

### Seeing Log history

20. As a member of the Household, I want the detail page to list every realized
    Log entry for this Option, so that I can see its full eating history in one
    place.
21. As a member of the Household, I want the realized Log entries listed newest
    first, so that the most recent Dinner is at the top.
22. As a member of the Household, I want each Log entry to show its date and any
    note, so that the history is more than a list of bare dates.
23. As a member of the Household, I want this Option's Planned dinners (Log
    entries dated after today) shown in their own group above the realized
    history, so that a plan is not buried among past Dinners.
24. As a member of the Household, I want to edit a Log entry from the detail
    page's History section, so that I can correct a date, note, or Option
    without going to the Log screen.
25. As a member of the Household, I want to delete a Log entry from the detail
    page's History section, so that I can remove a mistaken entry in place.
26. As a member of the Household, I want an Option with no Log entries to show a
    quiet empty state, so that "never eaten" reads as a real state, not a
    broken section.

### Seeing Rejection history

27. As a member of the Household, I want the detail page to list every
    Rejection ever made for this Option, so that I can see what I have turned
    it down for over time.
28. As a member of the Household, I want the Rejections listed newest first,
    each showing its date and the reason when one was given, so that the
    history is legible.
29. As a member of the Household, I want a Rejection made today to carry a
    "Bring back" control on the detail page, so that I can undo a mistaken
    Rejection from here, not only from Tonight.
30. As a member of the Household, I want "Bring back" on the detail page to
    delete the Rejection and update the page in place, so that the correction
    shows at once.
31. As a member of the Household, I want a settled Rejection (made on an
    earlier day) shown as plain history with no "Bring back", so that the list
    reflects that older Rejections are settled.
32. As a member of the Household, I want an Option that has never been rejected
    to show a quiet empty state, so that the section reads as a real state.

### Acting on the Option

33. As a member of the Household, I want to Pick the Option from its detail
    page, so that I can log tonight's dinner without going back to Tonight.
34. As a member of the Household, I want to Reject the Option from its detail
    page with an optional reason, so that turning it down works here as it does
    on Tonight.
35. As a member of the Household, I want to edit the Option's fields from its
    detail page, so that I can fix a typo or change Tags without going to the
    Catalog.
36. As a member of the Household, I want to Archive the Option from its detail
    page, so that I can retire it from the comfort of its full view.
37. As a member of the Household, I want to Delete the Option from its detail
    page when it has no Log entries, so that the Hard-delete control is where I
    am already looking.
38. As a member of the Household, I want a Pick, Reject, Bring back, Edit, or
    Log-entry change to update the detail page in place, so that I stay on the
    page I am working in.
39. As a member of the Household, I want Deleting the Option to send me back to
    the Catalog screen, so that I am not stranded on a page whose Option no
    longer exists.
40. As a member of the Household, I want the detail page route to return a
    not-found page if I open a link to an Option that has been Deleted, so that
    a stale link fails cleanly.
41. As a member of the Household, I want a destructive action (Delete, Archive)
    to take a confirm step, so that I cannot trigger it with a single mis-tap.

### Archived Options

42. As a member of the Household, I want a collapsed "Archived" disclosure at
    the bottom of the Catalog screen, so that Archived Options are reachable
    without cluttering the active list.
43. As a member of the Household, I want the "Archived" disclosure to list each
    Archived Option as a link to its detail page, so that I can read an
    Archived Option's full history.
44. As a member of the Household, I want an Archived Option's detail page to
    render its fields, Log history, and Rejections normally, so that archiving
    hides an Option from ranking without hiding its record.
45. As a member of the Household, I want an Archived Option's Score replaced
    with "Archived — not ranked", so that the page is honest that an Archived
    Option takes no part in the ranking.
46. As a member of the Household, I want an Archived Option's per-Option
    recency line and Tag heatmap chips still shown, so that the factual recency
    data is not lost just because the Option is Archived.
47. As a member of the Household, I want to Un-archive an Option from its
    detail page, so that I can bring it back into the Catalog and ranking from
    the screen I am reading.
48. As a member of the Household, I want Un-archiving to keep me on the detail
    page and turn it back into a normal ranked detail page, so that the change
    is immediate and visible.

### Cross-cutting

49. As a member of the Household, I want the detail page usable on phone and
    desktop with adequate touch targets, so that I can read and act on it in
    the kitchen.
50. As a member of the Household using a keyboard, I want every control and
    link on the detail page reachable with visible focus, so that the page is
    fully operable without a mouse.
51. As a member of the Household, I want the detail page to follow the
    `DESIGN.md` visual system — the sharp-instrument density, the meal-kind
    color channel, the recency heatmap — so that it feels part of the same app.

## Implementation Decisions

### Route and data loading

- A new dynamic route, `app/catalog/[id]/page.tsx` — a server component that
  loads the Option and its history by id, with `app/catalog/[id]/loading.tsx`
  for the streamed loading state.
- A request for an id that matches no `options` row renders Next's
  `notFound()` (the 404 a stale link to a Deleted Option lands on).
- The route is `/catalog/[id]` (not `/option/[id]`): the page is Option-shaped
  and the Catalog is the screen that owns Options; nothing else uses an
  `/option` namespace.

### `lib/ranking.ts` — single-Option ranking (`rankOption`)

- A new exported pure function produces one Option's ranking view: its Score,
  per-Option recency (days, capped at `CAP`), the never-eaten flag, and the
  per-Tag recency chips (`TagRecency[]`) — the same fields a `TonightRow`
  carries. It reuses the existing `lastEaten` / `lastTagUse` / `daysSince` /
  `optionScore` internals; the Score formula is unchanged (ADR-0003).
- For an **active** Option the result is identical to that Option's row in
  `rankTonight` — the two screens must never disagree (user story 19).
- For an **Archived** Option the Score is returned as `null` — the detail page
  renders "Archived — not ranked" for it. Per-Option recency and per-Tag
  recency are still computed and returned: they are factual recency data, not
  a Score, and the page shows them for an Archived Option too.
- per-Tag recency follows the existing definition (`CONTEXT.md` **Recency**):
  the carriers of a Tag are the **active** Options that hold it. An Archived
  Option's own Log history therefore does not feed per-Tag recency — exactly
  as today — but the Option's own per-Option recency is computed from its own
  Log entries regardless of Active/Archived state.

### `lib/dinner-grouping.ts` — extracted Dinner grouping (new, pure)

- The realized-vs-Planned split, the group-by-date into Dinners, and the
  "Today / Tomorrow / Yesterday / Fri, May 16" date label — logic currently
  private inside `app/log/log-screen.tsx` (`groupByDate`, `formatDinnerDate`,
  the `eatenOn > today` filter) — is extracted into a pure module with no
  React or DB dependency.
- The Log screen is refactored to consume the extracted module; its rendered
  behavior is unchanged. The detail page's History section consumes the same
  module over this Option's Log entries only.
- Extracting before reuse means the Log screen's grouping behavior is pinned
  by tests before the refactor (see Testing Decisions).

### `db/queries.ts`

- A query (or small set of focused queries) returns, for one Option id: the
  Option row, its Tag names, all of its `dinner_log` entries (past, today, and
  future), and all of its `rejections` rows (newest `rejected_on` first, with
  reason). Unlike the Tonight queries this is not filtered to Active Options —
  the detail page must work for an Archived Option.
- Computing the Archived Option's per-Tag recency still needs the active
  Catalog and the active Options' non-future Log entries (the ranking inputs),
  so the page also loads those — the same inputs `getTonightData` assembles.
- A query returns the **Archived** Options (`active = false`), ordered by
  name, for the Catalog "Archived" disclosure.

### Server actions and revalidation

- The only genuinely new action is `unarchiveOption(optionId)` in
  `app/catalog/actions.ts` — `authedAction`-wrapped, sets `active = true`,
  revalidates. It mirrors the existing `archiveOption`.
- Every other control reuses an existing action: `pickTonight`,
  `rejectOption`, `bringBackRejection`, the Option create/update behind
  `OptionForm`, `archiveOption`, `deleteOption`, `updateLogEntry`,
  `deleteLogEntry`.
- The actions' `revalidatePath` calls are extended so a change made on the
  detail page also revalidates `/catalog/[id]` (and the existing `/`,
  `/catalog`, `/log` targets are kept). A control behaves identically wherever
  it is invoked (ADR-0007).
- `deleteOption` already returns a typed result (it fails for an Option with
  Log entries — the Hard-delete rule, ADR-0001). On the detail page a
  successful Delete navigates the client to `/catalog`; a failed Delete shows
  the existing inline error and the page stays.

### The detail screen and reused components

- The detail screen composes the page from sections: identity / fields, the
  Restaurant block (rendered only for `kind = 'restaurant'`), the ranking
  block (Score + recency line + Tag chips), the controls, the History section,
  and the Rejections section.
- It reuses existing components rather than re-implementing them:
  - `OptionForm` (already reusable) for inline Edit.
  - `RowChips` / `RecencyChip` / `TagChip` (already exported from
    `app/tonight-row.tsx`) for the recency line and Tag heatmap chips.
  - The Log entry row + inline edit form — currently private in
    `app/log/log-screen.tsx` as `EntryRow` / `EntryEditForm` — extracted into
    their own file so both the Log screen and the detail page's History
    section render them.
- Destructive actions use the established §17 inline-confirm pattern
  ("Delete · Cancel"), consistent with the Catalog row and `DESIGN.md`.
- The Rejections section is display + Bring back only: a Rejection's only
  sensible control is Bring back, and only while it is today's.

### Link wiring

- The Option name becomes a `next/link` to `/catalog/[id]` in `option-row.tsx`
  (Catalog), `tonight-row.tsx` (Tonight), and the extracted Log entry row
  (Log). The link is styled so it is not mistaken for the row's Pick / Reject
  / Edit controls sitting beside it.

### Catalog "Archived" disclosure

- `app/catalog/catalog-screen.tsx` gains a collapsed "Archived" disclosure
  pinned at the bottom, after the Home meals and Restaurants sections — the
  same disclosure pattern as Tonight's "Rejected tonight". Expanded, it lists
  Archived Options as links to their detail pages. The active Catalog list is
  unchanged.

## Testing Decisions

A good test exercises a module's **external behavior** through its public
interface — given these inputs, expect this output — and never asserts on
internal structure, so it survives a refactor. Framework: **Vitest**, as
across the existing suites.

**Tested module 1 — `lib/ranking.ts`'s new `rankOption` (extend
`lib/ranking.test.ts`).**

- An active Option's `rankOption` result equals that Option's row in
  `rankTonight` over the same inputs — Score, per-Option recency, never-eaten
  flag, and per-Tag chips all agree.
- An Archived Option returns `score: null`, while its per-Option recency and
  per-Tag recency chips are still computed.
- A never-eaten Option reports the never-eaten flag and the `CAP` recency.
- per-Tag recency counts only active carriers of a Tag — an Archived Option's
  own Log entries do not move its Tag chips.

**Tested module 2 — `lib/dinner-grouping.ts` (new `lib/dinner-grouping.test.ts`).**

- The realized / Planned split is exact at the today boundary — an entry dated
  today is realized, an entry dated tomorrow is Planned.
- Entries on the same date group into one Dinner; the group order follows the
  newest-first input order.
- The date label resolves "Today" / "Tomorrow" / "Yesterday" and falls back to
  the weekday-month-day form otherwise.
- Because the Log screen is refactored onto this module, these tests pin the
  grouping behavior the Log screen relies on.

**Not tested.** The server action `unarchiveOption` gets no dedicated test —
it is a thin `authedAction` DB write, consistent with the `ai-search` and
`rejections` PRDs' calls on their thin actions. No screen-level test is added
for the detail page; reused components keep their current (un)tested status.

Prior art: `lib/ranking.test.ts` already exercises `rankTonight` with
hand-built fixtures and is extended in place. `lib/tonight-filter.test.ts` and
`lib/tonights-dinner.test.ts` are the model for the new
`lib/dinner-grouping.test.ts` — Vitest, pure functions, hand-built fixtures.

One hand-verified browser smoke check confirms the detail page renders and its
controls work for an active Option, an Archived Option, and a Deleted-id 404,
consistent with v1's "no browser E2E" testing posture.

## Out of Scope

- Any change to the ranking math, the Score formula, or `lib/ranking.ts`'s
  existing functions — `rankOption` is an addition that reuses them; ADR-0003
  holds.
- Adding Pick controls to the Log and Catalog rows — already delivered on
  `ralph-4`. This PRD only adds the Option-name *link* to those rows.
- Surfacing Archived Options on Tonight or in the AI search candidate set — an
  Archived Option remains excluded from ranking; only its detail page and the
  Catalog disclosure are in scope.
- A Rejection-history management UI beyond listing — no editing a Rejection's
  reason, no bulk pruning. Bring back (today's only) is the sole mutation; the
  detail page only *lists* settled Rejections.
- Editing a Log entry's Option to a *different* Option from the detail page is
  supported only insofar as the reused Log edit form already allows it; no
  new constraint is added for the per-Option context.
- Per-person attribution of who Picked, Rejected, or Archived — the app is
  single-Household with no per-person identity (`CONTEXT.md`).
- A degraded "no ranking data" visual treatment beyond the "Archived — not
  ranked" Score label and the otherwise-normal render.
- Showing a Score for an Archived Option — it is excluded from ranking by
  definition.

## Further Notes

- ADR-0007 and the **Option detail page** glossary term were written in the
  grill session that produced this PRD; no further doc change is needed.
- This builds on `ralph-4`, which already carries Pick on the Log and Catalog
  rows (`9f3b3d5`), `lib/rejections.ts`, and the Rejections feature. The detail
  page reuses `lib/rejections.ts`'s today-vs-earlier partition to decide which
  Rejections carry Bring back, rather than re-deriving the today boundary.
- The detail page is the first screen to display the **Score** as a number to
  the Household — Tonight uses Score only to sort. The rounding and the
  point-in-time caption (user story 16) exist because a bare Score on a
  single-Option page has no visible comparative reference.
- Extracting `EntryRow` / `EntryEditForm` out of `log-screen.tsx` and the
  grouping logic into `lib/dinner-grouping.ts` are refactors of working code;
  the Log screen's behavior must be unchanged after them.
