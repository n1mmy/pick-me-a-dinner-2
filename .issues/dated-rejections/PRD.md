# PRD: Dated Rejections on the Log

Status: ready-for-agent

Vocabulary: [`CONTEXT.md`](../../CONTEXT.md) — the **Rejection**, **Planned
rejection**, **Planned dinner**, **Dinner**, and **Bring back** terms govern
this PRD. Decision:
[`docs/adr/0008-rejections-managed-dated-history.md`](../../docs/adr/0008-rejections-managed-dated-history.md)
— Rejections become manually creatable, editable, and freely dated; the AI
snapshot carries the future. Builds on
[`docs/adr/0006-rejections-feed-ai-search.md`](../../docs/adr/0006-rejections-feed-ai-search.md)
(Rejections stored flat as dated history) and
[`docs/adr/0005-ai-search-reasons-about-habits.md`](../../docs/adr/0005-ai-search-reasons-about-habits.md)
(the AI snapshot is raw dated history); respects
[`docs/adr/0003-ranking-in-typescript.md`](../../docs/adr/0003-ranking-in-typescript.md)
(the deterministic ranking is untouched) and
[`docs/adr/0007-expose-every-sensible-control.md`](../../docs/adr/0007-expose-every-sensible-control.md)
(every control wherever it makes sense).

---

## Problem Statement

A **Rejection** can only be created one way: live on a **Tonight** row, dated
today. That leaves three gaps for the Household.

- **No backfill.** When the Household passes on an Option on some night but
  never taps reject — they just don't pick it — that decision is lost. The AI
  never hears it, and there is no way to record it after the fact.
