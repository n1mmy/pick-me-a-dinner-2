# Design System — Pick Me a Dinner

The canonical visual system. Code, components, and review must follow this
file. The typography, spacing, layout, and motion sections were implemented
in code on 2026-05-16; the Color section was revised on 2026-05-17 via
`/design-shotgun` and implemented in code the same day (see "Implementation
note" below). Audited against the code again on 2026-09-21
(`docs/design-review-2026-09-21.md`) and corrected where this file had
drifted; the Layout section's desktop Tonight-row treatment (the audit's one
open gap) was subsequently built and this file updated to match.

## Product Context

- **What this is:** A personal web app that helps one household decide what's
  for dinner each night — a ranked, explained list of dinner Options.
- **Who it's for:** A single household. No accounts, one shared password. The
  owner uses it on a phone in the kitchen and on a desktop.
- **Space/industry:** Personal/bespoke utility. Deliberately *not* a consumer
  recipe app — the honest peers are precise personal instruments (Linear,
  Things, transit arrival boards, dense data tables).
- **Project type:** Data-dense web app (Next.js App Router + Tailwind).

## Memorable Thing

**A sharp instrument** — dense, precise, confident. A sharp tool that does one
job. Every decision below serves this: density without clutter, precision in
the numbers, and functional color so the dense list parses at a glance.

## Aesthetic Direction

- **Direction:** Industrial / utilitarian, leaning *field instrument*.
- **Decoration level:** Minimal — typography and hairline rules do all the
  work. No shadows, no cards, no nested surfaces, no icons-in-circles, no
  decorative imagery.
- **Mood:** Looks like it was built by someone who actually uses it at 5:37pm.
  Quiet, dense, slightly austere — the relief of a tool that is just *right*
  rather than trying to delight.

## Interaction principle

Every place an item is shown carries every control that makes sense for that
item — the Household flows through the app freely and no screen assumes
intent. The only bound is screen space: where a row cannot fit every control,
the cut is deliberate. See ADR-0007. This governs control *placement*; the
visual sections below govern how those controls look.

## Typography

All three faces are free, open-source, and loaded via `next/font` (self-hosted,
no CDN, no layout shift).

- **Display — Fraunces.** Screen titles and the dinner-Option name. A warm
  modern serif with optical sizing. This is the single deliberate note of
  personality — used at display sizes only, never for body or UI text.
- **Body / UI — Geist.** Tags, buttons, labels, body copy, form fields. Tight
  grotesque engineered for product UI; ships with Next.js, so it is maximally
  proven for this stack.
- **Data — Geist Mono**, with `font-variant-numeric: tabular-nums`. Rank
  numbers, dates, and every numeral in a Tonight row's Affinity, Recency, and
  Tag chips ("18" in the Recency chip's "18d"). The mono is the instrument
  readout — it makes numbers align to the pixel down a column. Use it for
  numerals and dates only, not whole sentences.
- **Scale** (px):
  - `h1` screen title — Fraunces, weight 600; **22px on phones, 28px from the
    720px breakpoint up**. The Tonight header sets the floor: its H1 shares a
    row with the Selected-day stepper, whose native date input is wide and
    sized inconsistently across browsers. Even compacted, the stepper spends
    ~205px of a 343px phone row, leaving ~130px for the day name — and the
    longest one, "Wednesday", measures 154px at 28px and 134px at 24px (both
    ellipsize) against ~122px at 22px. This is the one type token that varies by
    breakpoint, alongside the column width.
  - `name` Option name — Fraunces, 18px / weight 500
  - `body` — Geist, 15px / weight 400 / line-height 1.5
  - `chip` secondary UI text at chip scale — Geist 13px (numerals in Geist
    Mono 13px). This is the AI search rationale line's size, plus other
    small-but-not-smallest copy (inline errors, "Reject" reason text). It is
    **not** the size of the Affinity/Recency/Tag chip badges on a Tonight
    row — those render one step down, at `meta`.
  - `meta` tags, rank, dates, secondary labels, and the Affinity/Recency/Tag
    chip badges — Geist / Geist Mono 12px
  - emphasis weight — 600

## Color

- **Approach:** Functional color on a cool-neutral base. Color is no longer
  rare — it does two specific jobs on every dinner row: it codes *meal kind*
  and it maps *recency*. Everything else stays neutral so those two signals
  read instantly. The light theme is primary; dark mode is a derived theme
  (below). Revised 2026-05-17 via `/design-shotgun` (see Decisions Log) — the
  Tonight screen was the explored canvas; the same tokens propagate to the
  other screens.

### Color channels

A Tonight row carries the meal-kind bar plus the green→red heatmap, the latter
now driving **two** per-Option chips (Affinity and Recency) that encode the two
halves of the Score. (Through 2026-06-16 this was "exactly two channels", kind +
recency; the Affinity chip was added 2026-06-17 alongside the affinity-ranking
work — see the Decisions Log.)

1. **Meal kind** — a 3px solid vertical bar on the row's left edge, over a
   tint of the same hue as the row's background (faint `kind-*-tint` on
   picker rows, the stronger `kind-*-wash` on decided rows). Teal
   `kind-home` for home-cooked Options, plum `kind-restaurant` for
   restaurants. One calm decision per row: home vs out, before reading a word.
