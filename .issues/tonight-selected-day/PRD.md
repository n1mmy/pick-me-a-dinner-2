# PRD: Tonight ranks a Selected day, not only today

Status: ready-for-agent

Vocabulary: [`CONTEXT.md`](../../CONTEXT.md) — the **Selected day**,
**Tonight**, **Pick**, **Tonight's dinner**, **Planned dinner**, **Score**,
**Recency**, **Recency chip**, **Rejection**, **Planned rejection**, **Bring
back**, **AI search**, **Option**, **Catalog**, **Log entry**, and
**Household** terms govern this PRD. Decision:
[`docs/adr/0009-tonight-ranks-a-selected-day.md`](../../docs/adr/0009-tonight-ranks-a-selected-day.md)
— Tonight ranks for a Selected day that defaults to today and can be stepped
forward to any future date. The deterministic ranking (ADR-0003), the AI
snapshot (ADR-0005), and the date-driven Rejection suppression (ADR-0008)
are all rotated to the Selected day rather than rebuilt; ADR-0007's
"controls live where the item is shown" justifies one screen with a date
stepper over a second "plan a future dinner" screen.

---

## Problem Statement

The **Tonight** screen ranks the **Catalog** for *today*. The Household can
already add a **Planned dinner** by hand from the **Log** screen — picking
an **Option** and giving it a future date — but that workflow is a flat
date-and-pick form: it gives no ranked **Score**, no **AI search**, no
**Recency** chips for the target day, and no awareness of any other Planned
dinner already on the books between now and then. When the Household wants
to decide what to eat on Friday — not tonight — they have all the data the
deterministic engine and AI search need to help, and no way to see it
applied to Friday.

## Solution

Add a **Selected day** anchor to the Tonight screen. The Selected day
defaults to today; a `‹ day ›` stepper at the top of Tonight steps it
forward one day at a time (and back to today), and a native date picker
jumps to any future date. Past dates remain off-limits and stay a Log-screen
backfill job. The whole Tonight screen re-points: the deterministic ranked
list ranks for the Selected day, AI search treats the Selected day as the
target, the decided **Dinner** block shows that day's Planned dinners with
day-aware copy ("Friday's dinner"), and the live Reject control with its
"Bring back" disclosure dates the **Rejection** to the Selected day. A Pick
on a future Selected day creates a Planned dinner for that day, satisfying
the "I want to plan Friday" need without leaving Tonight. The Selected day
lives in the URL (`?day=YYYY-MM-DD`), so refresh, link-sharing, and
back/forward navigation preserve it. There is no schema change.

## User Stories

### Choosing the Selected day

1. As a member of the Household, I want a `‹ day ›` stepper at the top of
   Tonight, so that I can move the Selected day forward and back from the
   same screen I already use to pick dinner.
2. As a member of the Household, I want tapping the forward arrow to step
   the Selected day by one calendar day, so that picking for tomorrow or
   the next day is one tap.
3. As a member of the Household, I want tapping the back arrow when the
   Selected day is in the future to step it back toward today, so that I
   can undo a forward step without re-loading the page.
4. As a member of the Household, I want the back arrow disabled (or absent)
   when the Selected day is today, so that I can never step into the past.
5. As a member of the Household, I want a native date picker beside the
   stepper, so that I can jump to a specific date — next Saturday — without
   tapping the forward arrow several times.
6. As a member of the Household, I want the native date picker's `min` set
   to today, so that the operating system disables past dates and I never
   pick one by mistake.
7. As a member of the Household, I want the Selected day in the URL as
   `?day=YYYY-MM-DD`, so that a refresh preserves the day I was looking at.
8. As a member of the Household, I want to share a link to Tonight that
   carries the Selected day, so that my partner opens the same day's
   ranking on their phone.
9. As a member of the Household, I want the browser's back button to
   restore the previous Selected day, so that exploring different days is
   reversible without thinking about state.
10. As a member of the Household, I want a missing, malformed, or past
    `?day=` to fall back to today, so that a bad link never errors and
    never lands me in a meaningless past view.

### What the screen says

11. As a member of the Household, I want the page H1 to say "Tonight" when
    the Selected day is today, so that the common case reads the way it
    always has.