- **No pre-emptive skip.** The Household often knows in advance that an Option
  is a bad fit for a specific upcoming night ("Aji Ichi is closed this coming
  Sunday"). They cannot act on that knowledge — the Option will still appear on
  Tonight that day, to be reasoned about and dismissed all over again.
- **No management.** Once a day turns, a Rejection is frozen — only "Bring
  back" undoes one, and only today's. A Rejection with a wrong reason, a wrong
  date, or one that should never have been recorded cannot be corrected.

And the **Log** screen — the natural home for "what did we decide on each
night" — shows only what was *eaten*. A member looking at a past night sees the
Dinner but not what was turned down alongside it, and has no way, from there,
to backfill a Rejection they remember.

## Solution

The **Log** screen becomes the Household's full nightly record. Each date shows
its **Dinner** *and* that date's **Rejections**, interleaved.

From the Log, the Household can add a Rejection by hand for a deliberately
chosen date — a past date backfills a Rejection never recorded live; today's
date records one from the Log instead of from Tonight; a future date is a
**Planned rejection** that pre-emptively drops its Option off Tonight when that
day arrives. Every Rejection — however it was created, however old — is
editable and deletable inline on the Log and on the **Option detail page**.

The AI snapshot is fed the whole picture: every Rejection (backfilled and
pre-emptive included) and the full **Log** including **Planned dinners**. The
model is given today's date and tells plan from history itself.

The deterministic ranking is untouched. Suppression stays a presentation
filter, derived purely from a Rejection's date.

## User Stories

### Seeing the night's full record

1. As a member of the Household, I want each date on the Log to show what we
   ate and what we turned down together, so that I see a night's full decision
   in one place.
2. As a member of the Household, I want a date where we only rejected something
   and logged no Dinner to still appear as its own date-group, so that a
   Rejection-only night is not invisible.
3. As a member of the Household, I want Rejections to read as visually distinct
   from Log entries within a date-group, so that I can tell at a glance what
   was eaten from what was passed over.
4. As a member of the Household, I want a Rejection's reason shown on its row
   in the Log, so that I remember why we turned it down.
5. As a member of the Household, I want future-dated Rejections (Planned
   rejections) shown in the Log's "Upcoming" strip alongside Planned dinners,
   so that I can see what is coming.
6. As a member of the Household, I want the Log's date-groups to stay
   reverse-chronological with Rejections interleaved, so that the screen still
   reads newest-first.

### Adding a dated Rejection

7. As a member of the Household, I want an "Add a rejection" control on the Log
   screen, so that I can record a Rejection I never tapped on Tonight.
8. As a member of the Household, I want "Add a dinner" and "Add a rejection" as
   separate controls, so that each is one direct action with no mode toggle.
9. As a member of the Household, I want the add-rejection form to let me choose
   the Option, the date, and an optional reason, so that I can describe the
   Rejection fully.
10. As a member of the Household, I want to add a Rejection for a past date, so
    that I can backfill a night we passed on something but never recorded it.
11. As a member of the Household, I want to add a Rejection for today from the
    Log, so that recording a Rejection is not only possible from Tonight.
12. As a member of the Household, I want the reason on a manually added
    Rejection to be optional, so that a quick "we skipped this" with no
    explanation is still one fast action.
13. As a member of the Household, I want a Cancel control on the add-rejection
    form, so that I can back out without recording anything.

### Adding from a date-group

14. As a member of the Household, I want each date-group on the Log to offer
    adding a Dinner or a Rejection into that date, so that when I am looking at
    a night I can add to it directly.
15. As a member of the Household, I want a Rejection added from a date-group to
    default its date to that group's date, so that I do not re-type the date I
    am already looking at.

### Planned rejections

16. As a member of the Household, I want to add a Rejection for a future date,
    so that I can turn an Option down in advance for a night I already know
    about.
17. As a member of the Household, I want a Planned rejection to remove its
    Option from Tonight when that date arrives, so that I never have to think
    about an Option I already ruled out for that night.
18. As a member of the Household, I want a Planned rejection to leave Tonight
    unchanged until its date arrives, so that pre-rejecting next Sunday does
    not hide the Option today.
19. As a member of the Household, I want a Planned rejection to become ordinary
    settled history once its date passes, so that it needs no special
    handling.

### Editing and deleting Rejections

20. As a member of the Household, I want to edit any Rejection from the Log —
    its Option, date, or reason — so that I can correct a mistake whenever I
    notice it.
21. As a member of the Household, I want to edit a Rejection no matter how old
    it is, so that settled history is correctable, not frozen.
22. As a member of the Household, I want to delete any Rejection from the Log,
    so that I can remove one that should never have been recorded.
23. As a member of the Household, I want editing and deleting a Rejection to
    work inline on its row, the same way Log entries are edited, so that the
    Log behaves consistently.
24. As a member of the Household, I want a delete to take a confirm step, so
    that I do not remove a Rejection by a single mis-tap.
25. As a member of the Household, I want a deleted Rejection removed entirely,
    so that it stops feeding AI search.

### Option detail page parity

26. As a member of the Household, I want the Option detail page's Rejections
    section to let me edit and delete every Rejection of that Option, so that
    the same management is available wherever the Option is shown.
27. As a member of the Household, I want editing or deleting a Rejection on the
    Option detail page to update that page in place, so that the section
    reflects the change without a manual reload.

### Suppression and uniqueness

28. As a member of the Household, I want a Rejection I add for today from the
    Log to drop its Option off Tonight, so that adding it from the Log has the
    same effect as rejecting it live.
29. As a member of the Household, I want a past-dated Rejection I add or
    backfill to leave Tonight unchanged, so that recording history never
    disturbs today's list.
30. As a member of the Household, I want the same Option not to be rejectable
    twice for one date, so that my Rejection history carries no meaningless
    duplicates.
31. As a member of the Household, I want a duplicate Rejection — whether from
    an add or an edit — reported with an inline error, so that I understand why
    it was not saved and can fix it.
32. As a member of the Household, I want a failed Rejection write reported
    inline rather than shown as a false success, so that I am never misled
    about what was saved.

### AI search

33. As a member of the Household, I want all my Rejections — backfilled and
    pre-emptive included — fed into AI search, so that the model learns from
    every signal I have given it.
34. As a member of the Household, I want a Planned rejection fed into AI search
    with its future date, so that the model knows what we have decided to skip.
35. As a member of the Household, I want my Planned dinners fed into AI search,
    so that the model knows what we have already planned to eat when it ranks
    tonight.
36. As a member of the Household, I want a Rejection's Option to stay an AI
    search candidate unless it is rejected for today, so that a past or
    pre-emptive Rejection does not wrongly remove the Option from tonight's
    results.

### Configuration and cross-cutting

37. As the Household's administrator, I want adding, editing, and deleting
    Rejections to work whether or not AI search is configured, so that the
    management and the suppression are available on a deployment with no API
    key.
38. As a member of the Household, I want the Log's add controls, per-group
    controls, and rejection rows usable on phone and desktop with adequate
    touch targets, so that I can manage Rejections in the kitchen.
39. As a member of the Household using a keyboard, I want every add, edit,
    delete, and confirm control reachable with visible focus, so that the
    feature is fully operable without a mouse.
40. As a member of the Household using assistive tech, I want a saved, failed,
    or removed Rejection announced, so that the result of each action is
    perceivable without sight.

## Implementation Decisions

### The Log screen becomes the night's full record

- The Log screen interleaves Rejections into its date-groups: each date renders
  its Dinner (its Log entries) together with that date's Rejections. A date
  with only Rejections still forms a group. Reverse-chronological order is
  preserved; future-dated groups (Planned dinners and Planned rejections) sit
  in the "Upcoming" strip, past/today groups in "History".
- The Option detail page's History and Rejections sections are unaffected in
  layout — its Rejections section already lists that Option's Rejections; this
  PRD upgrades only the controls on it (see below).

### New pure module — interleaved day grouping

`lib/dinner-grouping.ts` is reworked (the module the Log screen and the Option
detail page both already depend on for grouping). Given a newest-first Log, the
Rejection list, and today's date, it produces per-date records — each carrying
that date's Log entries and that date's Rejections — split into Upcoming
(`date > today`) and History (`date <= today`), Upcoming soonest-first and
History newest-first. The existing Dinner grouping and the
"Today / Tomorrow / Yesterday / Fri, May 16" date label are preserved. The
module is pure — no React, no DB — and is the primary unit-test target.

### `(option_id, rejected_on)` uniqueness

- A `UNIQUE(option_id, rejected_on)` constraint is added to the `rejections`
  table via a new out-of-band drizzle migration. This is exactly the change
  ADR-0008 records as superseding ADR-0006's "no such constraint is needed"
  reasoning — that reasoning held only while Rejections were live-only.
- A duplicate insert or update raises Postgres `23505`; the server action maps
  it to an inline error, "Already rejected for that date", mirroring how
  `logForDate` / `updateLogEntry` handle the `(option_id, eaten_on)` collision.
- Adding the constraint is safe against existing data: live rejecting cannot
  produce a same-day duplicate, so no `rejections` table — dev or prod — can
  hold a conflicting pair when the migration runs.

### Rejection-management server actions

Three new `authedAction`-wrapped actions — thin DB writes, consistent with the
existing `logForDate` / `updateLogEntry` / `deleteLogEntry` and
`rejectOption` / `bringBackRejection` patterns:

- **Create a dated Rejection** — `(optionId, rejectedOn, reason)`: insert a
  `rejections` row; an empty or whitespace-only reason is stored as `null`; an
  invalid date is rejected; `23505` → "Already rejected for that date";
  `22P02` / `23503` → "That option is no longer available". Returns an
  `ok`/`error` result.
- **Update a Rejection** — `(id, { optionId, rejectedOn, reason })`: same
  validation and collision handling.
- **Delete a Rejection** — `(id)`: delete the row by id (the row is gone
  entirely, so it stops feeding AI search — ADR-0006).

Each revalidates `/`, `/log`, and `/catalog/[id]`: a Rejection dated today
changes Tonight's suppression, the Log renders it, and the Option detail page
shows it. The existing `rejectOption` and `bringBackRejection` are unchanged.

### Suppression stays date-driven (ADR-0008)

- Suppression is derived server-side from `rejections` rows where `rejected_on`
  equals today — exactly as built. A manually added Rejection dated today
  suppresses its Option from Tonight; a past one does not; a Planned rejection
  suppresses when its date becomes today, with no day-boundary logic. There is
  no "manual vs live" flag — the date alone decides.
- `lib/ranking.ts` and the Score (ADR-0003) are untouched, and the ranking
  still excludes future Log rows. Suppression is a presentation filter only.

### AI snapshot — the whole picture (extends ADR-0005)

- `buildSnapshot` is fed the **full** Log including future entries; its `log`
  array carries each entry with its real date. The snapshot already includes
  today's date, so the model distinguishes Planned dinners from history itself.
- The Rejections block keeps **two** groups — today's (Options removed from the
  candidate set) and not-today's (Options still candidates). `partitionRejections`
  already routes a future-dated row into the not-today group; that group is
  relabelled date-neutrally in the snapshot type and the system prompt (the
  current "Earlier rejections" label would otherwise misdescribe a future row),
  and the prompt states each row carries its own date, past or upcoming. No
  third group is added.
