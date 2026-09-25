# Design System — Pick Me a Dinner

The canonical visual system. Code, components, and review follow this file;
where code and this file disagree, one of them is a bug — fix it and update
this file in the same commit. Tokens live in `app/globals.css` (light + dark)
and are mirrored in `tailwind.config.ts`.

This file states the current system and the reason behind each rule. How it
got here lives in `git log -- DESIGN.md`; the last version carrying the full
dated Decisions Log is `git show 3059012:DESIGN.md`. The 2026-09-21 audit is
`docs/design-review-2026-09-21.md`.

## Direction

- **Product:** a personal web app that helps one household (one shared
  password, no accounts) decide what's for dinner — a ranked, explained list
  of dinner Options. Used on a phone in the kitchen and on a desktop. Next.js
  App Router + Tailwind.
- **Memorable thing: a sharp instrument** — dense, precise, confident; a tool
  that does one job. Peers are Linear, Things, transit arrival boards, dense
  data tables — not consumer recipe apps.
- **Aesthetic:** industrial / utilitarian, leaning *field instrument*.
  Typography and hairline rules do all the work: flat surfaces, no shadows,
  no cards, no nested surfaces, no icons-in-circles, no decorative imagery.
  Quiet, dense, slightly austere — built by someone who uses it at 5:37pm.
- **Interaction principle (ADR-0007):** every place an item is shown carries
  every control that makes sense for it; no screen assumes intent. The only
  bound is screen space, and where a row can't fit every control the cut is
  deliberate. This governs control *placement*; the sections below govern
  how controls look.

## Typography

All three faces are self-hosted via `next/font` (Fraunces from
`next/font/google`, Geist / Geist Mono from the `geist` package), exposed as
CSS variables on `<html>` in `app/layout.tsx`.

- **Display — Fraunces.** Screen titles and the Option name only. The single
  deliberate note of personality; never body or UI text.
- **Body / UI — Geist.** Tags, buttons, labels, body copy, form fields.
- **Data — Geist Mono** with `tabular-nums`. Numerals and dates only (rank,
  dates, every numeral in the Affinity/Recency/Tag chips) so numbers align
  down a column. Never whole sentences.

| Token | Face / size / weight | Used for |
|---|---|---|
| `h1` | Fraunces 600, **22px phone / 28px ≥720px** | Screen title |
| `name` | Fraunces 500, 18px | Option name |
| `body` | Geist 400, 15px / 1.5 | Body copy; also the `html` root size |
| `chip` | Geist 13px (mono numerals 13px) | AI rationale line, inline errors, Reject reason text |
| `meta` | Geist / Geist Mono 12px | Tags, rank, dates, secondary labels, and the Affinity/Recency/Tag chip badges |

Emphasis weight is 600. `h1` is the one breakpoint-dependent type token: on
Tonight it shares a phone row with the day stepper (~205px of a 343px row),
and "Wednesday" only fits un-ellipsized at 22px.

## Color

Functional color on a cool-neutral base. Color does two jobs on every dinner
row — it codes **meal kind** and maps the **heatmap** — and everything else
stays neutral so those signals read instantly. Light is the primary theme.

### Two color channels

1. **Meal kind** — a 3px solid bar on the row's left edge (`kind-home` teal,
   `kind-restaurant` plum) over a background of the same hue: the faint
   `kind-*-tint` on picker rows, the stronger `kind-*-wash` on decided rows.
   Home vs out, before reading a word. A row that isn't an Option yet —
   Tonight typeahead's `Add "<query>"…` row — carries a neutral `line` bar
   instead: same 3px inset as every Option row, but it claims no kind.
2. **The green→red heatmap** — green is "good", red is "not now", fading
   through a tan midpoint. `lib/recency-color.ts` interpolates between the
   three `recency-*` anchors with `color-mix()`, saturating at 30 days
   (`RECENCY_COLOR_CAP`). It drives, each by its own value:
   - the **Affinity chip** (first in the chip row, at the fainter Tag-chip
     fill) — by eating *frequency*: frequent green, rare red, ~1.0 tan. The
     preference half of the Score. Still **trialling** — its numeral label
     and whether it earns a permanent slot are open.
   - the **Recency chip** (stronger fill) — by days since last eaten, capped
     at 30: just-eaten green, long-overdue red.
   - each **Tag chip** — by that Tag's own recency, at a fainter fill.

   The chips are readouts, not the row order: Tonight is ordered by
   Score = affinity × readiness, so the list does not run green-to-red.