2. **The green→red heatmap** — a continuous scale where green is "good" and red
   is "not now", fading through a muted tan midpoint. It drives three things,
   each by its own value:
   - the **Affinity chip** (first in the chip row, at the *fainter* Tag-chip
     fill so it reads quieter than the louder Recency chip beside it) — by
     *frequency*: a frequently-eaten Option reads green, a rarely-eaten one red,
     ~average (1.0) tan. The preference half of the Score.
   - the **Recency chip** (stronger fill) — by *days since last eaten*, capped at
     30: just-eaten reads green, long-overdue red. A factual freshness readout.
   - each **Tag word** — by that Tag's own recency, at a fainter fill.

   Both chips are *readouts*, not the row order: since 2026-06-17 Tonight is
   ordered by Score = affinity × readiness, so the list no longer runs a clean
   green-to-red top-to-bottom.

### Light theme (primary)

| Token | Hex | Role |
|---|---|---|
| `bg` | `#f3f4f6` | App background (cool grey) |
| `surface` | `#ffffff` | Card-less content surface, modals, inputs base |
| `raised` | `#e8eaed` | Input fill, neutral (non-recency) chip background |
| `ink` | `#25282d` | Primary text |
| `muted` | `#656970` | Tags baseline, dates, secondary text, rank numbers |
| `line` | `#8a8c8e` | A control or box's own border — input, button, popup |
| `divider` | `#b1b3b6` | Row and section dividers — lighter than `line`, a decorative rule rather than a UI component boundary |
| `kind-home` | `#2c6e6e` | Meal-kind left bar — home-cooked (teal) |
| `kind-restaurant` | `#7a4f6b` | Meal-kind left bar — restaurant (plum) |
| `kind-home-wash` | `#dde8e8` | Decided-row background — much-lighter home wash |
| `kind-restaurant-wash` | `#e7e0e6` | Decided-row background — much-lighter restaurant wash |
| `kind-home-tint` | `#e8eeef` | Picker-row background — the home wash halved toward `bg` |
| `kind-restaurant-tint` | `#edeaee` | Picker-row background — the restaurant wash halved toward `bg` |
| `recency-overdue` | `#c4453a` | Recency heatmap — red end, long overdue |
| `recency-mid` | `#c8b78f` | Recency heatmap — muted tan midpoint |
| `recency-recent` | `#3f8a4a` | Recency heatmap — green end, eaten recently |
| `action` | `#2c2f36` | PICK button fill (charcoal-ink) |
| `action-hover` | `#3c4049` | PICK hover / pressed |
| `action-ink` | `#ffffff` | Text/label on the PICK fill |
| `accent` | `#6d4ed6` | AI search button fill — vivid violet, set apart from `action` |
| `accent-hover` | `#5c3ec4` | AI search button hover / pressed |
| `accent-ink` | `#ffffff` | Text/label on the `accent` fill |
| `success` | `#367740` | Confirmation, success feedback |
| `success-wash` | `#dee9db` | Reserved — no screen currently renders it; the Log's logged-dinner rows use `kind-home-wash` / `kind-restaurant-wash` instead |
| `danger` | `#b84137` | Destructive actions, errors |
| `danger-wash` | `#f3ddda` | Rejected-row background — much-lighter danger wash |
| `planned` | `#b9822b` | Reserved — no screen currently renders it; the Log's Upcoming section uses `muted` like every other section label |

`recency-overdue` / `recency-mid` / `recency-recent` are the three anchor
stops of a continuous green→red scale that saturates at 30 days; the
implementation interpolates between them, applying the result at low opacity
for Recency chip backgrounds and at higher strength for Tag text. The PICK
button is a neutral charcoal so it never collides with the heatmap.