- The suppression / candidate-removal set stays `rejected_on = today` only — a
  Planned rejection's Option remains an AI search candidate today.
- `getRejections` already returns every Rejection of an active Option with no
  date filter, so future-dated rows reach the snapshot once they exist — no
  change there. The non-future Log the snapshot currently borrows from
  `getTonightData` is replaced by a full-Log feed.

### Queries (`db/queries.ts`)

- A Log-screen Rejections query: every Rejection joined to its Option (name,
  kind), ordered newest `rejected_on` first — the counterpart of `getLog`.
- A full-Log feed for the AI snapshot: all Log entries regardless of date, for
  active Options.

### UI

- The Log screen gains two add controls — "Add a dinner" (the existing form)
  and "Add a rejection" (a new inline form: Option select, date, optional
  reason). Each date-group also offers adding a Dinner or a Rejection into that
  date, with the date pre-filled to the group's date.
- A Rejection row component with inline edit and delete, mirroring the existing
  `EntryRow` / `EntryEditForm`: it shows the Option name and the reason; Edit
  expands the row into a form (Option, date, reason); Delete uses the §17
  inline-confirm pattern. The component is shared by the Log screen and the
  Option detail page so a Rejection is managed identically wherever it appears.
- The Option detail page's Rejections section gains this inline edit/delete on
  every row; its current today-only "Bring back" button is subsumed by the
  always-available Delete. Tonight's "Rejected tonight" disclosure is untouched
  — "Bring back" there stays the today-only quick-undo.