12. As a member of the Household, I want the H1 to show the day's name
    (e.g. "Friday") when the Selected day is a future date, so that I can
    see at a glance which day I am picking for.
13. As a member of the Household, I want the bottom-nav / left-rail
    "Tonight" label unchanged, so that navigation stays stable regardless
    of which day I happen to be looking at.
14. As a member of the Household, I want the decided **Dinner** block to
    use day-aware copy when the Selected day is not today (e.g. "Friday's
    dinner"), so that I never confuse a future plan with what was eaten
    tonight.
15. As a member of the Household, I want the "Rejected tonight" disclosure
    to read "Rejected for [day]" when the Selected day is not today, so
    that the panel's label matches what is in it.

### Ranking for the Selected day

16. As a member of the Household, I want the ranked list to compute Score
    against the Selected day, so that Tonight tells me what fits Friday
    when I am picking for Friday.
17. As a member of the Household, I want a Planned dinner sitting between
    today and the Selected day to count toward the Selected day's
    **Recency**, so that a week of planning does not double up the same
    Option twice in a row.
18. As a member of the Household, I want the Score's tie-break (alphabetical),
    its 60-day cap, and the cold-start fallback to behave exactly as they
    do for today, so that the only thing changing is the anchor day.
19. As a member of the Household, I want each row's **Recency chip** to
    read as of the Selected day ("18d" / "60d+" / "new"), so that the chip
    matches the Score it sits beside.
20. As a member of the Household, I want each row's per-Tag chips to read
    as of the Selected day, so that the variety side of the Score matches
    the day I am picking for.
21. As a member of the Household, I want an Option that is **Archived** to
    remain absent from the ranked list regardless of the Selected day, so
    that the Selected day is not a back door to ranking Archived Options.

### Picking for the Selected day

22. As a member of the Household, I want the on-row Pick button to write a
    Log entry dated the Selected day, so that picking is one tap whether
    the day is today or Friday.
23. As a member of the Household, I want a Pick on today to be **Tonight's
    dinner** as it always has been, so that the common case is unchanged.
24. As a member of the Household, I want a Pick on a future Selected day to
    create a **Planned dinner** dated that day, so that planning Friday
    from Tonight is identical to logging Tonight's dinner.
25. As a member of the Household, I want a Picked future Selected day to
    surface that day's Planned dinners in the decided block immediately, so
    that I can see what I just chose and either add another Option or remove
    it.
26. As a member of the Household, I want "Add another option" to still
    work when the Selected day is in the future, so that a multi-Option
    dinner (takeout plus a side) can be planned the same way it is decided
    tonight.
27. As a member of the Household, I want Remove on a Planned dinner from
    the decided block to behave the same as Remove on Tonight's dinner, so
    that undoing a future Pick is the inline-confirm flow I already know.
28. As a member of the Household, I want the same `UNIQUE(option_id,
    eaten_on)` collision to be reported inline when I try to Pick an Option
    twice for the Selected day, so that duplicate-Pick handling is
    consistent.

### Rejecting for the Selected day

29. As a member of the Household, I want the live Reject control on each
    Tonight row to date its Rejection to the Selected day, so that
    pre-emptively turning down an Option for Friday is one tap.
30. As a member of the Household, I want an Option I Reject for Friday to
    disappear from the ranked list when the Selected day is Friday and
    return when it is today (or any other day), so that suppression rotates
    with the day.
31. As a member of the Household, I want "Rejected for [day]" to disclose
    the Rejections for the Selected day with **Bring back** as their
    quick-undo, so that I can reverse a Friday Reject from Friday.
32. As a member of the Household, I want a Planned rejection entered from
    the Log screen to suppress its Option on Tonight when the Selected day
    matches its date, so that Rejections from the Log and from Tonight
    converge on one date-driven suppression rule.
33. As a member of the Household, I want a Reject for the Selected day to
    be capped by `UNIQUE(option_id, rejected_on)` the same way it is today,
    so that duplicate-Reject handling is consistent.

### AI search for the Selected day

34. As a member of the Household, I want AI search triggered from Tonight
    to treat the Selected day as the target day, so that the model can
    apply day-of-week patterns to Friday when I am picking Friday.
35. As a member of the Household, I want the AI search prompt to still
    carry the full dated history — including Planned dinners and
    Planned rejections dated after the Selected day — so that picking for
    Friday with Sunday's pizza on the books does not blind the model to
    Sunday.
36. As a member of the Household, I want an Option I have Rejected for the
    Selected day excluded from the AI search candidate set, so that the
    today-rejected suppression rotates with the day.
37. As a member of the Household, I want AI search to fall back to its
    one-line "unavailable" outcome on failure regardless of the Selected
    day, so that the Selected day never breaks the deterministic floor.

### Accessibility

38. As a member of the Household using a keyboard, I want the stepper's
    prev/next controls and the date picker focusable in tab order, so that
    moving the Selected day works without a mouse.
39. As a member of the Household using assistive tech, I want the stepper's
    controls labelled (e.g. "Previous day", "Next day") and the current
    Selected day announced via the H1, so that the date in view is clear
    without sight.
40. As a member of the Household, I want the disabled-back-arrow state
    (Selected day = today) conveyed via `disabled` so that screen readers
    and keyboard navigation both reflect it.

### Mobile

41. As a member of the Household on a phone, I want the stepper arrows
    sized as adequate touch targets, so that I can step days while
    standing in the kitchen.
42. As a member of the Household on a phone, I want the native date input
    to open the OS date picker, so that jumping to a date uses the picker
    I already know.

### Backward compatibility

43. As a member of the Household, I want a request to `/` with no `?day=`
    to render exactly the Tonight I see today, so that nothing changes for
    the common case and no link I bookmarked breaks.
44. As a member of the Household, I want a `?day=` set to today (the same
    SQL date that `today()` returns) to render exactly the same screen as
    omitting it, so that the URL is honest and not load-bearing for the
    today case.

## Implementation Decisions

### New deep module — Selected-day URL parser

A new pure function in `lib/local-day.ts` parses the `?day=` query
parameter into a SQL date. Single responsibility: given the raw URL value
and today, return a valid SQL date that is ≥ today. Behaviour:

- Missing, empty, or non-string → today.
- Malformed (`isValidSqlDate` rejects it, e.g. `2026-13-01`, `2026-02-30`,
  `not-a-date`) → today.
- Valid SQL date in the past → today.
- Valid SQL date today or in the future → the parsed date.

This function is the boundary normalizer for everything downstream. It
lives in `local-day` because that module is already the single home for
day-resolution concerns; no second date module is created.

### Rename `today` → `asOf` in the ranking-side library

Every library function whose `today` parameter actually means "the anchor
day to rank against" is renamed to `asOf` (or `selectedDay` where the call
site reads more naturally that way — to be settled by the implementer
consistently). The math is unchanged because `lib/ranking.ts` was already
date-pure (`rankTonight`'s `lastEaten` and `lastTagUse` filter
`entry.eatenOn > today`, and `daysSince(day, today)` is `today - day`).
Doc comments referencing "today" in a parameter-meaning sense are updated.

