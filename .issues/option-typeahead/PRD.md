# PRD: Type-ahead Option picker on the Log

Status: ready-for-agent

Vocabulary: [`CONTEXT.md`](../../CONTEXT.md) — the **Option**, **Home meal**,
**Restaurant**, **Catalog**, **Log entry**, **Dinner**, **Rejection**,
**Active**, and **Archived** terms govern this PRD. Decision:
[`docs/adr/0007-expose-every-sensible-control.md`](../../docs/adr/0007-expose-every-sensible-control.md)
— one consistent control wherever an Option is picked. No new ADR: this is a
UI control swap with no architectural decision; the design was settled in a
grill session.

---

## Problem Statement

When the Household adds a **Dinner** — or a **Rejection** — from the **Log**,
choosing which **Option** means using a native `<select>`: tapping it opens a
flat popup list of every Option in the **Catalog**. Finding the one you want
in that popup is slow and poor UX — it is one long unordered scroll, and on a
phone it is an unstyled OS picker the app does not control. There is no way to
type to narrow it down.

## Solution

Replace the `<select>` Option picker on the Log with a **type-ahead
combobox**: a text input with a dropdown that shows every Active Option when
opened and narrows as you type. The same control is used everywhere an Option
is picked on the Log — adding or editing a Dinner, and adding or editing a
Rejection — so the screen behaves consistently. The deterministic ranking, the
Score, AI search, the schema, and the server actions are all untouched; only
how an Option id is chosen in the UI changes.

## User Stories

### Finding and picking an Option

1. As a member of the Household, I want to type a few letters to narrow the
   Option list, so that I do not scroll the whole Catalog to find one Option.
2. As a member of the Household, I want the picker to show the full list of
   Active Options when it opens, before I type anything, so that I can still
   browse and scan when I do not recall the exact name.
3. As a member of the Household, I want matching to be case-insensitive
   substring matching — typing "thai" matches both "Pad Thai" and "Thai
   Garden" — so that I can type any distinctive part of a name.
4. As a member of the Household, I want the list shown flat and alphabetical,
   so that there is one predictable scan order.
5. As a member of the Household, I want each row to indicate whether the
   Option is a Home meal or a Restaurant, so that I can tell the kind at a
   glance without the list being split into sections.
6. As a member of the Household, I want to pick an Option by tapping or
   clicking its row, so that selecting is one direct action.
7. As a member of the Household, I want the picker to open with no Option
   pre-selected, so that I never log a Dinner against an Option I did not
   actually choose.
8. As a member of the Household, I want a placeholder prompting me to search,
   so that it is clear the field is a search field.
9. As a member of the Household, I want the picked Option's name shown in the
   field after I select it, so that I can confirm what I chose.
10. As a member of the Household, I want to change my pick by focusing the
    field again and re-searching, so that correcting a mistake is fast.
11. As a member of the Household, I want a clear control ("×") on the field,
    so that I can reset my pick and start over.
12. As a member of the Household, I want the field to snap back to my last
    valid pick if I type unmatched text and then click away, so that I never
    submit a half-typed non-choice.
13. As a member of the Household, I want a "No matches" message when nothing
    matches what I typed, so that I get clear feedback instead of an empty
    void.

### Keyboard and assistive tech

14. As a member of the Household using a keyboard, I want ↑/↓ to move through
    the filtered list, so that I can pick an Option without a mouse.
15. As a member of the Household using a keyboard, I want Enter to select the
    highlighted Option, so that a typed search ends in one keystroke.
16. As a member of the Household using a keyboard, I want Escape to close the
    list, so that I can dismiss the picker without choosing.
17. As a member of the Household using a keyboard, I want visible focus on the
    picker and its rows, so that the control is fully operable without a
    mouse.
18. As a member of the Household using assistive tech, I want the picker
    announced as a combobox with a listbox of options, so that it is usable
    without sight.

### Mobile

19. As a member of the Household, I want the picker usable on a phone with
    adequate touch targets, so that I can add a Dinner in the kitchen.
