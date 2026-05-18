# PRD: Rejections on Tonight

Status: ready-for-agent

Vocabulary: [`CONTEXT.md`](../../CONTEXT.md) — the **Rejection** term and the
**Bring back** action govern this PRD. Decision:
[`docs/adr/0006-rejections-feed-ai-search.md`](../../docs/adr/0006-rejections-feed-ai-search.md)
— Rejections stored flat as dated history, the model judges what is standing.
Builds on [`docs/adr/0005-ai-search-reasons-about-habits.md`](../../docs/adr/0005-ai-search-reasons-about-habits.md)
(the AI snapshot is raw dated history) and respects
[`docs/adr/0003-ranking-in-typescript.md`](../../docs/adr/0003-ranking-in-typescript.md)
(the deterministic ranking is untouched).

This PRD adds **Rejections** to the **Tonight** screen. It does not change the
deterministic ranking, the Log, or the Catalog.

---

## Problem Statement

AI search reads the Household's **Log** to find eating habits — but the Log
records only what the Household *ate*. When a member looks at **Tonight** and
turns an **Option** down — "that place is closed on Sundays", "too heavy for
tonight" — that reaction vanishes the moment the list refreshes. The app never
hears the Household's clearest signal about a bad fit: an explicit "no, because
X".

There is a smaller, immediate annoyance too. A member scanning Tonight has no
way to clear an Option they have already mentally ruled out — it sits in the
list, re-cluttering every glance, and a later AI search can surface it all over
again.

## Solution

A reject affordance on every Tonight picker row. A member **Rejects** an Option
for tonight's decision and may add a short reason. The Option leaves tonight's
list immediately — the deterministic list and AI search results alike — and
returns on its own the next day.