Affected library modules:

- `lib/ranking.ts` — `rankTonight`, `rankOption`, `lastEaten`,
  `lastTagUse`, `daysSince`.
- `lib/tonights-dinner.ts` — its derivation of the decided block content.
- `lib/rejections.ts` — its today / not-today split.
- `lib/ai-search.ts` — `buildSnapshot({ today: ... })` becomes
  `buildSnapshot({ asOf: ... })`. The JSON field sent to the model keeps
  its name (`today`) so the model continues to read it as "today is
  YYYY-MM-DD" — that is the model's frame, not ours. (Alternatively rename
  the model-facing field to `forDate` or `targetDate`; the implementer may
  prefer that for clarity. The PRD does not mandate the on-wire name —
  only that the Selected day is what is communicated.)

### `lib/ai-search.ts` snapshot rotates with the Selected day (ADR-0009)

`buildSnapshot` rotates its anchor:

- Its anchor day input is the Selected day.
- The candidate-drop rule (Options Rejected for the *anchor* day are
  dropped from the candidate set) keys on the Selected day.
- The Rejections split (anchor-day group vs not-anchor-day group) keys on
  the Selected day.
- The Log block and the not-anchor-day Rejections still carry rows dated
  after the Selected day — ADR-0005's "the snapshot sees the future"
  principle holds, just rotated.