20. As a member of the Household, I want tapping the picker to open the list
    and let me type, so that the type-ahead works the same way as on desktop.

### Archived Options

21. As a member of the Household, I want Archived Options kept out of the
    picker list, so that I am only offered Options the Household still uses.
22. As a member of the Household, I want a Dinner that is logged against a
    now-Archived Option to still show that Option as its current value when I
    edit the entry, so that editing the old entry's date or note does not
    break the picker or silently change the Option.

### Consistency and scope

23. As a member of the Household, I want the same picker for adding a Dinner,
    editing a Dinner, and adding or editing a Rejection, so that the Log
    behaves consistently wherever an Option is chosen.
24. As a member of the Household, I want the editing form to open with the
    entry's current Option already selected, so that I only change what I mean
    to change.
25. As a member of the Household, I want adding a Dinner blocked with an
    inline "Pick an Option" error if I submit without choosing one, so that I
    cannot create an entry with no Option.
26. As a member of the Household, I want adding a Rejection blocked the same
    way if no Option is chosen, so that a Rejection always names an Option.
27. As a member of the Household, I want the Log's existing date field, note
    field, and inline edit/delete behavior unchanged, so that only the Option
    picker is different.
28. As the Household's administrator, I want the picker to work whether or not
    AI search is configured, so that it is available on a deployment with no
    API key.

## Implementation Decisions

### New shared module — `OptionCombobox`

A new shared client component is the type-ahead Option picker. It is
hand-rolled with no third-party library, following the combobox pattern the
app already uses for `TagInput`: a `role="combobox"` input with
`aria-expanded` / `aria-controls` / `aria-autocomplete`, a `role="listbox"`
dropdown of `role="option"` rows, and the `onMouseDown` + `preventDefault`
technique to commit a pick before the input's blur fires.

- **Interface:** the list of Option choices, the current value (an Option id
  or none), an `onChange` callback receiving the chosen Option id, a
  placeholder, and an `id` for label association.
- **Owns:** open/close state, the filtered list, the keyboard active-index,
  and blur-reconcile to the last valid pick.
- The filtering and active-index logic is **inlined** into the component — not
  extracted into a separate pure module.

### Combobox behavior

- Opening the picker shows the full list of Active Options.
- Filtering is **case-insensitive substring** matching, consistent with how
  `TagInput` filters its suggestions.
- The list is **flat and alphabetical** — no Home meal / Restaurant section
  grouping. Each row carries a per-Option **kind** indicator, consistent with
  how Tonight rows already signal kind.
- Keyboard: ↑/↓ moves a highlighted active-index through the filtered rows,
  Enter selects the highlighted Option, Escape closes the list; the
  highlighted row is tracked with `aria-activedescendant`.
- The input is an editable combobox: after a pick it holds the Option's name;
  re-focusing it re-opens the list for another search; a clear ("×") control
  resets the pick; on blur with unmatched text the field reconciles back to
  the last valid pick.
- A "No matches" row is shown when the typed text matches no Option. There is
  **no** "create" affordance — this is choosing existing Options, not Catalog
  editing.
- **Mobile:** the picker is a standard combobox — focusing the input opens the
  list and the device's soft keyboard. There is no custom two-stage picker
  that suppresses the keyboard.

### `getOptionChoices()` returns Active Options only

`getOptionChoices()` in the queries layer is changed to return **Active
Options only**. It currently returns every Option, Active and Archived alike,
so that the dinner edit form can display an Archived current value. That is no
longer needed: the edit form seeds the picker's displayed name from the Log
entry's own Option name, so the query no longer needs to carry Archived rows.

### The Log's Option pickers adopt the combobox

Every place an Option is picked on the Log replaces its `<select>` with
`OptionCombobox`. There are four such scenarios across three form components:

- **Add a Dinner** and **Edit a Dinner** are two separate forms.
- **Add a Rejection** and **Edit a Rejection** share one form component (and
  one Option `<select>`); replacing the picker there covers both.

The **add** scenarios open with no Option selected and gain a "Pick an Option"
inline-validation branch alongside the existing date check; submit is blocked
until an Option is chosen. The **edit** scenarios pre-fill the picker with the
entry's current Option (by id), seeding the displayed name from the Log entry
or Rejection itself.