Every Rejection is stored as dated history and fed into future AI searches,
where the **model itself** reads the reason and decides which Rejections reflect
a standing dislike ("closed on Sundays") and which were one-off ("too heavy
tonight"). A "Rejected tonight" disclosure pinned at the bottom of the list lets
the Household see today's Rejections and **Bring back** a mistaken one.

The deterministic ranking is untouched — suppression is a presentation filter,
never a Score change. Rejecting works whether or not AI search is configured;
only the AI-feeding half is moot without an API key.

## User Stories

### Rejecting an Option

1. As a member of the Household, I want a reject control on every Tonight picker
   row, so that I can turn down an Option I am not having tonight.
2. As a member of the Household, I want the reject control visually secondary to
   Pick, so that the one-tap Pick action stays the obvious primary action on
   each row.
3. As a member of the Household, I want tapping reject to open an inline text
   box on the row, so that I can add a reason without leaving the screen or
   opening a modal.
4. As a member of the Household, I want the reason box focused as soon as it
   opens, so that writing a reason is the path of least resistance.
5. As a member of the Household, I want the reason to be optional, so that a
   quick "not tonight" with no explanation is still one quick action.
6. As a member of the Household, I want a Submit control on the inline box, so
   that rejecting is a deliberate two-step action and not a single mis-tap.
7. As a member of the Household, I want a Cancel control on the inline box, so
   that I can back out before committing if I opened it by accident.
8. As a member of the Household, I want a submitted Rejection to remove the
   Option from tonight's list immediately, so that the list reflects my decision
   without a reload.
9. As a member of the Household, I want to reject an Option whether or not I
   have run an AI search, so that rejecting is about tonight's decision, not
   tied to the AI search box.
10. As a member of the Household, I want to reject Options from the picker even
    in Tonight's decided mode (after a Pick, via "Add another option"), so that
    rejecting works the same way regardless of mode.

### Suppression for the day

11. As a member of the Household, I want a rejected Option hidden from the
    deterministic Tonight list for the rest of the day, so that I stop seeing
    something I have ruled out.
12. As a member of the Household, I want a rejected Option also hidden from AI
    search results for the rest of the day, so that running a search does not
    resurface something I just rejected.
13. As a member of the Household, I want a rejected Option to come back on its
    own the next day, so that a Rejection means "not tonight", not "never
    again".
14. As a member of the Household, I want the suppression to survive a page
    reload, so that a rejected Option stays gone for the day without my having
    to reject it again.
15. As a member of the Household, I want rejecting every remaining Option to
    leave a plain empty-list state, so that an all-rejected list reads as a real
    state and not a broken screen.

### The reason as a signal for AI search

16. As a member of the Household, I want my Rejections and their reasons fed
    into future AI searches, so that the model knows what I have turned down and
    why.
17. As a member of the Household, I want the model — not a fixed rule in the app
    — to judge which reasons are standing dislikes and which were one-off, so
    that "closed on Sundays" keeps applying while "too heavy tonight" naturally
    fades.
18. As a member of the Household, I want each Rejection carried with its date,
    so that the model can weigh recency and frequency — a reason repeated every
    Sunday versus a one-off four months ago.
19. As a member of the Household, I want today's Rejections passed to AI search
    even though those Options are off the candidate list, so that the model can
    generalize the reason to other Options.
20. As a member of the Household, I want Options I rejected on earlier days to
    still be candidates in AI search, so that the model re-considers them while
    still seeing why I once passed.
21. As a member of the Household, I want my full Rejection history kept, so that
    AI search learns my standing tastes over weeks, not just today.
22. As a member of the Household, I want a Rejection with no reason still passed
    to AI search as a light "passed on this" signal, so that an unexplained
    Rejection is honest weak data rather than noise.

### Seeing and undoing Rejections

23. As a member of the Household, I want a "Rejected tonight" disclosure listing
    today's Rejections, so that what I have turned down is visible, not
    invisible.
24. As a member of the Household, I want that disclosure pinned at the bottom of
    the list and collapsed by default, so that it costs no screen space until I
    scroll to it.
25. As a member of the Household, I want the disclosure to show a count of
    today's Rejections, so that I can tell at a glance whether I have rejected
    anything.
26. As a member of the Household, I want a "Bring back" control on each entry in
    the disclosure, so that I can reverse a Rejection I made by mistake.
27. As a member of the Household, I want "Bring back" to return the Option to
    tonight's list immediately, so that a corrected mistake shows at once.
28. As a member of the Household, I want "Bring back" to delete the Rejection
    record entirely, so that a mis-tapped Rejection never reaches AI search and
    never teaches the model anything.
29. As a member of the Household, I want "Bring back" available only for today's
    Rejections, so that the disclosure stays a quick-undo tool, not a history
    manager.

### Configuration and cross-cutting

30. As the Household's administrator, I want rejecting to work whether or not AI
    search is configured, so that the suppression-for-the-day convenience is
    available on a deployment with no API key.
31. As a member of the Household, I want the reject control, the reason box, and
    the disclosure usable on phone and desktop with adequate touch targets, so
    that I can reject comfortably in the kitchen.
32. As a member of the Household using a keyboard, I want the reject control,
    the reason box, Submit, Cancel, the disclosure, and "Bring back" reachable
    with visible focus, so that the feature is fully operable without a mouse.
33. As a member of the Household using assistive tech, I want the reason box's
    open state and the removal of a rejected row announced, so that the
    interaction is perceivable without sight.

## Implementation Decisions

### A Rejection is night-scoped; persistence

- A new `rejections` table: `id` (uuid pk), `option_id` (uuid, FK → `options.id`,
  `ON DELETE CASCADE`), `reason` (text, nullable — the reason is optional),
  `rejected_on` (date — the Household's calendar day in `APP_TZ`), `created_at`
  (timestamptz, default now).
- `ON DELETE CASCADE`: a Rejection is light history and must not block an
  Option's hard-delete (allowed only for an Option with no Log entries —
  ADR-0001). A Rejection of a hard-deleted Option is meaningless, so it goes
  with the Option. A Rejection is *not* a Log entry and carries no Score weight.
- No unique constraint on `(option_id, rejected_on)`: once rejected an Option
  leaves the picker, so it cannot be re-rejected the same day; after "Bring
  back" deletes the row, a fresh Rejection is a clean insert. A constraint would
  add nothing.
- An index on `rejected_on` supports the today's-rejections query. The table is
  single-household-small; that is the only index needed.
- A new migration, `drizzle/0002_*.sql`, applied out-of-band per the deploy
  model.

### Suppression is a presentation filter, not a ranking change

- ADR-0003 and `lib/ranking.ts` are untouched; ADR-0006 records this. A
  Rejection never changes a Score.
- "Suppressed for the day" means today's rejected Option ids are removed from
  the candidate set the Tonight page renders — both from the deterministic list
  and from the AI search snapshot's candidate `options`. It is the same kind of
  filter as the existing tag filter.
- Suppression is derived server-side from the `rejections` rows where
  `rejected_on` is today, so it survives a reload with no client state. A new
  calendar day drops `rejected_on = today` to empty on its own, so a rejected
  Option reappears with no day-boundary logic.

### New pure module — `lib/rejections.ts`

A pure module, no I/O — the unit-test target. Given rejection rows (each: Option
id, reason, `rejected_on`, plus the Option's name / kind / Tags for snapshot
readability) and today's date, it produces:

- **Partition** — the rows split into *rejected tonight* (`rejected_on` = today)
  and *earlier*.
- **Suppression set** — the Option ids rejected today.
- **Snapshot block** — both groups shaped for the AI snapshot: reasons wrapped
  in `<household-text>` delimiters, dates formatted with weekday (the ADR-0005
  date-with-weekday format), newest first — parallel to the Log block.

Rejections of Archived Options are excluded upstream in the query, mirroring how
the Log already excludes Archived Options' entries; `lib/rejections.ts` operates
on what it is given.

### `lib/ai-search.ts` extended

- `ModelSnapshot` gains a Rejections block with two groups: `rejectedTonight`
  (Options off the candidate list, each with reason + date) and
  `earlierRejections` (Options still candidates, each with reason + date).
- `buildSnapshot` accepts the rejection rows and the suppression set: it drops
  today's-rejected Options from the `options` candidate array and attaches the
  Rejections block (built via `lib/rejections.ts`).
- `SYSTEM_PROMPT` is extended: the Rejections block is the Household's record of
  Options turned down and why; the model should read each reason together with
  its date and frequency and decide for itself which Rejections are standing and
  which were one-off (ADR-0006). "Rejected tonight" Options are deliberately not
  candidates, but their reasons may inform the ranking of other Options.
- ADR-0005's principle holds — the Rejections block is raw dated history, not a
  pre-digested signal, so the model reasons over it the way it reasons over the
  Log.

### `db/queries.ts`

- A new query returns rejection rows joined to their Option (name, kind, Tags),
  for **active** Options only, ordered newest `rejected_on` first. The Tonight
  page uses one result for both jobs: today's subset (suppression + the
  disclosure) and the full history (the snapshot), partitioned by
  `lib/rejections.ts`.