### Tokens

| Token | Light | Dark | Role |
|---|---|---|---|
| `bg` | `#f3f4f6` | `#1a1c1f` | App background |
| `surface` | `#ffffff` | `#232629` | Content surface, modals, input base, outlined buttons |
| `raised` | `#e8eaed` | `#2c2f33` | Input fill, neutral chip fill, outlined-button hover |
| `ink` | `#25282d` | `#e6e7ea` | Primary text |
| `muted` | `#656970` | `#8b8f98` | Secondary text, dates, rank numbers |
| `line` | `#8a8c8e` | `#383b40` | A control's own border — input, button, popup |
| `divider` | `#b1b3b6` | `#383b40` | Row and section rules |
| `kind-home` | `#2c6e6e` | `#4a9a9a` | Home kind bar, add-meal button, selected Home chip |
| `kind-restaurant` | `#7a4f6b` | `#a87d99` | Restaurant kind bar, add-restaurant button, selected Restaurant chip |
| `kind-home-wash` | `#dde8e8` | `#212e30` | Decided-row / Log-row background, unselected Home chip |
| `kind-restaurant-wash` | `#e7e0e6` | `#2e2a30` | Decided-row / Log-row background, unselected Restaurant chip |
| `kind-home-tint` | `#e8eeef` | `#1e2528` | Picker-row background (wash halved toward `bg`) |
| `kind-restaurant-tint` | `#edeaee` | `#242328` | Picker-row background (wash halved toward `bg`) |
| `recency-overdue` | `#c4453a` | `#d65a4f` | Heatmap red end |
| `recency-mid` | `#c8b78f` | `#bdae89` | Heatmap tan midpoint |
| `recency-recent` | `#3f8a4a` | `#5aa863` | Heatmap green end |
| `action` | `#2c2f36` | `#e6e7ea` | Filled PICK, include Tag chip, focus ring |
| `action-hover` | `#3c4049` | `#d0d2d6` | Filled-action hover / pressed |
| `action-ink` | `#ffffff` | `#1a1c1f` | Label on `action`, `kind-*`, `exclude`, `success` fills |
| `accent` | `#6d4ed6` | `#7a65d1` | AI search button |
| `accent-hover` | `#5c3ec4` | `#7a60e3` | AI search hover / pressed |
| `accent-ink` | `#ffffff` | `#ffffff` | Label on `accent` |
| `success` | `#367740` | `#5aa863` | Confirmation feedback |
| `danger` | `#b84137` | `#de7970` | Destructive actions, errors |
| `danger-wash` | `#f3ddda` | `#33272a` | Rejected-row background |
| `exclude` | `#7d5c46` | (light value) | Exclude-state Tag filter chip |
| `success-wash` | `#dee9db` | `#26312a` | Reserved — nothing renders it |
| `planned` | `#b9822b` | `#cf9a45` | Reserved — nothing renders it |

### Color rules

- **Contrast bar.** Any token rendered as text or as a label on a fill clears
  4.5:1 against what it sits on. `line` clears 3:1 against `bg` (a UI
  component boundary). `divider` sits at ~1.9:1 — rules are decorative
  structure, and at `line`'s weight every list read too heavy. The
  `recency-*` anchors are tuned for translucent chip fills under `text-ink`,
  a different problem, so they move independently of `success` / `danger`.
- **PICK is neutral charcoal** so it never collides with the heatmap.
- **`accent` is the one non-functional color** — the AI search button is
  vivid violet so smart search is unmistakably its own thing, not a second
  PICK. It never appears on a dinner row.
- **Kind hues may extend past the row only to state kind:** the Catalog's
  "Add a meal" / "Add a restaurant" buttons, the Home/Restaurant filter
  chips, and the app icon. Each announces the same fact the kind bar does;
  none carries a heatmap value.