- Visual styling is `DESIGN.md`'s call; this PRD fixes the controls and the
  interleaved structure, not the styling.

## Testing Decisions

A good test exercises a module's **external behavior** through its public
interface — given these inputs, expect this output — and never asserts on
internal structure, so it survives a refactor. Framework: **Vitest**, as across
the existing suites. No live Anthropic call is made in any test.

**Tested module 1 — interleaved day grouping (`lib/dinner-grouping.ts`, full
unit coverage).** Log entries and Rejections on the same date land in one
record; a Rejection-only date forms its own record; the Upcoming/History split
is exact at the today boundary; Upcoming is soonest-first and History
newest-first; the date label is unchanged. Prior art: the existing
`lib/dinner-grouping.test.ts`, exercised with hand-built fixtures.

**Tested module 2 — `lib/rejections.ts` (extend `lib/rejections.test.ts`).** A
future-dated row lands in the not-today group and is **not** in the suppression
set; the today boundary stays exact; the not-today group carries its rows with
their real dates.

**Tested module 3 — `lib/ai-search.ts` `buildSnapshot` (extend
`lib/ai-search.test.ts`).** A future-dated Log entry appears in the snapshot
`log` with its date; a future-dated Rejection appears in the not-today group;
an Option with only a future-dated Rejection stays in the candidate `options`.

**Tested module 4 — the Rejection-management server actions (a new
`.db.test.ts`).** The duplicate-`(option_id, rejected_on)` collision — on both
create and update — returns the inline error rather than throwing. Prior art:
`app/log/actions.db.test.ts` and `app/catalog/actions.db.test.ts`, which
integration-test the existing actions against the real test database.

**Not tested.** The UI components and the new queries get no dedicated tests —
the queries are exercised through the screens, and this is consistent with v1's
no-browser-E2E posture. One hand-verified smoke check confirms that a
backfilled Rejection and a future-dated one both reach a live AI search prompt.

## Out of Scope

- **Recurring Planned rejections** — a repeat rule ("every Sunday"), an end
  condition, series editing. ADR-0008: one-off only; a recurring closure is
  left for the AI model to infer from flat Rejection history (ADR-0006).
- **Any change to the deterministic ranking, the Score, or `lib/ranking.ts`** —
  ADR-0003, ADR-0006, and ADR-0008 hold; suppression is a presentation filter.
- **The live Tonight reject affordance and the "Rejected tonight" disclosure**
  — both stay exactly as built; "Bring back" there remains a today-only
  quick-undo.
- **A dated add-rejection form on the Option detail page** — the detail page
  gains edit/delete of an Option's existing Rejections; creating a Rejection
  for an arbitrary date is the Log screen's job. The detail page keeps its
  existing live "Reject" control.
- **Bulk operations** — multi-select delete or bulk pruning of Rejection
  history. Single-row edit and delete only.
- **Per-person attribution** of who rejected — the app is single-Household,
  with no per-person identity (`CONTEXT.md`).
- **A cap on how many Rejections or Log entries feed the AI prompt** — uncapped
  by choice (ADR-0006); revisit only if a prompt genuinely bloats.

## Further Notes

- `docs/adr/0008-rejections-managed-dated-history.md` records the architectural
  decision; `CONTEXT.md` carries the rewritten **Rejection** term and the new
  **Planned rejection** term. Both were updated in the grill session that
  produced this PRD — no further doc change is needed.
- This builds on the Rejections feature (`.issues/rejections/`, ADR-0006) and
  on AI search as reshaped by ADR-0005 — the snapshot is raw dated history the
  model reasons over; this PRD widens that history to include the near future.
- The new migration is applied out-of-band per the deploy model. The prod
  `rejections` table predates it; the constraint addition is safe because no
  same-day duplicate can exist (see Implementation Decisions).
- Files this PRD is expected to touch: `lib/dinner-grouping.ts`,
  `lib/rejections.ts`, `lib/ai-search.ts`, `db/schema.ts`, `db/queries.ts`, a
  new drizzle migration, `app/log/*`, `app/catalog/[id]/*`, and a Rejection
  server-actions module. It should land cleanly on top of the Rejections,
  Option detail page, AI search, and Tonight decided-mode work already merged.