### Server actions — `app/tonight-actions.ts`

- `rejectOption(optionId, reason)` — `authedAction`-wrapped. Inserts a
  `rejections` row with `rejected_on` = today's Household day, then revalidates
  Tonight. Thin — no logic beyond the write.
- `bringBackRejection(rejectionId)` — `authedAction`-wrapped. Deletes the
  `rejections` row by id, then revalidates Tonight. Deleting the row removes the
  Rejection from AI memory as well as from the day's suppression.
- Both follow the existing thin-server-action pattern (`pickTonight`,
  `aiSearchAction`).

### Tonight row — the reject affordance

- `app/tonight-row.tsx` gains a **secondary, low-emphasis** reject control on
  each picker row, subordinate to the primary Pick button. Tapping it
  inline-expands a reason box on the row — an autofocused text input with
  **Submit** and **Cancel**. Submit calls `rejectOption`; the row drops out on
  revalidation. Cancel collapses the box with nothing recorded.
- The two-step (reject → Submit) is itself the mis-tap guard; there is no
  separate post-submit undo on the row (the disclosure's "Bring back" covers
  mistakes).
- Visual styling is `DESIGN.md`'s call; this PRD fixes the hierarchy (secondary
  to Pick) and the mechanism (inline expand, not a modal).

### Tonight screen — the "Rejected tonight" disclosure

- `app/tonight-screen.tsx` gains a "Rejected tonight (N)" disclosure pinned at
  the **bottom** of the picker list, after the `<ol>` of rows, **collapsed by
  default** — no screen cost until the Household scrolls to it. The pattern
  mirrors decided mode's existing "Add another option" disclosure.
- Expanded, it lists today's Rejections (Option name, and the reason when one
  was given), each with a "Bring back" control calling `bringBackRejection`.
- The disclosure renders in picker mode and in decided mode's reopened picker
  alike.

### `app/page.tsx`

- Loads the rejection rows, derives the suppression set, the disclosure list,
  and the snapshot inputs via `lib/rejections.ts`, removes suppressed Options
  from the picker rows, and passes today's Rejections to the screen.