- **Dark theme is derived, not visually verified.** Check it live before
  relying on it; `divider` is not yet split from `line` there, and `exclude`
  has no dark value.

### App icon

The PWA icon (`app/manifest.ts`) is a solid white fork-and-knife on a
two-tone field — `kind-home` teal meeting `kind-restaurant` plum along one
offset diagonal seam that enters the top edge and exits the bottom, leaving
each corner one colour. It is the brand mark for the home-vs-restaurant
duality; keep it rather than "correcting" to a neutral lettermark. The
installed app's chrome (`theme_color`, `background_color`, the `theme-color`
meta) tracks `bg` per theme so the status bar blends into every screen.
Install-as-standalone, no service worker (online-only and auth-gated, so
offline caching only adds stale-cache risk). PNGs under `public/icons/`,
regenerated by `scripts/generate-icons.mjs`.

## Spacing

- **Base unit 4px; density compact.**
- **Scale:** 4 / 6 / 8 / 12 / 16 / 22px (`--space-1` … `--space-5_5`) plus
  the control-height stops 36 / 44px (`--space-9` / `--space-11`). These are
  the only steps.
- **Stay on the scale.** `html` is 15px, so an off-scale Tailwind key
  (`gap-6`, `w-8`, `min-h-14`) falls through to a rem default that silently
  resolves against 15px, not 16px. Use the nearest step, or add a
  px-declared token.

## Radius

Badge/chip 3px (`rounded-badge`); inputs, buttons, and controls 6px. Crisp
corners suit a sharp tool — pill shapes only where a control is genuinely
circular.

## Control height

- **44px floor** (`min-h-11`) for any tappable control where a mis-tap costs
  something — Pick, Reject, Bring back, Remove, Menu/Call/Recipe, form
  controls.
- **Declared in px** in `tailwind.config.ts` because `min-h-*` / `h-*` read
  from `spacing` and the root is 15px: on rem defaults `min-h-11` renders
  41.25px. Add the px token rather than reaching for a rem utility.
- **A 44px target need not occupy 44px of row.** Beside shorter content,
  give the control a negative vertical margin so its hit area overlaps the
  row's padding instead of setting the line height (the decided row's
  "Remove" does this). Only where the overlap lands on padding or
  non-interactive content.
- **Exceptions.** Each is licensed for *that* control only, and each shares
  the same test: space is genuinely binding *and* a mis-tap is free —
  visible, instantly reversible, writes nothing.

  | Control | Size | Why |
  |---|---|---|
  | Tonight header day stepper (‹ date ›) | 36px (`h-9`) | Shares a phone row with the H1; every pixel returned keeps the day name un-truncated. Re-measure the header before changing (ADR-0009). |
  | Tonight filter chips (Home/Restaurant, Tags) | ~21px, `meta` | ~20 tags need density; a mis-tap only re-filters and the next tap undoes it. |
  | Restaurant form Closed-day toggles `S M T W T F S` | fill one row evenly; measure at 375px | Seven 44px targets overrun 375px, and wrapping destroys the week-shape the control is read by. Writes nothing until save. |
  | Picker row's Last note line | sized to text (~16px) | Tapping only expands text; 44px per noted row would spend the height the single line protects. |
  | Decided row's click-to-edit note line | 36px (`min-h-9`) | Opens an editor Cancel closes, and is already full-bleed. |

## Layout

- **Structural responsive shift**, not just a wider column, at the 720px
  `desktop:` breakpoint (`app/app-nav.tsx`).
  - **Mobile (<720px):** one centered column, max-width 560px; bottom tab
    bar Tonight / Log / Catalog.
  - **Desktop (≥720px):** a persistent ~200px left rail holds the same nav;
    content column max-width 900px.