For an edited Dinner whose Option is now Archived, the picker shows that
Option as the current value but it is absent from the list; switching away
from it cannot be undone within the picker, and Cancel restores it. Editing a
Rejection has no such case — the Log surfaces only Rejections of Active
Options.

### No change below the UI

There is no schema change and no migration. The ranking, the Score, AI search,
and the Log/Rejection server actions are untouched — each action still
receives an Option id; only how that id is chosen in the UI changes. Visual
styling is `DESIGN.md`'s call; this PRD fixes the control's behavior and
structure, not its styling.

## Testing Decisions

A good test exercises a module's **external behavior** through its public
interface — given these inputs, expect this output — and never asserts on
internal structure, so it survives a refactor. Framework: **Vitest** with
React Testing Library, as in the existing suites. No live Anthropic call is
made in any test.

**Tested module — `OptionCombobox` (React Testing Library component tests).**
Prior art: `app/tonight-screen.test.tsx`, which renders a client component and
asserts on rendered output and interaction. Behaviors covered:

- Opening the picker shows every Active Option.
- Typing substring-filters the list.
- ↑/↓ moves the highlight and Enter selects the highlighted Option.
- Escape closes the list; clicking a row selects that Option.
- The "×" control clears the current pick.
- Typing an unmatched string and then blurring reconciles the field back to
  the last valid pick.
- A "No matches" row renders when nothing matches.
- Archived Options never appear in the list.

**Not tested.** The Log forms get no dedicated new tests — they are thin
wiring around the combobox, consistent with the house posture that UI
components get no dedicated tests (the `dated-rejections` PRD); the
empty-initial-state and the "Pick an Option" validation are simple enough to
verify by hand. `getOptionChoices()` is exercised through the screens that
render it. No new server-action tests — the actions are unchanged.

## Out of Scope

- **Creating a new Option from the picker** — this is choosing existing
  Options for a Log entry, not Catalog editing. No "create" row, no inline
  Option creation.
- **The Tonight ranked picker** — Tonight stays a ranked, one-tap pick list;
  this PRD changes only the Log's Option selectors.
- **Smart ordering of the list** (recency- or frequency-weighted) — the list
  is flat alphabetical by decision. The app is variety-driven, so the Dinner
  being logged is by design *not* something eaten recently; a recency sort
  would bury the likely pick.
- **A custom mobile picker that suppresses the soft keyboard** — the
  two-stage, native-picker rebuild was considered and declined; standard
  combobox behavior is accepted.
- **Home meal / Restaurant section grouping** in the list — replaced by a flat
  list with a per-row kind indicator.
- **Re-picking an Archived Option after switching away mid-edit** — a
  near-zero scenario; Cancel covers it.
- **Extracting the filter / keyboard logic into a separate pure module** — it
  is inlined into `OptionCombobox` by decision.
- **Any schema, migration, ranking, Score, AI search, or server-action
  change.**

## Further Notes

- This builds on the Log forms delivered in `pick-me-a-dinner-v1` and
  `dated-rejections`. The combobox follows the existing `TagInput` pattern
  (the catalog Tag autocomplete) — the app's established way to hand-roll an
  accessible combobox with no library.
- The per-row kind indicator should reuse the Tonight rows' existing
  kind-signalling treatment rather than inventing a new one.
- `docs/adr/0007-expose-every-sensible-control.md` motivates using one shared
  control across all three Log forms rather than changing one and leaving the
  others on a native `<select>`.
- No `CONTEXT.md` or ADR change is needed — the domain vocabulary is unchanged
  and the work introduces no new architectural decision.
- Files this PRD is expected to touch: a new `OptionCombobox` component and
  its test file, `db/queries.ts` (`getOptionChoices`), `app/log/log-screen.tsx`
  (the add-a-dinner form), `app/log/log-entry-row.tsx` (the edit-a-dinner
  form), and `app/log/rejection-row.tsx` (the shared rejection add/edit form).
