# PRD: Closed days

Status: ready-for-agent

Vocabulary: [`CONTEXT.md`](../../CONTEXT.md) — the **Closed day**, **Closed
disclosure**, **Rejection**, **Planned rejection**, **Selected day**, and
**Restaurant** terms govern this PRD. Decision:
[`docs/adr/0010-closed-days-are-a-restaurant-property.md`](../../docs/adr/0010-closed-days-are-a-restaurant-property.md)
— a recurring closure is a property of the Restaurant, not a recurring
Rejection. Amends
[`docs/adr/0008-rejections-managed-dated-history.md`](../../docs/adr/0008-rejections-managed-dated-history.md)
(which left recurring closures to model inference) and
[`docs/adr/0006-rejections-feed-ai-search.md`](../../docs/adr/0006-rejections-feed-ai-search.md)
(whose `"closed on Sundays"` example this replaces); respects
[`docs/adr/0003-ranking-in-typescript.md`](../../docs/adr/0003-ranking-in-typescript.md)
(the deterministic ranking is untouched),
[`docs/adr/0005-ai-search-reasons-about-habits.md`](../../docs/adr/0005-ai-search-reasons-about-habits.md)
(no pre-computed recency in the snapshot),
[`docs/adr/0007-expose-every-sensible-control.md`](../../docs/adr/0007-expose-every-sensible-control.md)
(every control wherever it makes sense), and
[`docs/adr/0009-tonight-ranks-a-selected-day.md`](../../docs/adr/0009-tonight-ranks-a-selected-day.md)
(everything anchors on the Selected day). Visual spec: `DESIGN.md` —
"Closed disclosure (2026-09-19)" and "Closed-day toggles (2026-09-19
exception to control height)".

---

## Problem Statement

The Household is regularly offered Restaurants that are shut on the day they
are deciding for. It happens on both paths, for different reasons:

- **The deterministic ranking** has never known about closures and never will
  by design — `lib/ranking.ts` sees Options, Tags, and Log entries, nothing
  else. A Restaurant closed Mondays ranks on Monday exactly as it ranks on
  Tuesday.
- **AI search** was *supposed* to cover this. ADR-0006 stored Rejections as raw
  dated history and left the model to work out which were standing; its worked
  example, carried verbatim into the live system prompt, is `"closed on
  Sundays"`. ADR-0008 then declined recurring Planned rejections specifically
  because inference was expected to handle it. In practice the model still
  ranks shut Restaurants.

Inference cannot close this gap, and not because the model is weak. It only
ever sees closures the Household happened to type into a Rejection reason — a
Restaurant nobody bothered to reject on a Sunday is indistinguishable, in the
data, from one that opens on Sundays. And a closure is not a decision at all: a
**Rejection** is the Household's judgement about one night, whereas being shut
on Mondays is true whether or not anyone considered the Restaurant. Flat
Rejection history was being asked to carry a fact about the restaurant's
trading week.

## Solution

A **Restaurant** gains **Closed days**: the set of weekdays it is shut,
maintained by hand on the Restaurant form. Empty — the default and the state of
every existing row — means open all week, so the feature costs nothing until
the Household fills it in.

On a day a Restaurant is closed, it leaves Tonight's ranked list and AI
search's candidate set, exactly as a same-day **Rejection** does. Both are
presentation filters; neither touches a Score.

Suppressed Restaurants are not hidden. They collect in a **Closed
disclosure** at the foot of Tonight, below the Rejected one, carrying the full
picker-row controls — so the Household can Pick one that turns out to be open
after all, or Reject it with a reason recording what was learned. A closure is
the app's best information, not a veto.

AI search additionally receives each candidate's Closed days as weekday names,
so the model can read a structurally thin history as "shut two days a week"
rather than as an Option drifting out of rotation.

## User Stories

### Recording Closed days

1. As a member of the Household, I want to record which weekdays a Restaurant
   is closed, so that the app stops offering it on those days.
2. As a member of the Household, I want the Closed-days control to show a whole
   week at once, so that I can see and set the pattern at a glance.