`muted`, `success`, and `danger` were retuned 2026-09-21 for AA text contrast
(4.5:1 against every surface they render text on) — see the Decisions Log.
`line` was darkened 2026-09-22 from a 1.27:1 hairline (functionally invisible
on a bright kitchen screen) to 3:1 against `bg` — see the Decisions Log. That
same day, `line` was split into `line` (a control's own border) and the
lighter `divider` (row/section rules): 3:1 read as too heavy once it was the
color behind every list divider in the app, not only the one hairline rule
idea #2 measured.

`success` and `danger` no longer share an exact hex with `recency-recent` /
`recency-overdue`: the recency anchors are tuned only for the low-opacity
`color-mix()` chip backgrounds in `lib/recency-color.ts`, which is a different
contrast problem (translucent fill vs. `text-ink`, not solid text vs.
surface), and don't have to move in lockstep with the solid-text tokens.

`accent` is the one deliberate exception to the neutral-everything-else rule:
the Tonight AI-search button is a vivid violet so the smart-search affordance
is unmistakably its own thing, not a second PICK. It is a UI-action accent,
not a third data channel — it never appears on a dinner row, so it does not
compete with the meal-kind or recency signals.

The Catalog's two add buttons ("Add a meal" / "Add a restaurant") are filled
with `kind-home` / `kind-restaurant` respectively — a second sanctioned
extension of the kind hues past the row's left bar, alongside the app icon
below. Unlike `accent` this *is* the kind-coding rule reapplied, not a new
channel: the button announces which kind it adds, the same fact the bar
announces on a row. It never collides with the heatmap because it never
carries a recency value.

The earlier excluded-tag-filter chip token (`exclude`) is carried over from
the prior warm system. The Tonight tag filters got their own visual pass
2026-09-24 (see "Button hierarchy" and the Decisions Log): the chips lost
their borders, but `exclude`'s hex was not part of that pass and was
re-measured, not retuned — its `action-ink` label still clears 4.5:1 against
it, so the carried-over warm brown stands as-is.

### App icon

The home-screen / install icon (PWA — `app/manifest.ts`) is a solid white
fork-and-knife on a two-tone field split by a single offset diagonal seam:
deep teal `kind-home` (`#2c6e6e`) meeting muted plum `kind-restaurant`
(`#7a4f6b`). This is a **deliberate, sanctioned extension of the two kind
hues** beyond their meal-kind row role into brand identity: the split nods to
the app's home-cooked-vs-restaurant duality, and the cutlery reads as
"dinner" at a glance. It does not break the rule above — the kind hues still
carry no *recency* data outside a dinner row (the Catalog add buttons above
reapply the kind-coding itself, not a new signal); the icon is chrome, seen
only on the OS home screen. The seam is offset so it clears every corner
(enters the top edge, exits the bottom), leaving each corner in one colour.
Do not "correct" it back to a neutral lettermark.

The *installed app's* system chrome deliberately does **not** follow the icon:
the manifest `theme_color` / `background_color` and the `theme-color` meta
track the app `bg` (cool grey, per theme) so the status bar blends into the
top of every screen instead of flashing the icon's saturated hues. Teal/plum
is the identity mark only. The app is install-as-standalone with no service
worker (online-only, auth-gated — offline caching would only add stale-cache
risk).

Icons are committed PNGs under `public/icons/` (192 / 512 / 512-maskable / 180
apple-touch), regenerated by `scripts/generate-icons.mjs`.

### Dark theme

Derived from the light theme — cool dark surfaces, the same kind / recency /
action hues lifted for contrast. **Derived, not yet visually verified** —
check before relying on it.

| Token | Hex |
|---|---|
| `bg` | `#1a1c1f` |
| `surface` | `#232629` |
| `raised` | `#2c2f33` |
| `ink` | `#e6e7ea` |
| `muted` | `#8b8f98` |
| `line` | `#383b40` |
| `divider` | `#383b40` — not yet split from `line`; see the "not yet visually verified" note above |
| `kind-home` | `#4a9a9a` |
| `kind-restaurant` | `#a87d99` |
| `kind-home-wash` | `#212e30` |
| `kind-restaurant-wash` | `#2e2a30` |
| `kind-home-tint` | `#1e2528` |
| `kind-restaurant-tint` | `#242328` |
| `recency-overdue` | `#d65a4f` |
| `recency-mid` | `#bdae89` |
| `recency-recent` | `#5aa863` |
| `success` | `#5aa863` |
| `success-wash` | `#26312a` |
| `danger` | `#de7970` |
| `danger-wash` | `#33272a` |
| `action` | `#e6e7ea` |
| `action-ink` | `#1a1c1f` |
| `accent` | `#7a65d1` |
| `accent-hover` | `#7a60e3` |
| `accent-ink` | `#ffffff` |
| `planned` | `#cf9a45` |

`action-hover` is derived (absent from this table; `#d0d2d6` in code). `danger`
and `accent` were retuned 2026-09-21, same as the light theme above: dark
`danger` (`#d65a4f`, `recency-overdue`'s exact hex) failed 4.5:1 as text on
`surface` at 3.94:1, and dark `accent` failed 4.5:1 under its own white
`accent-ink` label at 3.63:1. `success` is unchanged from `recency-recent` and
passes as both text and (paired with `action-ink`, not `accent-ink`) a filled
button label — see the AI search "done" badge note in
`docs/design-review-2026-09-21.md`.

## Spacing

- **Base unit:** 4px.
- **Density:** Compact. Tonight rows use ~10–12px vertical padding so more
  Options are visible per screen without scrolling.
- **Scale:** 4 / 6 / 8 / 12 / 16 / 22px (`--space-1` through `--space-5_5` in
  `app/globals.css`), plus the two control-height stops 36 / 44px
  (`--space-9` / `--space-11`, see "Control height" below). These are the only
  steps on the scale — a class using an off-scale spacing key (e.g. `gap-6`,
  `w-8`, `min-h-14`) falls through to Tailwind's rem-based default, which
  silently resolves against this project's 15px root rather than the usual
  16px (see "Control height" below for the same footgun on control-height
  utilities). Reach for the nearest on-scale step, or add a new px-declared
  token, rather than an arbitrary Tailwind default.

## Layout

- **Approach:** Hybrid — a disciplined ledger grid with a real responsive
  *structural* shift between mobile and desktop (not just a wider column).
- **Mobile (< 720px):** Single centered column, max-width 560px. Bottom tab
  bar: Tonight / Log / Catalog. Tonight rows are two-line — rank + Option name +
  chip row on the first line group, Pick + Reject on the row.
- **Desktop (≥ 720px):** Bottom tab bar is replaced by a persistent left rail
  (~200px) holding the same nav. Content column to its right, max-width 900px.
  Tonight rows keep the same rank + name + chip-row layout as mobile: the chip
  row (Affinity, Recency, then one chip per Tag) always sits on its own line
  below the name, never merged onto one line, so chip order and position
  never move between widths. PICK and Reject swap places once the viewport
  clears 900px — deliberately past the rail's own 720px breakpoint, not at
  it, because the rail's ~200px and the column's wider max-width land at the
  same 720px step; right after that step the column is briefly narrower than
  its mobile cap, and a row that went denser at that exact point would be
  squeezed twice at once. Past 900px PICK moves to the row's right edge,
  Reject to its left.
- **Tonight row anatomy:** A flat, uniform ledger — every row the same
  height, no cards, no shadows. Rows are separated by a 2px sliver of `bg`
  (`gap-[2px]` on the list, not a `divider` rule — 2026-09-24 amendment,
  below) since every row already carries a kind tint or wash background; a
  1px `divider` rule between two tinted rows read as a redundant, heavy
  seam. This applies to every tinted row list in the app — Tonight's picker
  and Closed-disclosure rows, the decided block, and the Log's entry/
  rejection rows (Log screen and the Option detail page's History section)
  — and *not* to untinted rows on plain `bg` (Catalog's active/archived
  lists, the Rejected-tonight disclosure, the detail page's Field list),
  which keep the 1px `divider` rule as their only separator. A 3px vertical
  meal-kind bar (`kind-home` / `kind-restaurant`) sits flush on the row's left
  edge, over a faint tint of the same hue (`kind-home-tint` /
  `kind-restaurant-tint`) as the row's background — deliberately a step below
  the decided block's wash. Rank number in Geist
  Mono `muted`. Option name in Fraunces, uncolored. Directly under the name
  sits the chip row — Affinity, Recency, then one chip per Tag, each a small
  `rounded-badge` pill tinted on the shared green→red heatmap (green = good:
  recent, or frequent for Affinity; red = not now: overdue, or rare for
  Affinity — see "Color channels" above, which is this section's source of
  truth for the chip system). PICK as a filled `action` (charcoal-ink) button
  with `action-ink` label — Tonight's ranked rows are the one place PICK is
  filled; everywhere else it is the secondary outlined style (see "Button
  hierarchy" below). The uniform flat list remains intentional and
  locked — no lead-item prominence, no collapsed long tail. (2026-09-22: a
  faint per-row kind tint replaced the earlier "no per-row background tint"
  rule — paler than the decided block's wash, so the block still reads as
  the settled panel.)
- **Last note line (2026-09-10 amendment to row anatomy):** a picker row whose
  Option has a **Last note** carries one extra muted line under the chip row —
  the note's age then the note text (`18d · got the katsu curry`), held to a
  **single line** with ellipsis. This is a deliberate, bounded exception to
  "every row the same height": rows differ by at most one line-height, only when
  a note exists, and the single line is what keeps the ledger scannable. Rows
  without a note are unchanged. Do not let this grow into a second prose line, a
  two-line clamp, or a per-row expansion that reflows the list — a longer note is
  read by tapping it (below) or on the Option detail page.
  - **AI search rows omit it (2026-09-21 amendment):** an AI search row already
    carries the model's own prose rationale line on its `raised` surface;
    stacking the Last note above it read as two aside lines on one row — too
    busy. An AI row shows the chip row and the AI rationale only, no Last note.
    Deterministic (picker, decided, Closed disclosure) rows are unchanged.
  - **Density (2026-09-10):** the line is a quiet step below and inside the chip
    row, not a paragraph after it — `leading-tight` like the chips, a 4px gap
    above, an 8px indent, and the picker row itself at **10px** padding (the
    tight end of the range below) to pay for that step. It costs a noted row at
    most ~18px, and on most rows nothing at all: the Pick/Reject stack already
    floors the row taller than its content, and the note spends that slack.
    Measured on the real Catalog, noted rows add 2% to the list's height at
    375px and nothing at desktop width. The indent and the gap are not free —
    both are funded out of row padding, so deepening either means finding the
    pixels somewhere else. Anything that pushes a noted row visibly above a
    note-free one has regressed this.
  - **One line means `truncate`, not `line-clamp-1`:** the line is a `<button`
    (it taps to expand), a button blockifies its inner display, and a clamp
    needs `display: -webkit-box` — so `line-clamp-1` is coerced away in Chrome
    and long notes silently wrap to two lines, which is what "one line" exists
    to prevent. This bit once; the class list is not the check, the rendered
    height is.
  - **Italic:** the whole line is italic wherever Tonight shows it — picker row
    and decided block, age and note text alike. It is reported speech from
    another night sitting in a row of live ranking numbers, and the slant marks
    it as an aside without spending another size or color step. This is the one
    place a mono numeral slants: the line is a single aside, and an upright age
    inside it reads as a correction rather than a column to scan. Elsewhere
    mono numerals stay upright.
- **Last-note tap target (2026-09-10 exception to control height):** the picker's
  truncated Last note line is tappable to show the note in full — and carries a
  `title` so a desktop hover shows it too — but is sized to its text (~16px)
  rather than the usual `min-h-11`. The 44px floor guards controls where a
  mis-tap costs something (Pick, Reject, Bring back, Remove); expanding a line
  of text costs nothing and a second tap collapses it. Paying 44px per noted row
  would spend exactly the height the single line was protecting. This exception
  is for *this* control only — it is not licence to shrink row actions.
- **Decided block ("Tonight's dinner"):** each decided row carries a
  much-lighter wash of its meal-kind hue (`kind-home-wash` /
  `kind-restaurant-wash`) as its background — a step stronger than the picker
  rows' `kind-*-tint`, so the decided area still reads as a distinct, settled
  panel above the ledger. (The picker was tint-free until 2026-09-22.)
  A decided row shows its Option's **Last note** in **full** — no truncation, no
  tap target — on its own line between the chip row and the row's editable note,
  labelled inline (`Last time (18d): got the katsu curry`). The label is what
  keeps it from reading as a duplicate of the editable note directly below it.
  Non-uniform decided-row heights are fine: the block is a settled panel, not a
  ledger to scan. While the note editor is open the Last note hides, the same
  way the Menu/Call/Recipe buttons do.
  - **Density (2026-09-10):** a settled panel is not licence to be airy. The
    row's own stack is tight — 10px padding like the picker, 4px between its
    lines — and the two places that were spending height on nothing are fixed
    at the source: "Remove" carries a negative vertical margin so its 44px
    target no longer inflates the title line to 44px for a 27px name, and the
    click-to-edit note line takes **36px** (`min-h-9`) rather than the 44px
    floor. That note line is a documented exception to control height: the floor
    guards controls where a mis-tap costs something, this one opens an editor
    that Cancel closes, and it is already full-bleed horizontally — so 44px
    bought ~19px of empty space around one 13px line, not reach. Menu/Call/
    Recipe are real actions and keep 44px.
- **Closed disclosure (2026-09-19):** the Restaurants dropped from the ranked
  list because the **Selected day** is one of their **Closed days** collect in a
  collapsed disclosure at the foot of Tonight, **below** the Rejected one —
  Rejected holds the time-sensitive undo, so it keeps the closer position.
  Headed "Closed tonight (N)" / "Closed on Friday (N)", matching its sibling's
  casing and day-aware copy exactly; the two sit adjacent, so a mismatch between
  them would be conspicuous.
  - Rows are the **full picker row** — same component, same chip row (Affinity,
    Recency, Tags), same Last note line, same Pick and Reject-with-reason
    controls. A closure is the app's best information, not a veto: the row stays
    first-class because the Household may know better than the data. Stripping
    its chips would make it a lesser visual species, which is the opposite of
    the intent.
  - **No rank numeral, but the gutter is preserved.** The list is alphabetical,
    not ranked — a number here would refer to an order nobody is looking at. The
    `w-6` rank gutter still renders empty so Option names stay on the same
    vertical as the picker's above.
  - **No per-row closure label.** The heading already states why every row is
    there; repeating "closed Sun, Mon" on each row would put a flat untinted
    chip into a row where every other chip is heatmap data. The full Closed-day
    set lives on the Option detail page, which is where you ask a question about
    one Restaurant.
  - A row **Rejected** from here moves to the Rejected disclosure — the same
    row-leaves-on-write feedback the picker already has.
  - A Restaurant **Picked** anyway is never marked in the decided block. The
    call has been made; restating the objection after the fact is nagging.
- **Button hierarchy (2026-09-24):** PICK is a filled `action` button
  (charcoal fill, `action-ink` label) on Tonight's ranked rows only —
  including the Closed disclosure's rows, which reuse the same row
  component. Everywhere else a repeated per-row PICK appears (Catalog, Log,
  the Option detail page), and on the decided block's Menu / Call / Recipe
  row actions, the button uses the secondary outlined style instead:
  `surface` fill, `line` border, `ink` label, `raised` on hover. A form's own
  Save/Add submit button and a toggle control's selected state (e.g. the
  Closed-day chips) are not row actions and stay filled — this rule is about
  a column of *repeated* identical buttons, not every filled button in the
  app.
- **Border radius:** badge/chip 3px, inputs 6px, buttons/controls 6px. Sharp
  crisp corners suit a sharp tool — no pill shapes except where a control is
  genuinely circular.
- **Control height:** 44px is the default minimum for a tappable control
  (`min-h-11`), and the Tonight *row* controls — Pick, Reject, Bring back — keep
  it. **These two stops are declared in px on the spacing scale**
  (`--space-11: 44px`, `--space-9: 36px`, mapped in `tailwind.config.ts`)
  because `min-h-*` and `h-*` read from `spacing`, and `html` is 15px
  (`--text-body`) — on Tailwind's rem defaults `min-h-11` silently renders
  41.25px and `h-9` 33.75px, which is what shipped until 2026-09-10. A control
  stop that is not on the scale is a control stop that is quietly wrong: add the
  px token rather than reaching for a rem-based utility.
  - **A 44px target need not occupy 44px of row.** Where a control sits beside
    shorter content — the decided row's "Remove" next to a 27px Option name —
    give it a negative vertical margin so the hit area still measures 44px but
    overlaps the row's own padding instead of setting the line's height. Only do
    this where the overlap falls on padding or non-interactive content. The **Tonight header** is the deliberate exception at 36px (`h-9`): its
  day stepper, date input, and kind segment share a phone-width row with the H1,
  and every pixel they give back is a pixel the day name keeps un-truncated.
  The gap between the day stepper and the kind segment is 4px rather than the
  usual 6px for the same reason; within each of those two grouped controls the
  ‹/date/›/segment elements sit flush against a shared 1px `line` border or a
  `p-[2px]` track inset instead of a gap (2026-09-24 — see the Decisions Log —
  joining them saved back more width than a 4px gap cost). Don't "restore"
  these to 44px without re-measuring the header — see ADR-0009's 2026-09-08
  amendment.
  - **Closed-day toggles (2026-09-19 exception to control height):** the
    Restaurant form's **Closed days** control is seven toggle chips in one row
    — `S M T W T F S` — sized below the 44px floor, alongside the Tonight
    header's stops. Seven 44px targets plus gaps overrun a 375px viewport, and
    the alternatives both destroy what the control is for: a week is a *shape*
    you recognise at a glance, and wrapping it to two lines or stacking it into
    seven checkbox rows turns recognition into label-reading. The 44px floor
    guards controls where a mis-tap costs something; this one is visible,
    instantly reversible, and writes nothing until the form is saved. Size the
    chips to fill the row's width evenly and measure at 375px — this is an
    exception for *this* control, not licence to shrink form controls generally.

## Motion

- **Approach:** Minimal-functional — only transitions that aid comprehension.
  No bounce, no scroll choreography, no elastic. A sharp instrument does not
  animate for personality.
- **Easing (2026-09-24):** enter `--ease-enter` (`cubic-bezier(0.25, 1, 0.5,
  1)`, ease-out-quart — decelerates into place), exit `--ease-exit`
  (`cubic-bezier(0.5, 0, 0.75, 0)`, ease-in — accelerates away, reserved for a
  future exit treatment; nothing animates an exit yet, see "Inline expand"
  below), move `--ease-move` (`cubic-bezier(0.65, 0, 0.35, 1)` — reserved for
  a future cross-position move, see "Picked/Rejected row move" below).
  Exposed as Tailwind's `ease-enter` / `ease-exit` / `ease-move`.
- **Duration:** micro 80ms (hover/press), short 140ms (state change), medium
  220ms (inline expand, e.g. Catalog edit).
- **Inline expand (P6, 2026-09-24):** a freshly-mounted conditional block —
  the Reject reason box, a Rejected/Closed disclosure body, the Catalog/Log
  inline edit form, the decided row's note editor, an armed confirm pair —
  fades and slides up 4px into place over `--motion-medium` with
  `--ease-enter`, plus a `height: 0 → auto` grow on Chromium (`.expand-in` in
  `app/globals.css`, via CSS `@starting-style` — no JS timing of its own).
  **Exits snap** — no delayed-unmount exit animation; that is machinery this
  app doesn't carry. The technique only ever applies to an element that is
  genuinely new in the DOM (conditional rendering, not a prop/text change on
  an element already on screen).
- **Press feedback (P8, 2026-09-24):** every *filled* button (Tonight Pick,
  the AI Search button, the Catalog add buttons, form submits) scales to 0.98
  on `:active`, alongside its existing hover color shade, over `--motion-micro`
  with `--ease-enter` (`app/press-feedback.ts`). Outlined and text buttons keep
  the color change only — no scale. Nothing that moves layout is scaled.
- **Picked/Rejected row move (P7, 2026-09-24 — spike, fallback taken):** a
  Pick still moves a row from the picker into "Tonight's dinner" in one frame,
  and a Reject still removes a row in one frame — list reordering snaps. A
  `document.startViewTransition` spike to cross-fade/morph the row between its
  picker and decided positions was time-boxed and dropped: the row's list
  membership is server-driven (`revalidatePath` inside the `pickTonight` /
  `rejectOption` actions, resolved through Next's router refresh), and there
  is no public hook for "the refreshed RSC tree has committed" to resolve the
  transition's callback against — closing that gap needs a cross-component
  promise/ref coordinating the triggering row with the parent's prop change,
  which is exactly the "more than a small hook" the plan's fallback
  anticipated. Shipped instead: the newly-mounted decided row and the
  Pick button's "Logged ✓" label both use the `.expand-in` treatment above, so
  the row's *arrival* still reads as a soft entrance even though its *move*
  doesn't. Revisit if React's `<ViewTransition>` (currently canary-only)
  reaches stable, or if Tonight's row membership ever moves to client state.
- **Reduced motion:** `.expand-in` drops to an opacity-only fade (its
  transform/height are simply never interpolated, since
  `@media (prefers-reduced-motion: reduce)` narrows its `transition-property`
  to `opacity`); press feedback's scale is cancelled per button via
  `motion-reduce:` utilities, leaving the color change only. Applies globally,
  `app/globals.css`.
- **Destructive actions** use inline-confirm (the row reveals a confirm/cancel
  in place) rather than a modal — consistent with the plan's §17.

## Implementation note

This system was implemented in the code on 2026-05-16. Fraunces is loaded via
`next/font/google` and Geist / Geist Mono via the `geist` package, all exposed
as CSS variables on `<html>` in `app/layout.tsx`. `app/globals.css` carries the
full light + dark token sets, and `tailwind.config.ts` mirrors them. The
mobile-bottom-nav → desktop-left-rail shift lives in `app/app-nav.tsx` (the
720px `desktop:` breakpoint). All four screens and the loading states consume
the tokens.

**Color revision implemented (2026-05-17):** the cool-grey base, the two
functional channels (the 3px meal-kind left bar and the green→red recency
heatmap), and the charcoal PICK button are all in code. The light + dark token
sets live in `app/globals.css` and `tailwind.config.ts`; the heatmap
interpolation is `lib/recency-color.ts` (a `color-mix()` over the
`--color-recency-*` variables). The Tonight row's kind bar and per-tag/chip
tint are in `app/tonight-row.tsx` (and the decided block in
`app/tonights-dinner-block.tsx`); the per-Option recency that drives the
Recency chip is the `recencyDays` field on `TonightRow`. The dark theme is
derived and was sanity-checked, not exhaustively verified. The tag-filter
chips kept the carried-over `exclude` token and await their own visual pass.

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-16 | Design system created via `/design-consultation` | Memorable thing: "a sharp instrument". Emphasis: data density + ease of use on mobile and desktop. |
| 2026-05-16 | Fraunces (display) / Geist (body) / Geist Mono (data) | Codex and a Claude subagent both independently reached for a serif display; grotesque body chosen over a serif body for legibility in dense lists; mono carries the instrument-readout feel. All free, `next/font`-loadable. |
| 2026-05-16 | Keep the warm §16 palette, refined | Approved in the earlier plan design review. Hairline darkened to `#ded6c8` for crisp rules; added `accent-dark`, `planned` amber, `raised`. |
| 2026-05-16 | Desktop = persistent left rail, not a wider column | User chose to include it: desktop gets its own identity and more density instead of feeling like a stretched phone. |
| 2026-05-16 | PICK = filled clay button; Tonight rows compact | User decisions. PICK is the app's single primary action — must be unmissable; compact density serves the data-density brief. |
| 2026-05-17 | Color system revised via `/design-shotgun`: cool-grey base, two-channel kind-bar + red→green recency heatmap | The prior warm palette read as too monochrome to parse quickly. Six rounds of Tonight-screen mockups; user chose the cool-slate base with teal/plum meal-kind left bars and a red→green recency heatmap on the Explanation chip and per-tag text. PICK moved from clay to neutral charcoal so it never collides with the heatmap's green. Spec only — not yet in code. |
| 2026-05-17 | Interaction principle: expose every sensible control, don't enforce a journey (ADR-0007) | Each item-representation carries every control that makes sense for it, trading off only for space. Surfaced while designing the Option detail page. |
| 2026-05-18 | Added `accent` (vivid violet) for the Tonight AI-search button | User asked for an "exciting" search button distinct from PICK. A dedicated UI-action accent keeps functional color intact — it never lands on a dinner row, so it does not collide with the kind or recency channels. |
| 2026-06-17 | Recency heatmap polarity swapped (green = recent, red = overdue) and the color scale capped at 30 days, not 60 | Once Affinity drives Tonight's order (Score = affinity × readiness), the Recency chip is a factual freshness readout, not a "go ahead" signal — green-for-fresh / red-for-stale reads more naturally, and saturating at 30 days gives the recent end more resolution. Swap done by exchanging the `recency-recent` / `recency-overdue` hex values; `lib/recency-color.ts` caps at `RECENCY_COLOR_CAP = 30`. |
| 2026-06-17 | Added an Affinity chip (first in the chip row) on the same heatmap, tinted by frequency (green = frequent) | Surfaces the preference half of the Score beside the recency half, so the row shows *both* factors behind the order. Reuses the heatmap with an inverted mapping so "good" stays green on both chips. Relaxes the prior "exactly two color channels" rule. **Trialling** — the numeral label and whether it earns a permanent slot are still being eyeballed against real data. |
| 2026-09-19 | Closed disclosure at the foot of Tonight, below Rejected; rows are full picker rows with an empty rank gutter | **Closed days** (ADR-0010) drop a shut Restaurant out of the ranked list, but hiding it outright would remove the Household's ability to overrule wrong data. Full controls keep the row first-class; alphabetical order with no numeral stops a non-ranking from looking like one; the empty `w-6` gutter keeps names on the picker's vertical. |
| 2026-09-19 | Closed-day toggles are seven sub-44px chips in one row | Seven 44px targets plus gaps overrun a 375px viewport, and wrapping or stacking them destroys the week-shape the control is read by. Joins the Tonight header's documented exceptions to the control-height floor: the toggle is visible, instantly reversible, and writes nothing until save. |
| 2026-09-21 | `muted`, `danger`, `success` (light) and `danger`, `accent` (dark) retuned for AA text/label contrast; `DESIGN.md` corrected against the code it had drifted from | A design-intelligence audit (`docs/design-review-2026-09-21.md`) found the Layout section still describing the pre-Affinity-chip "Explanation chip" and plain-text tags (both superseded 2026-06-17 in the Color section only), the documented spacing scale not matching `globals.css`/`tailwind.config.ts`, `planned`/`success-wash` documented as consumed when no screen renders them, and five color tokens failing 4.5:1 in the role they actually render (secondary text, inline errors, a button label). Fixed the drifted doc sections in place rather than re-deriving them from scratch, and retuned only the failing tokens — the recency heatmap anchors (`recency-*`) are untouched, since their contrast problem (a translucent chip fill under `text-ink`) is different from a token used as solid text or a button label. |
| 2026-09-21 | Desktop Tonight row: dropped the single-dense-line / centered Explanation chip; widened the desktop column to 900px; PICK/Reject swap gated behind 900px, not the 720px rail breakpoint | A literal single dense line never fit rows with an Affinity chip, tags, a Last note, or an AI reason, and an earlier attempt to merge the name+chip lines only fit sometimes — depending on name/tag length — so chips inconsistently rode the name's line. Chips now stack under the name at every width, same order and position always. Separately: the rail's ~200px and the column's desktop max-width land at the same 720px step, so right after it the column is briefly narrower than its own mobile cap; letting PICK/Reject go horizontal at that same step squeezed the row twice at once, so that swap was moved to a later 900px breakpoint. |
| 2026-09-22 | `line` (light) darkened `#d8dade` → `#8a8c8e` | `docs/design-review-2026-09-21.md` UX idea #2: the hairline ledger rule measured 1.27:1 against `bg`, near-invisible on a bright kitchen screen. `#8a8c8e` clears 3:1. Dark theme's `line` was left as-is — it wasn't part of the measured finding and dark is separately flagged as not yet visually verified. |
| 2026-09-22 | Split `line` into `line` (light) and a new, lighter `divider` (light) — `#b1b3b6`, ~1.91:1 against `bg` | Direct user report, in light theme: `line`'s 3:1 (above) reads too dark once it is reused for every row/section divider in the app, not only the one hairline rule idea #2 measured. `line` now renders only a control/box's own border (input, button, popup), where the 3:1 UI-component-boundary reasoning still applies; `divider` covers row and section rules, which are decorative structure rather than a UI component boundary, so a lower contrast is appropriate. `divider`'s hex is the exact per-channel RGB midpoint of `line` (#8a8c8e) and the original near-invisible `#d8dade` (1.27:1), per a follow-up user request to land it halfway between the two rather than the initially-picked `#b3b5b8`. Dark theme's `divider` was left equal to `line` (`#383b40`) — dark hasn't been looked at live yet, so there is no finding to split it against. |
| 2026-09-24 | PICK demoted to the secondary outlined style everywhere except Tonight's ranked rows; decided-block Menu/Call/Recipe demoted the same way | `/impeccable` review of the live app: a column of ~20 identical filled charcoal PICK buttons on Catalog/Log, and Menu/Call/Recipe matching PICK's own fill, left the primary action nothing to stand out against. Tonight's ranked-row PICK (the screen's one true primary action) is unchanged; repeated row actions everywhere else read as `surface`/`line`/`ink` instead. Part of the UI smoothness polish plan (P1). |
| 2026-09-24 | Tonight's tag filter chips and the Log's per-day add buttons lose their borders/fills; the top-of-Log add buttons switch to the P1 secondary style | Same `/impeccable` review: ~20 bordered tag chips read as a grid of boxes, and a `bg-raised` + `border-line` "+ Dinner / + Rejection" pair under every day repeated that weight down the page. Tag chips keep their non-color state cues (underline/strikethrough) and tap size; per-day add buttons go borderless/unfilled until hovered; the top-of-screen add pair — the screen's one primary entry point — keeps a border but drops its fill to match PICK's secondary style. |
| 2026-09-24 | Tinted/washed rows (Tonight picker, Closed disclosure, decided block, Log entry/rejection rows) drop their per-row `divider` rule in favor of a `gap-[2px]` sliver of `bg` between rows; untinted rows keep the rule | Same `/impeccable` review: a tinted row already carries a background + a 3px kind bar, so the divider on top read as a third, redundant edge — "rows edged three times" in the diagnosis. The Log's day separator was also thinned from `border-t-2` to `border-t` (still `divider`) so it reads as a section rule, not another row-weight seam. |
| 2026-09-24 | Tonight header's day stepper (‹, date, ›) and kind segment (All/Home/Restaurant) become one joined control each, instead of three separately-boxed elements | Same `/impeccable` review: "header controls drawn as separate boxes" in the diagnosis. The day stepper now shares one outer `line` border with inner 1px separators; the kind segment is one `raised` track with an `action`-filled thumb sliding under the selected label. Both keep their exact 36px header-row height and the header's existing 44px-floor exception (ADR-0009); joining them freed width the day name (measured at 375px) needed. |
| 2026-09-24 | Text-entry fields (inputs, textareas, the combobox, the date input) use `focus-visible:outline-offset-[-1px]`; buttons keep `outline-offset-2` | Same `/impeccable` review: the default offset-2 ring drew a second box 2px outside a field's own border, and — unlike a button — a field matches `:focus-visible` on ordinary mouse/tap focus too, so everyone saw the double box (visible in the Reject reason input at 375px). The ring stays 2px `action` either way; this only moves it onto the field's border. `app/focus-ring.ts` now holds both shared constants (`focusRing`, `fieldFocusRing`), replacing ~15 duplicated local copies. |
| 2026-09-24 | Named `--ease-enter`/`--ease-exit`/`--ease-move` easings added; a freshly-mounted conditional block (Reject box, disclosure body, inline edit form, armed confirm pair) fades + slides up 4px + grows height over `--motion-medium`/`ease-enter` via a shared `.expand-in` CSS class, using `@starting-style` instead of a JS-timed animation | Part of the UI smoothness polish plan (P6, "inline expands open instead of popping" — conditional rendering elsewhere in the app previously popped in with no transition at all). `@starting-style` only fires on an element's first style resolution, so it needs no JS and can't fire on an element already on screen. Exits deliberately still snap — a delayed-unmount exit animation is machinery the plan ruled out. Height grow is Chromium-only progressive enhancement (`interpolate-size: allow-keywords`); other browsers still fade/slide and simply snap the height. |
| 2026-09-24 | Filled buttons (Tonight Pick, AI Search, Catalog add buttons, form submits) get `active:scale-[0.98]` press feedback at `--motion-micro`/`ease-enter`, alongside their existing hover color shade; outlined/text buttons keep the color change only | Plan P8. A tap on a filled button previously gave only a color shade with no tactile confirmation. Shared as `app/press-feedback.ts` rather than duplicated per file, mirroring the `focus-ring.ts` precedent. Reduced motion cancels the scale via `motion-reduce:` utilities per button, leaving color only. |
| 2026-09-24 | P7 (rows move instead of teleporting after Pick/Reject) spike dropped; fallback shipped instead — the picked/rejected row move still snaps, but the newly-mounted decided row and the Pick button's "Logged ✓" label use `.expand-in` | Time-boxed per the plan. A `document.startViewTransition` around the row's cross-list move needs to resolve its callback once the *server-revalidated* RSC tree has actually committed — Next exposes no hook for that moment, so closing the gap would need a promise/ref shared between the triggering row and the parent's prop change: exactly the "more than a small hook" the plan named as the fallback trigger. React's `<ViewTransition>` (canary-only) would solve this properly; revisit if it reaches stable, or if Tonight's row membership ever becomes client state instead of server-derived. |