### `app/page.tsx` reads `?day=` and threads it through

The Tonight server page reads `searchParams.day`, passes it through
`parseSelectedDay(rawParam, today())`, and threads the resulting Selected
day into `rankTonight`, `lib/tonights-dinner`, the rejections query, and
the AI-search action. The page never assumes "today" downstream; every
date-aware call gets the Selected day.

### `DayStepper` client component

A new client component renders the stepper at the top of Tonight:

- `‹` previous-day button — disabled when the Selected day is today.
- The current Selected day's label (read from the H1, not duplicated).
- `›` next-day button — always enabled.
- A native `<input type="date">` with `min` set to today's SQL date and no
  max, for jumping.

Selecting any control calls `router.replace(?day=YYYY-MM-DD)` so the URL
becomes the source of truth and the server re-renders. The stepper does
not maintain its own local "Selected day" state.

### `app/tonight-screen.tsx` becomes day-aware

The Tonight screen receives the Selected day as a prop and:

- Renders the `DayStepper` at the top.
- Shows the day's name in the H1 when the Selected day is not today;
  shows "Tonight" otherwise.
- Threads the Selected day into the decided block, the AI search box, the
  ranked rows, and the "Rejected" disclosure.
- Day-aware copy for the decided block heading ("Friday's dinner") and the
  rejected disclosure label ("Rejected for Friday").

### Server actions accept the Selected day

`app/tonight-actions.ts`'s Pick and Reject actions take the Selected day as
input and date the row to it:

- A Pick action writes `eaten_on = selectedDay`.
- A Reject action writes `rejected_on = selectedDay`.
- Both actions validate `selectedDay >= today()` server-side, mirroring the
  page-level clamp; a request with a past date is rejected with the same
  shape of inline error already used for invalid dates.

The `app/log` server actions (add / edit Log entry, add / edit Rejection)
are untouched: the Log screen continues to manage dated history with its
own date input, including the past.

### No schema change

`dinner_log.eaten_on` and `rejections.rejected_on` are already dated
columns, the `UNIQUE` indexes on `(option_id, eaten_on)` and `(option_id,
rejected_on)` already enforce the per-day collision rule, and the ranking
engine is already date-pure. The work is at the page, action, library,
and UI layers only; drizzle stays at `0003`.

## Testing Decisions

A good test exercises a module's **external behavior** through its public
interface — given these inputs, expect this output — and never asserts on
internal structure, so it survives a refactor. Framework: **Vitest** with
React Testing Library, as in the existing suites. No live Anthropic call
is made in any test.

**Tested module — `parseSelectedDay` (pure unit tests).** New deep module
on the URL boundary. Cases:

- Missing / empty / non-string → today.
- Malformed strings (`""`, `"not-a-date"`, `"2026-13-01"`, `"2026-02-30"`)
  → today.
- A valid SQL date in the past → today.
- A valid SQL date today → today.
- A valid SQL date in the future → that date.

Prior art: `lib/local-day.test.ts`.

**Tested module — `rankTonight` (extend existing tests).** Add cases:

- A Planned dinner dated between today and the anchor day shifts the
  anchor day's Recency on the affected Option and any Option sharing a Tag
  with it (locks ADR-0009's load-bearing rule).
- A Log entry dated after the anchor day is excluded from that day's
  ranking (the same `eatenOn > anchor` filter that today's logic enforces).
- The 60-day cap and alphabetical tie-break behave identically for an
  anchor day that is today and one that is in the future.

Prior art: `lib/ranking.test.ts`.

**Tested module — `buildSnapshot` (extend existing tests).** Add one case
with the anchor day in the future:

- The snapshot's anchor-day field (whatever name it carries on the wire)
  reflects the Selected day.
- The candidate-drop rule keys on Selected-day Rejections, not on today's.
- The Log block continues to include entries dated after the Selected day
  (ADR-0005 preservation).
- The Rejections split puts Selected-day Rejections in the anchor-day
  group and all other dated Rejections — past *and* dated > Selected day —
  in the not-anchor-day group.

Prior art: `lib/ai-search.test.ts`.

**Tested module — `tonightsDinner` derivation (extend existing tests).**
Add a case where the anchor day is in the future: the derivation returns
that day's Planned dinners as the decided block content, with the same
shape it returns for today.

Prior art: `lib/tonights-dinner.test.ts`.

**Tested module — Pick + Reject server actions (extend existing DB
tests).** Add cases:

- A Pick with a future Selected day writes `eaten_on = selectedDay` and
  reports the same inline collision error if the row already exists.
- A Reject with a future Selected day writes `rejected_on = selectedDay`
  and reports the same inline collision error.
- A Pick or Reject with `selectedDay < today` is rejected with the
  invalid-date inline error.

Prior art: `app/tonight-actions.test.ts`, `app/log/actions.db.test.ts`.

**Not tested.** The `DayStepper` is a thin wrapper over a native `<input
type="date">` and two buttons that call `router.replace`; the empty-`?day=`
fallback, the URL round-trip, the H1 copy, and the day-aware decided-block
copy are simple enough to verify by hand and consistent with the house
posture set by the `option-typeahead` PRD ("UI components get no dedicated
tests"). `app/page.tsx`'s search-params plumbing is also out of scope —
the `parseSelectedDay` unit tests cover the only branch with meaningful
logic.

## Out of Scope

- **Past dates as the Selected day.** Backfilling a forgotten dinner stays
  a Log job; the Selected day is a "what should we eat" anchor only. The
  stepper's `min` is today.
- **A separate "Plan a future dinner" screen.** Rejected in ADR-0009 in
  favour of one Tonight screen with a Selected day. The Log screen's
  existing "add a Planned dinner" form stays — it is a different control
  for a different need (committing a known Option to a date without
  consulting the ranking).
- **Recurring Planned dinners or Planned rejections.** A Planned rejection
  remains a single date (ADR-0008); a recurring plan is not added.
- **A multi-day calendar view.** The Selected day is one day at a time.
- **Renaming the navigation entry away from "Tonight".** The nav label
  stays "Tonight" regardless of the Selected day (ADR-0009).
- **Any schema, migration, or `UNIQUE` constraint change.** The schema
  already supports the feature.
- **Changes to the Log screen's add-a-dinner / add-a-rejection forms.**
  The Log continues to manage dated history with its own controls; only
  the Tonight screen gains the Selected day.
- **Reading the Selected day from session or cookie state.** The URL
  `?day=` is the source of truth (ADR-0009).
- **Showing a Tag's overdue accent colour against the Selected day** as a
  separate flag — overdue is already a function of per-Tag recency, which
  already rotates with the anchor day; no new logic is needed.

## Further Notes

- Files this PRD is expected to touch:
  - `lib/local-day.ts` — `parseSelectedDay` added.
  - `lib/ranking.ts` — parameter renames + doc comments; no math change.
  - `lib/tonights-dinner.ts` — parameter rename, day-aware return.
  - `lib/rejections.ts` — split keys on the Selected day.
  - `lib/ai-search.ts` — `buildSnapshot` anchor rotates, candidate-drop
    and split rules key on the Selected day.
  - `app/page.tsx` — reads `?day=`, threads the Selected day through.
  - `app/tonight-screen.tsx` — day-aware H1 and copy; `DayStepper` slotted
    in.
  - `app/day-stepper.tsx` — new component.
  - `app/tonights-dinner-block.tsx` — day-aware heading copy.
  - `app/tonight-actions.ts` — Pick and Reject accept the Selected day,
    validate `>= today`.
  - The test files alongside each library and action module.
- The implementer chooses the on-wire JSON field name in the AI snapshot
  (keep `today` so the model's frame is unchanged, or rename to `forDate`
  / `targetDate` for clarity). Either is acceptable as long as the
  semantics — "the day the model is ranking for" — are clearly the
  Selected day.
- `DESIGN.md` governs the stepper's visual treatment; the PRD specifies
  behaviour and structure only.
- `CONTEXT.md` has already been amended to add the Selected day term and
  reflect the new Tonight, Pick, Tonight's dinner, and Rejection
  definitions (see the relevant entries). ADR-0009 captures the
  load-bearing decisions.
- This PRD assumes ADR-0009 is the operative architectural reference; no
  new ADR is required.
