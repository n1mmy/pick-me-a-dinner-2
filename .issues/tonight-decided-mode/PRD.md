# PRD: Tonight — decided mode

Status: ready-for-agent

Vocabulary: [`CONTEXT.md`](../../CONTEXT.md) — note the **Tonight** definition
and the **Tonight's dinner** term, both updated alongside this PRD. Decisions:
[`docs/adr/`](../../docs/adr/) — ADR-0003 (ranking computed in TypeScript) is
the relevant one; this PRD adds no ADR.

This PRD covers a focused redesign of the **Tonight** screen. It builds on the
shipped v1 app and does not change the ranking, the Log, or the Catalog.

---

## Problem Statement

When a member of the Household Picks an Option on **Tonight**, the screen gives
no sense that the evening is decided. The picked Option's per-Option recency
drops to zero, so its Score collapses and it sinks to the bottom of the ranked
list — from the user's point of view it just *disappears*. The screen then
keeps showing the whole active Catalog, still looking like a list to search
through, as if nothing had been chosen. The Household has decided what's for
dinner, but Tonight still behaves like they haven't — and the one thing they
now care about (what we're eating, and how to act on it) is nowhere on the
screen.

## Solution

Tonight becomes a two-mode screen. Before anything is Picked it is the ranked
**picker**, exactly as today. The moment an Option is Picked, the screen
switches to **decided mode**: a "Tonight's dinner" block shows what was chosen,
and the ranked picker collapses out of the way behind an "Add another option"
control. The decided block is calm and action-oriented — for a Restaurant it
surfaces prominent "Menu" and "Call" buttons; for a Home meal, a "Recipe"
button — so once the choice is made the screen helps the Household *act on it*
rather than keep searching. A mis-tap is fixable in place: each picked Option
has an inline "Remove". Because a Dinner can be multi-Option, "Add another
option" re-opens the picker (minus what's already picked) so a second Option
joins Tonight's dinner; the picker then auto-collapses again. At the start of a
new day, with no Log entry dated today, Tonight returns to picker mode on its
own.

## User Stories

### Decided mode — seeing tonight's dinner

1. As a member of the Household, I want Tonight to switch to a decided view the
   moment I Pick an Option, so that the screen reflects that tonight's Dinner
   is settled instead of still looking like a catalog to search.
2. As a member of the Household, I want a Pick to move the Option into a
   "Tonight's dinner" block immediately, so that I can see where it went
   instead of watching it sink to the bottom of the ranked list.
3. As a member of the Household, I want my picked Option shown under a quiet
   "Tonight's dinner" sub-label, so that I can tell at a glance what we're
   eating tonight.
4. As a member of the Household, I want each Option in Tonight's dinner to show
   its name and a Home/Restaurant badge, so that I know what kind of Dinner it
   is.
5. As a member of the Household, I want each Option in Tonight's dinner to show
   its Tags with per-Tag recency, so that I keep that context after deciding.
6. As a member of the Household, I want the Explanation chip left out of the
   decided view, so that the settled view stays calm and free of
   decision-support clutter.
7. As a member of the Household, I want the screen heading to stay "Tonight" in
   both modes, so that the page feels like one stable place rather than two.
8. As a member of the Household returning to Tonight later the same evening, I
   want it to open straight into decided mode showing what I already Picked, so
   that I am not asked to decide something already decided.

### Decided mode — acting on the choice

9. As a member of the Household who Picked a Restaurant, I want a prominent
   "Menu" button, so that I can open its menu or order page in one tap.
10. As a member of the Household who Picked a Restaurant, I want a prominent
    "Call" button, so that I can phone the Restaurant to order or book in one
    tap.
11. As a member of the Household who Picked a Home meal, I want a prominent
    "Recipe" button, so that I can open the recipe link in one tap.
12. As a member of the Household, I want an action button to appear only when
    its underlying field is set, so that I never see a dead "Call" button for a
    Restaurant with no phone number on file.

### Correcting a pick

13. As a member of the Household, I want a "Remove" control on each Option in
    Tonight's dinner, so that I can undo a mis-tapped Pick without leaving the
    screen.
14. As a member of the Household, I want "Remove" to ask for an inline confirm
    before it deletes, so that a fat-finger does not silently drop a Pick.
15. As a member of the Household, I want removing the last Option from
    Tonight's dinner to drop the screen back to picker mode, so that I can
    decide again from a clean ranked list.

### Adding another Option — a multi-Option Dinner

16. As a member of the Household, I want an "Add another option" control in
    decided mode, so that I can record a multi-Option Dinner (takeout plus some
    home cooking).
17. As a member of the Household, I want "Add another option" to re-open the
    ranked picker, so that I can Pick a second Option the same way I Picked the
    first.
18. As a member of the Household, I want an Option I have already Picked to be
    absent from the re-opened picker, so that the picker only ever shows what I
    could still add.
19. As a member of the Household, I want the picker to auto-collapse back to
    decided mode after I Pick a second Option, so that the screen returns to
    its settled state without extra taps.
20. As a member of the Household, I want a multi-Option Tonight's dinner listed
    in pick order, oldest first, so that it reads as how the evening came
    together and never reshuffles when I add more.

### Picker mode — preserved behavior

21. As a member of the Household with nothing Picked yet today, I want Tonight
    to open straight into the ranked picker, so that deciding is still the
    default first action.
22. As a member of the Household, I want the picker — the ranked list, the
    All/Home/Restaurant segment, and the tri-state Tag filters — to behave
    exactly as before whenever it is open, so that the redesign costs me no
    existing capability.
23. As a member of the Household, I want the one-tap "Pick tonight" action to
    keep working as before, so that Picking stays effortless.
24. As a member of the Household, I want "Log another date" to remain available
    on picker rows, so that I can still backfill a forgotten Dinner or plan one
    from Tonight.

### The new day

25. As a member of the Household, I want Tonight's dinner to reflect only Log
    entries dated today, so that yesterday's Dinner does not linger on the
    screen.
26. As a member of the Household, I want Tonight to return to picker mode
    automatically at the start of a new day, so that each evening begins with a
    fresh decision.

### Accessibility & cross-cutting

27. As a member of the Household using assistive tech, I want the switch
    between picker and decided mode announced, so that the mode change is
    perceivable without sight.
28. As a member of the Household, I want the decided view usable on both phone
    and desktop with touch targets of at least 44×44px, so that I can Pick and
    correct comfortably in the kitchen.
29. As a member of the Household using a keyboard, I want "Add another option",
    "Remove", and the Menu/Call/Recipe buttons reachable with visible focus, so
    that the decided view is fully operable without a mouse.

## Implementation Decisions

### The two modes

- Tonight has two modes, decided **server-side** from the Household's Log:
  **picker mode** when no Log entry is dated today, **decided mode** when one
  or more are. "Today" is the Household's calendar day in `APP_TZ`, as already
  computed for the ranking. The page stays `force-dynamic`.
- The screen heading stays "Tonight" in both modes. In decided mode the picked
  Options sit under a quiet "Tonight's dinner" sub-label.
- The day boundary needs no extra logic: because the mode keys off Log entries
  dated *today*, a new calendar day naturally leaves Tonight's dinner empty and
  the screen falls back to picker mode.

### New pure module — `lib/tonights-dinner`

A single new module, pure (no DB, no React), holding the testable logic of the
decided view. Two functions:

- **`splitTonight`** — given the ranked Tonight rows and today's Log entries,
  returns `{ tonightsDinner, picker }`. `tonightsDinner` is the picked Options
  ordered by **pick order, oldest first** (by the Log entry's `created_at`).
  `picker` is the ranked rows with every already-picked Option removed — the
  picker only ever offers what is not yet Picked.
- **`decidedActions`** — given an Option's `kind`, `url`, and `phone`, returns
  which action buttons the decided row should render. A **Restaurant** yields a
  "Menu" button (from `url`) and a "Call" button (a `tel:` link from `phone`);
  a **Home meal** yields a "Recipe" button (from `url`). Each button is
  returned only when its source field is set — a Restaurant with no `phone`
  gets no "Call".

### Data — `getTonightData`

`getTonightData` is extended so the page has what the decided view needs:

- Each Option additionally carries `url` and `phone` (both nullable; `phone` is
  always null for a Home meal). These feed `decidedActions`.
- Today's Log entries are returned with their `id` and `created_at`. `id` lets
  the decided row's "Remove" call `deleteLogEntry`; `created_at` gives the pick
  order for `splitTonight`. The ranking input itself is unchanged.

### The decided block

- One row per Option in Tonight's dinner: name, Home/Restaurant badge, Tag
  chips with per-Tag recency, the `decidedActions` buttons, and an inline
  "Remove". No Explanation chip.
- "Remove" reuses the existing `deleteLogEntry` server action — no new
  mutation. It deletes today's Log entry for that Option. Removing the last
  entry leaves Tonight's dinner empty, so the screen renders picker mode again.
- "Remove" uses the established inline-confirm interaction (a confirm step in
  place, no modal, no undo-toast) — the same pattern destructive actions
  already use elsewhere in the app.
- The `url` button is labelled **"Menu"** for a Restaurant. `url` may in
  practice hold an order or delivery page rather than a menu; that is
  acceptable — "Menu" is the chosen label regardless.

### The collapsible picker

- In decided mode the picker — the All/Home/Restaurant segment, the Tag filter
  chips, and the ranked `<ol>` — is collapsed behind an "Add another option"
  control. Tapping it re-opens the picker; Picking an Option from it inserts
  the Log entry as today and the picker **auto-collapses** back to decided
  mode, with the new Option appended to Tonight's dinner.
- An already-picked Option does not appear in the re-opened picker; this
  exclusion is `splitTonight`'s job, so the picker is correct without per-row
  logic.
- AI search (see `CONTEXT.md`) is a separate, not-yet-built feature. When it
  ships it belongs **inside** this collapsible picker — it is a way to re-rank
  the candidate list, so it collapses along with the rest of the picker in
  decided mode. This PRD does not implement AI search.

### Picking — unchanged

- The `pickTonight` server action is unchanged: it still upserts a `dinner_log`
  row on `(option_id, eaten_on)` for today, so a double-tap stays a harmless
  no-op, and a different Option the same evening is still a separate Log entry.
- The transition into decided mode is now the confirmation of a successful
  Pick. The previous 1.6-second "Logged ✓" flash on the picker row is
  superseded — the Option visibly moving into Tonight's dinner is the feedback.
- `pickTonight` already returns a result so a write failure is reported inline
  rather than shown as a false success; that behavior is kept.

## Testing Decisions

A good test exercises a module's **external behavior** through its public
interface — given these inputs, expect this output — and does not assert on
internal structure, so it survives refactors. Framework: **Vitest**, as used
across the existing pure-logic and server-action suites.

**Tested module — `lib/tonights-dinner` (the only new module, and the agreed
test target):**

- `splitTonight`:
  - no Log entry dated today → `tonightsDinner` empty, `picker` equals the full
    ranked list.
  - one Option Picked → that Option in `tonightsDinner`, absent from `picker`.
  - several Options Picked → `tonightsDinner` in pick order, oldest `created_at`
    first; order is stable when another is added.
  - every active Option Picked → `picker` empty.
  - a Log entry dated today for an Option not in the ranked set (e.g. since
    Archived) is handled without error.
- `decidedActions`:
  - Restaurant with both `url` and `phone` → Menu + Call.
  - Restaurant missing one field → only the button whose field is set.
  - Restaurant with neither → no buttons.
  - Home meal with `url` → Recipe; Home meal without `url` → no buttons.
  - Home meal never yields Menu or Call.

Prior art: the existing ranking-engine and local-day unit tests are the model —
same Vitest style, pure functions exercised with hand-built fixtures.

The server actions need **no new tests**: `pickTonight` is unchanged and
`deleteLogEntry` is already covered by the Log suite, and "Remove" reuses it
as-is. Consistent with v1, there are no UI component unit tests; the decided
view is verified by hand.

## Out of Scope

- **AI search** itself — it is a separate feature in `CONTEXT.md`. This PRD
  only fixes its *place* (inside the collapsible picker); it does not build it.
- A "Directions" button from a Restaurant's `mapsUrl` — considered and
  deliberately left out; only "Menu" and "Call" were requested.
- Any change to the ranking Score, the Explanation chip logic, or
  `ranking.config`.
- Any change to the Log screen or the Catalog.
- Editing a picked Option's date or note from the decided block — corrections
  beyond "Remove" still happen on the Log screen.
- Reordering Options within Tonight's dinner — the order is fixed to pick
  order.
- An undo-toast for "Remove" — the inline-confirm step is the only safeguard,
  consistent with the app's existing destructive-action pattern.
- "Log another date" for an Option already Picked tonight: it is hidden from
  the picker in decided mode, so other-date logging for it happens on the Log
  screen. An accepted minor consequence, not a regression.
- Multi-day or weekly planning.

## Further Notes

- The bug this fixes precisely: a Pick sets the Option's per-Option recency to
  zero, its Score collapses, and it sinks to the bottom of the ranked list —
  which reads as the Pick "disappearing". Decided mode promotes the Option into
  Tonight's dinner instead, so the Pick is visibly *somewhere*.
- `CONTEXT.md` was updated alongside this PRD: the **Tonight** definition now
  covers both jobs (deciding and showing what was decided), a **Tonight's
  dinner** term was added, plus a relationship line and a flagged-ambiguity
  entry.
- No ADR was written. The two-mode screen is a reversible UI redesign, not an
  architectural or technology-lock-in decision; the existing ADRs are all
  architectural, and this change does not meet that bar.
- The decided block keeps Tag chips (with per-Tag recency) but drops the
  Explanation chip — the chip exists to help *choose*, and the choice is
  already made.
- AI search appears in `CONTEXT.md` but not yet in the code; it looks to be in
  flight in a parallel effort. If AI search and this redesign land close
  together, coordinate so AI search renders inside the collapsible picker.