3. As a member of the Household, I want a Restaurant with no Closed days
   recorded to behave exactly as it does today, so that adding the feature does
   not disturb my existing Catalog.
4. As a member of the Household, I want to edit a Restaurant's Closed days from
   its Option detail page as well as the Catalog, so that I can fix them where
   I noticed the problem.
5. As a member of the Household, I want Closed days shown on the Option detail
   page, so that I can check what the app believes about a Restaurant.
6. As a member of the Household, I want no Closed-days control on a Home meal,
   so that the form only asks what makes sense.

### Tonight

7. As a member of the Household, I want a Restaurant closed on the Selected day
   left out of Tonight's ranked list, so that I am only shown places I can
   actually eat at.
8. As a member of the Household, I want the closed Restaurants collected in a
   collapsed disclosure at the foot of Tonight, so that nothing vanishes
   silently and I can see what was withheld.
9. As a member of the Household, I want the Closed disclosure's heading to name
   the day it applies to, so that it reads correctly when I have stepped
   Tonight to another date.
10. As a member of the Household, I want rows in the Closed disclosure to carry
    the same controls as a picker row, so that I can Pick a Restaurant that is
    open after all.
11. As a member of the Household, I want to Reject a closed Restaurant with a
    reason, so that I can record what I learned about that night even though it
    was shut.
12. As a member of the Household, I want a Restaurant I reject from the Closed
    disclosure to move to the Rejected disclosure, so that I can see my tap
    registered and undo it.
13. As a member of the Household, I want the Closed disclosure ordered
    alphabetically with no rank number, so that it does not read as a second
    ranking.
14. As a member of the Household, I want closure suppression to follow the
    Selected day's weekday whether I step forward or back, so that there is one
    rule to understand.
15. As a member of the Household, I want a Restaurant I Pick despite a closure
    to appear in the decided block unremarked, so that the app does not argue
    with a decision I have made.
16. As a member of the Household, I want an honest message when the picker is
    emptied by rejections or closures rather than by an empty Catalog, so that
    I know why there is nothing to choose from.

### AI search

17. As a member of the Household, I want AI search never to return a Restaurant
    closed on the Selected day, so that both paths agree.
18. As a member of the Household, I want the model told which days each
    candidate is closed, so that it does not mistake a structurally thin
    history for an Option we have gone off.
19. As a member of the Household, I want a closed Restaurant's eating history
    still visible to the model, so that dropping it as a candidate does not
    distort the patterns it reads.

### Cross-cutting

20. As a member of the Household, I want Closed days to work with AI search
    unconfigured, so that a deployment with no API key still stops suggesting
    shut Restaurants.
21. As a member of the Household using a keyboard, I want every Closed-day
    toggle and the Closed disclosure reachable with visible focus, so that the
    feature is fully operable without a mouse.
22. As a member of the Household using assistive tech, I want each Closed-day
    toggle's day and state announced, so that the control is usable without
    sight.

## Implementation Decisions

### Schema

- A `closed_days` column on `options`, a Postgres `integer[]`, not null,
  default `'{}'`. Values are `0`–`6` with **`0` = Sunday**, matching the
  `WEEKDAYS` table in `lib/snapshot-format.ts` — the number that decides
  suppression and the number that names the weekday must be the same number.
- Restaurant-only in the same sense as `address` / `phone` / `lat`: the column
  exists on the unified table (ADR-0001) and stays empty for a Home meal. The
  Home-meal form never writes it.
- An empty array is the default and the meaning is "open all week". No
  validation forbids all seven days — **Archive** already exists for a
  Restaurant that has gone for good, and a seven-day closure is a legitimate way
  to park one temporarily.
- One new out-of-band Drizzle migration. Adding a defaulted, not-null column is
  safe against existing rows; the startup schema check counts journal entries
  and needs no change.

### A shared weekday helper

`lib/snapshot-format.ts` currently derives a weekday inline. Extract
`weekdayFromSqlDate(sqlDate): number` into `lib/local-day.ts` — the module that
already owns every SQL-date-to-number conversion — and have both
`formatDateWithWeekday` and the new suppression filter call it. Two independent
weekday derivations is exactly how an off-by-one enters.