- **Row lists.** Rows with a kind tint or wash background (Tonight picker,
  Closed disclosure, decided block, Log entry/rejection rows on the Log and
  the Option detail page's History) are separated by a 2px sliver of `bg`
  (`gap-[2px]`), because the background plus kind bar already edge the row.
  Untinted rows on plain `bg` (Catalog lists, Rejected disclosure, the
  detail page's Field list) keep a 1px `divider` rule. Section rules (e.g.
  the Log's day separator) are 1px `divider`.

### Tonight row anatomy

A flat, uniform ledger — every row the same height, no lead-item prominence,
no collapsed long tail. This uniformity is locked.

- 3px kind bar flush left over the row's `kind-*-tint` background (a step
  below the decided block's wash, so the block still reads as the settled
  panel). Picker rows use 10px vertical padding.
- Rank numeral in Geist Mono `muted` in a `w-6` gutter; Option name in
  Fraunces, uncolored.
- Directly under the name, the **chip row**: Affinity, Recency, then one chip
  per Tag — `rounded-badge` pills tinted per "Two color channels". The chip row
  always sits on its own line under the name at every width, so chip order
  and position never move.
- **PICK** is a filled `action` button; Reject is secondary. Stacked on
  phones; past **900px** PICK moves to the row's right edge and Reject to its
  left. The swap waits for 900px, not 720px, because right after the 720px
  step the rail takes ~200px and the column is briefly narrower than its
  mobile cap — going denser at that same point squeezes the row twice.
- **AI search rows** carry the model's rationale line (`chip` size) on a
  `raised` surface in place of the Last note.

### Last note line

A picker row whose Option has a Last note carries one extra muted line under
the chip row: age then text (`18d · got the katsu curry`).

- **One line, ellipsized** — the bounded exception to uniform row height
  (rows differ by at most one line, only when a note exists). Keep it a
  single line; a longer note is read by tapping the line (it expands, and has
  a `title` for desktop hover) or on the Option detail page.
- **`truncate`, not `line-clamp-1`:** the line is a `<button>`, which
  blockifies its inner display and defeats the clamp's `-webkit-box`, so long
  notes silently wrap. Check the rendered height, not the class list.
- **Density:** `leading-tight`, 4px gap above, 8px indent — both funded out
  of row padding. It should cost a noted row ~18px at most and usually
  nothing (the Pick/Reject stack already floors the row). A noted row
  visibly taller than a note-free one is a regression.
- **Italic**, age and text alike, wherever Tonight shows it: reported speech
  from another night, marked as an aside without another size or color step.
  The one place a mono numeral slants.
- AI search rows omit it — the rationale line is already the row's aside.

### Tonight filter zone

Tonight's sticky filter zone holds every filter on one `flex-wrap` line:
Home and Restaurant chips first, then one chip per Tag. Both groups'
`role="group"` wrappers are `display: contents`, so every chip is a flat
sibling and any wrapped line reclaims the full row width.

- **Kind chips** are plain on/off toggles; none selected means all kinds.
  Tapping the active one clears it, tapping the other switches. Unselected:
  `kind-*-wash` fill, `ink` text. Selected: `kind-*` fill, `action-ink` text,
  underlined.
- **Tag chips** cycle off → include → exclude → off. Off: `raised`, `ink`.
  Include: `action` fill, `action-ink`, underlined. Exclude: `exclude` fill,
  `action-ink`, struck through. The underline/strikethrough keeps state
  legible without color; every state carries a transparent-or-matching
  `border` so toggling never changes width; the accessible name announces
  the state ("pasta, included").
- The filter hint line shows only while a Tag filter is on; otherwise it is
  `sr-only` (still a live region, so kind changes are announced).
- The Tonight header is just the H1 and the day stepper — ‹, date input, ›
  joined flush inside one shared 1px `line` border.

### Decided block

"Tonight's dinner" is a settled panel above the ledger, not a ledger to
scan, so row heights may vary.

- Each row's background is its `kind-*-wash`.
- The Option's Last note shows **in full** on its own line between the chip
  row and the editable note, labelled inline (`Last time (18d): got the
  katsu curry`) so it doesn't read as a duplicate of the editable note. It
  hides while the note editor is open, as Menu/Call/Recipe do.
- Still tight: 10px padding, 4px between lines; "Remove" uses the
  negative-margin trick; the note line is 36px (see Control height).
- Menu / Call / Recipe are secondary outlined buttons.
- A Restaurant picked from the Closed disclosure is not marked as closed
  here — the call has been made.

### Closed disclosure

Restaurants whose Closed days include the Selected day drop out of the
ranked list into a collapsed disclosure at the foot of Tonight, **below**
the Rejected disclosure (Rejected holds the time-sensitive undo). Heading
"Closed tonight (N)" / "Closed on Friday (N)", matching its sibling's casing
and day-aware copy exactly.

- Rows are the **full picker row** — same component, chips, Last note, Pick
  and Reject. A closure is the app's best information, not a veto; the
  Household may know better than the data.
- Alphabetical, so **no rank numeral** — but the `w-6` gutter still renders
  empty to keep names on the picker's vertical.
- No per-row closure label: the heading already says why, and an untinted
  label chip would sit among heatmap chips. The full Closed-day set lives on
  the Option detail page.
- A row Rejected here moves to the Rejected disclosure.

### Button hierarchy

- **Filled `action` PICK only on Tonight's ranked rows** (including the
  Closed disclosure's rows) — the screen's one true primary action.
- **Repeated per-row actions everywhere else** — PICK on Catalog, Log, and
  the Option detail page; the decided block's Menu/Call/Recipe; the Log's
  top "+ Dinner / + Rejection" pair — use the **secondary outlined** style:
  `surface` fill, `line` border, `ink` label, `raised` on hover. A column of
  identical filled buttons leaves the primary nothing to stand out against.
- The Log's per-day add buttons are borderless and unfilled until hovered.
- Not row actions, so they stay filled: a form's Save/Add submit, a toggle's
  selected state (Closed-day chips, filter chips), the AI search button, and
  the Catalog add buttons.

### Focus

A 2px `action` ring, from the shared constants in `app/focus-ring.ts` — use
those rather than local copies. Buttons use `focusRing` (`outline-offset-2`).
Text-entry fields (inputs, textareas, the combobox, the date input) use
`fieldFocusRing` (`outline-offset-[-1px]`): a field matches `:focus-visible`
on ordinary taps too, and an offset ring drew a second box outside its
border.

## Motion

Minimal-functional — only transitions that aid comprehension. No bounce, no
scroll choreography, no elastic.

- **Durations:** micro 80ms (hover/press), short 140ms (state change),
  medium 220ms (inline expand) — `--motion-*`.
- **Easings:** `ease-enter` (ease-out-quart, decelerates in), `ease-exit`
  (ease-in), `ease-move` — `--ease-*`, exposed as Tailwind utilities.
  `ease-exit` and `ease-move` are reserved; nothing uses them yet.
- **Inline expand:** a freshly-mounted conditional block (Reject reason box,
  a disclosure body, an inline edit form, the decided row's note editor, an
  armed confirm pair, the newly decided row, Pick's "Logged ✓") fades and
  slides up 4px over `motion-medium` / `ease-enter` via `.expand-in` in
  `app/globals.css` (CSS `@starting-style`, no JS). Apply it only to
  elements genuinely new in the DOM. **No height grow** — it needs
  `overflow: clip`, which cuts off focus rings inside the block. **Exits
  snap** — no delayed-unmount machinery.
- **Press feedback:** filled buttons (Tonight Pick, AI search, Catalog add
  buttons, form submits) scale to 0.98 on `:active` over `motion-micro`,
  alongside their hover shade (`app/press-feedback.ts`). Outlined and text
  buttons change color only. Never scale anything that moves layout.
- **Row moves snap.** A Pick or Reject moves the row between lists in one
  frame; only the arrival gets `.expand-in`. List membership is
  server-driven (`revalidatePath` in `pickTonight` / `rejectOption`) and Next
  exposes no hook for "the refreshed RSC tree has committed", so a View
  Transition can't be resolved cleanly. Revisit if React's
  `<ViewTransition>` reaches stable, or if Tonight's rows move to client
  state.
- **Reduced motion:** `.expand-in` drops to opacity only; press scale is
  cancelled per button via `motion-reduce:`.
- **Destructive actions** confirm inline (the row reveals Cancel · action in
  place, `ConfirmPair`), never in a modal.

## Open threads

- Verify the dark theme live; then split its `divider` from `line` and give
  `exclude` a dark value if needed.
- Decide whether the Affinity chip (and its numeral label) stays.
- `success-wash` and `planned` are reserved — use or remove them.
- Animated row moves are waiting on stable `<ViewTransition>` (see Motion).