## Testing Decisions

A good test exercises a module's **external behavior** through its public
interface — given these inputs, expect this output — and never asserts on
internal structure, so it survives a refactor. Framework: **Vitest**, as across
the existing suites. No live Anthropic call is ever made in a test.

**Tested module 1 — `lib/rejections.ts` (full unit coverage).**

- Partition: a row with `rejected_on` = today lands in *rejected tonight*; an
  earlier row lands in *earlier*; the today boundary is exact.
- Suppression set: it is exactly the Option ids rejected today, and nothing
  from earlier days.
- Snapshot block: reasons are wrapped in the `<household-text>` delimiters; a
  `null` reason is carried as `null`, not delimited; dates carry the weekday;
  both groups are ordered newest first.

**Tested module 2 — `lib/ai-search.ts` (extend `lib/ai-search.test.ts`).**

- `buildSnapshot` drops today's-rejected Options from the candidate `options`
  array.
- The snapshot's Rejections block carries the `rejectedTonight` and
  `earlierRejections` groups with their reasons and dates.
- Reasons in the block are delimited; an earlier-rejected Option still appears
  in the candidate `options`.

**Not tested.** The server actions `rejectOption` / `bringBackRejection` get no
dedicated tests — they are thin `authedAction` DB writes, consistent with the
`ai-search` PRD's call on `aiSearchAction`. No screen-level test is added; the
existing `app/tonight-screen.test.tsx` is left as-is.

Prior art: `lib/tonight-filter.test.ts` and `lib/tonights-dinner.test.ts` are
the model for the `lib/rejections.ts` tests — Vitest, pure functions exercised
with hand-built fixtures. `lib/ai-search.test.ts` already covers `buildSnapshot`
and is extended in place.

One hand-verified smoke check confirms a Rejection reaches a live AI search
prompt, consistent with v1's "no browser E2E" testing posture.

## Out of Scope

- Managing the **historical** Rejection log — a history screen, search, or bulk
  pruning of old Rejections that may be skewing AI results. The "Rejected
  tonight" disclosure undoes only *today's* Rejections; older ones are settled
  history. A historical-management UI is the genuine next feature, not this one.
- Any change to the deterministic ranking, the Score, or `lib/ranking.ts` —
  ADR-0003 and ADR-0006 hold; suppression is a presentation filter only.
- Decay, expiry, or query-scoping of Rejections in app code — ADR-0006: stored
  flat, the model judges. No decay heuristic is written.
- A cap on how many Rejections feed the prompt — uncapped by choice (ADR-0006);
  revisit only if a prompt ever genuinely bloats.
- Rejecting from the Catalog or Log screens — rejecting is a Tonight-decision
  action.
- Rejecting an Option already Picked into Tonight's dinner — a Pick is the
  positive decision; it is undone via decided mode's existing Remove.
- A post-submit undo on the row, separate from the disclosure — the two-step
  reject, the "Bring back" disclosure, and reappear-tomorrow already cover the
  mistake case.
- Editing a Rejection's reason after submit — Bring it back and reject again.
- Per-person attribution of who rejected — the app is single-Household, with no
  per-person identity (`CONTEXT.md`).
- Showing Rejection reasons anywhere outside the "Rejected tonight" disclosure —
  not on the row, not in the Log.

## Further Notes

- `docs/adr/0006-rejections-feed-ai-search.md` records the architectural
  decision; `CONTEXT.md` carries the **Rejection** term and the **Bring back**
  action. Both were added in this grill session — no further doc change is
  needed.
- This builds on AI search as reshaped by ADR-0005: the model snapshot is raw
  dated history and the model reasons over it. The Rejections block follows the
  same principle — raw dated history, not a pre-digested signal.
- Coordination: AI search (`.issues/ai-search/`) and Tonight decided mode
  (`.issues/tonight-decided-mode/`) are both built on `ralph-3`. This PRD
  extends the same files (`lib/ai-search.ts`, `app/tonight-screen.tsx`,
  `app/tonight-row.tsx`, `app/page.tsx`, `db/queries.ts`); it should land after
  those are merged, or merge cleanly with them rather than overwrite.
- The feature works without `ANTHROPIC_API_KEY`: suppression, the disclosure,
  and "Bring back" are all key-independent; only the AI-feeding half is moot
  when AI search is unconfigured.