### Suppression is a presentation filter (ADR-0003, ADR-0010)

- `lib/ranking.ts` does not change. `RankOption` gains **no** `closedDays`
  field, `rankTonight` never sees one, and no Score, affinity, readiness, or
  recency value moves because a Restaurant is shut.
- `getTonightData` returns `closedDays` on each `TonightOption`. That value
  reaches `rankTonight` only incidentally — `TonightOption` is already wider
  than `RankOption` (it carries `notes`), and TypeScript's excess-property check
  does not apply to a passed variable — so the ranking stays structurally blind.
- `app/page.tsx` computes the closed set from the Selected day's weekday and
  partitions `picker` into the visible rows and the closed rows, applied
  *after* `rankTonight` and alongside the existing Rejection filter. The closed
  rows are sorted alphabetically by Option name for the disclosure.
- Ordering matters: a Restaurant both closed and rejected on the Selected day
  belongs in the **Rejected** disclosure, not both. Apply the Rejection filter
  first and take the closed set from what remains.
- The rule is uniform across past, present, and future Selected days.

### The empty-picker message

The existing `allRejected` flag distinguishes "the list was filtered to
nothing" from "the Catalog is empty". Generalize it — one flag covering both
causes, with copy that does not claim you rejected something you never touched
— rather than growing a three-way matrix. The distinction from an empty Catalog
is kept; the distinction between the two filter causes is deliberately not
drawn (it is rare, and both disclosures are visible directly below).

### The Closed disclosure

- A sibling of `RejectedTonightDisclosure` in `app/tonight-screen.tsx`,
  rendered below it, collapsed by default, heading `Closed tonight (N)` /
  `Closed on Friday (N)` from the same `dayLabel` helper.
- Rows are `TonightRowItem` — the same component, so Pick, Reject-with-reason,
  the chip row, and the Last note all come along unchanged. `rank` becomes
  optional on that component; when absent the `w-6` gutter still renders (empty)
  so names stay on the picker's vertical.
- No per-row closure label. `DESIGN.md` carries the full reasoning.
- Rejecting a row writes an ordinary Rejection dated the Selected day, so
  revalidation moves it into the Rejected disclosure with no special handling.

### AI search (extends ADR-0005, amends ADR-0006)

- `SnapshotOption` and `SnapshotModelOption` gain `closedDays`. On the wire it
  is **weekday names** — `["Sunday", "Monday"]` — matching the snapshot's
  existing human-readable dates; the key is **omitted entirely** when the
  Restaurant has none, so an always-open Restaurant and every Home meal cost
  nothing. Closed days are app-derived structure, not Household-authored text,
  so they are **not** `<household-text>`-delimited.
- `buildSnapshot` drops Restaurants closed on `asOf` from the candidate
  `options` and from `idByIndex`, exactly as it drops anchor-day-rejected ones
  — so the parser cannot resurface one. Numbering still covers the whole
  Catalog, so a closed Restaurant keeps a stable number for its Log and
  Rejection rows and its eating history still reads as history (story 19).
- `app/tonight-actions.ts` passes `closedDays` through in its `options.map`.
- The system prompt gains a short paragraph: Closed days are a fact about the
  restaurant; candidates shown are already open on today's date; use closures to
  **explain gaps in the history** rather than reading them as an Option drifting
  out of rotation. No "never recommend a closed Option" rule is added — the
  candidate drop already makes that impossible, and a rule against an impossible
  failure only competes for attention with the rules that work.
- ADR-0006's `"closed on Sundays"` example in the prompt's Rejections paragraph
  is replaced with a genuine one-off standing reason, since that illustration is
  now the wrong concept.

### UI

- The Restaurant branch of `OptionForm` gains a Closed-days field: seven toggle
  chips, `S M T W T F S`, per `DESIGN.md`'s documented sub-44px exception. Each
  toggle needs an accessible name carrying the full day and its state, and
  `aria-pressed`. `OptionFormValues` gains the field; `createOption` /
  `updateOption` validate to a deduped, sorted `0`–`6` set and write `'{}'`
  for a Home meal.
- Because `app/catalog/[id]/option-controls.tsx` reuses `OptionForm` inline,
  editing works on the Option detail page with no extra work (ADR-0007).
- The Option detail page displays the Closed days as a line in the Option's
  fields. Catalog list rows do **not** show them.

## Testing Decisions

A good test exercises a module's **external behavior** through its public
interface and never asserts on internal structure. Framework: **Vitest**, as
across the existing suites. No live Anthropic call in any test.

**Tested module 1 — `weekdayFromSqlDate` (`lib/local-day.test.ts`).** Sunday is
`0`; the mapping is exact across a month and year boundary and across a DST
transition; it agrees with `formatDateWithWeekday`'s output for the same date.

**Tested module 2 — the closed-set filter (a pure helper, fully unit-tested).**
Empty `closedDays` never suppresses; a matching weekday suppresses; a
non-matching one does not; all seven days suppresses every day; the rule is
identical for a past, present, and future Selected day. Keep the predicate pure
and out of the page component so this is directly testable.

**Tested module 3 — `buildSnapshot` (extend `lib/ai-search.test.ts`).** A
Restaurant closed on `asOf` is absent from candidate `options` and from
`idByIndex`, so `parseRankingText` drops its number; its Log rows still appear
with their stable snapshot number; a candidate's `closedDays` serializes as
weekday names; the key is absent for a Restaurant with none; a Restaurant both
closed and anchor-day-rejected is dropped once, with no duplicate or crash.

**Tested module 4 — the Catalog server actions (extend
`app/catalog/actions.db.test.ts`).** Closed days round-trip on create and
update; an out-of-range or duplicate value is normalized rather than stored; a
Home meal writes an empty set whatever the form sends.

**Not tested.** The disclosure component and the form control get no dedicated
tests, consistent with v1's no-browser-E2E posture — but the sub-44px toggle row
must be **hand-measured at 375px** before the issue is closed, and one
hand-verified smoke check confirms a closed Restaurant is absent from a live AI
search result.

## Out of Scope

- **Opening and closing times.** Weekday granularity only — the app decides one
  meal a day and has no business holding an opinion about when dinner is
  (ADR-0010).
- **Specific closed dates** — holidays, a private function, the August
  shutdown. A **Planned rejection** already owns the one-off known date; giving
  the same fact two homes would be worse than either.
- **Google Places autofill of Closed days.** Deliberately deferred — issue 05,
  `needs-triage`. The Catalog that hurts today is already saved, so those rows
  need hand entry regardless.
- **Any change to `lib/ranking.ts`, the Score, or recency.** ADR-0003 and
  ADR-0010 hold: suppression is a presentation filter.
- **A per-night "open today actually" override.** That is precisely the
  recurring-exception machinery ADR-0008 refused. The Closed disclosure's Pick
  covers the night; a wrong Closed day is fixed on the Restaurant.
- **Marking a Picked-anyway Restaurant in the decided block.** The decision has
  been made.
- **Closed days on a Home meal**, and **Closed days on Catalog list rows.**

## Further Notes

- `CONTEXT.md` carries the new **Closed day** and **Closed disclosure** terms
  and the amended **Rejection** / **Planned rejection** entries; `DESIGN.md`
  carries the disclosure spec and the toggle-row control-height exception; ADR-
  0010 records the decision. All three were written in the grill session that
  produced this PRD — no further doc change is needed.
- Files this PRD is expected to touch: `db/schema.ts`, `db/queries.ts`, a new
  Drizzle migration, `lib/local-day.ts`, `lib/snapshot-format.ts`,
  `lib/ai-search.ts`, `app/page.tsx`, `app/tonight-screen.tsx`,
  `app/tonight-row.tsx`, `app/tonight-actions.ts`, `app/catalog/actions.ts`,
  `app/catalog/option-form.tsx`, and `app/catalog/[id]/page.tsx`.
- The migration is applied out-of-band per the deploy model. It is safe against
  production data: the column is defaulted and not null, so every existing row
  gets the empty set and behaves exactly as before.
