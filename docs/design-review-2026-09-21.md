# UI/UX design review — 2026-09-21

A full-surface pass over `app/**`, `app/globals.css`, and `tailwind.config.ts`
against `DESIGN.md`, using the `ui-ux-pro-max` skill's checklists. Contrast
claims are computed WCAG ratios (sRGB relative luminance), not eyeballed.
Findings are grouped into three passes:

- **(a)** token-contrast fixes + `scroll-padding` — small, mechanical, done first ✅ 2026-09-21
- **(b)** `DESIGN.md` corrections — doc-only, the code is right in every case but D4 ✅ 2026-09-21
- **(c)** the desktop row collapse (D3) — its own piece of work ✅ 2026-09-21 (cherry-picked
  from a parallel session's `7d6a4f7`, reviewed against this doc's D3, resolved
  onto pass (b)'s state)
- **A4–A7** — the deferred accessibility items (listbox ownership contract,
  error announcement, live-region placement, control-size consistency) ✅ 2026-09-22

This file is the working record; strike through or annotate items as they're
resolved rather than deleting them, so the history of what was found and why
survives past the commits that fix it.

## 1. Where `DESIGN.md` and the code disagree

### D1 — Tag rendering and heatmap polarity are stale in the Layout section ✅ fixed
`DESIGN.md:236-237` still says tags are *"plain lowercase Geist text directly
under the name, each tinted on the recency heatmap … (overdue greener, recent
redder)"*.

Code (`app/tonight-row.tsx:397`) renders each tag as a **chip**: `rounded-badge`,
a translucent heatmap **background fill**, `text-ink` text, plus a per-tag `Nd`
numeral in mono. And the polarity is the post-swap one (recent = green), per
`lib/recency-color.ts:47`.

The Color section (`DESIGN.md:104`, and the 2026-06-17 log entry) is already
correct. Only the Layout section was never updated — **including the polarity
parenthetical, which is now backwards**. `DESIGN.md` is the wrong side here.

### D2 — The "Explanation chip" no longer exists ✅ fixed
`DESIGN.md:224`, `:227`, `:236-238` all describe a single *Explanation chip*.
The code renders `RowChips` = **Affinity chip + Recency chip + Tag chips**
(`app/tonight-row.tsx:320`). Again the Color section documents this correctly
and Layout doesn't.

### D3 — The desktop row collapse was never built ✅ fixed (pass c)
`DESIGN.md:226-228` used to read: *"Desktop (≥ 720px): … Tonight rows
collapse to a single dense line: rank + name + tags on the left, Explanation
chip center, PICK on the right edge."*

`app/tonight-row.tsx` contained **no `desktop:` class at all**. The row was
byte-identical at 375px and 1440px. Outside `app-nav.tsx`, the only responsive
rules in the entire app were `desktop:pb-12` on the four `<main>`s and the
Tonight header's reflow. So desktop rendered as a 700px-wide phone — precisely
the outcome the 2026-05-16 decision *"Desktop = persistent left rail, not a
wider column"* was chosen to avoid.

**Resolved differently than the literal doc spec, not just built as
written.** The original "single dense line, chip centered" shape never fit
rows carrying an Affinity chip, Tags, a Last note, or an AI reason line. The
fix instead keeps the mobile rank+name+chip-row stack at every width (order
and position never move), and only swaps PICK/Reject from stacked to
`flex-row-reverse` past a 900px breakpoint — deliberately later than the
rail's own 720px, because the rail's ~200px and the column's desktop
max-width both land at 720px, briefly leaving the column narrower than its
own mobile cap right after that step. The desktop column also widened
700px → 900px to give the row room. `DESIGN.md`'s Layout section and
Decisions Log were updated to describe this actual shape instead of the
original spec.

### D4 — Two tokens are specified but dead ✅ fixed (doc corrected, tokens left unwired)
- `planned` (`DESIGN.md:137`, "Amber — the Upcoming planned-dinner section") —
  zero references in `app/`. The Log's Upcoming section
  (`app/log/log-screen.tsx:81-97`) uses the same muted `labelClass` as History.
- `success-wash` (`DESIGN.md:134`, "Logged-dinner-row background") — zero
  references. `app/log/log-entry-row.tsx:44` tints logged rows with **kind**
  washes instead, which `DESIGN.md` scopes to the Tonight decided block only.
  (`danger-wash` *is* used as documented, `rejection-row.tsx:267,286`.)

### D5 — Kind hues are used as button fills, undocumented ✅ fixed
`app/catalog/catalog-screen.tsx:107` fills the two Catalog add buttons with
`bg-kind-home` / `bg-kind-restaurant`. `DESIGN.md:164-168` explicitly claims
*"the kind hues still carry no data on any screen; the icon is chrome"*. These
buttons carry kind, on a screen. It reads well and the contrast is fine (5.89 /
6.65 light, 5.19 / 4.93 dark) — amend the doc, not the code.

### D6 — The spacing scale in `DESIGN.md` matches neither the CSS nor Tailwind ✅ fixed
`DESIGN.md:216`: `2xs(2) xs(4) sm(8) md(12) lg(16) xl(24) 2xl(32) 3xl(48)`.
`globals.css:79` and `tailwind.config.ts:57-70`: `4 / 6 / 8 / 12 / 16 / 22`
(+ the 36/44 control stops). 24/32/48 don't exist; 6 and 22 aren't on the
documented scale.

This matters beyond bookkeeping, because Tailwind's rem defaults are still live
for every key *not* in that list — the exact failure `DESIGN.md:336-343` warns
about. Concretely, at the 15px root: `app-nav.tsx:53` `min-h-14` →
**52.5px** (not 56), `app/login/page.tsx` `gap-6` → **22.5px**,
`app/option-combobox.tsx:347` `w-8` → **30px**.

### D7 — Chip type size ✅ fixed
`DESIGN.md:70` specifies chip text at 13px (`--text-chip`). Every chip
(`AffinityChip`, `RecencyChip`, `TagChip`) renders `text-meta` = **12px**.

## 2. Accessibility findings

### A1 — `muted` fails AA everywhere in light mode *(highest impact — pass a)* ✅ fixed

| token on background | ratio | |
|---|---|---|
| `muted` on `bg` | **3.91:1** | fail |
| `muted` on `surface` | **4.31:1** | fail |
| `muted` on `raised` | **3.57:1** | fail |

This is the app's secondary-text token — 60 uses across 14 files, all at
12–13px (never "large text"): tag/date/meta labels, the picker hint line, the
Last-note line, `"Add a note…"`, Log notes, inactive nav labels. Dark mode is
fine (5.27:1 on `bg`).

Minimum fix that clears 4.5:1 on all three light surfaces:
**`#767a82` → `#656970`** (5.01 / 5.51 / 4.58).

### A2 — Confirmation and error colors also fail *(pass a)* ✅ fixed

| | ratio | where |
|---|---|---|
| light `success` on `raised` | **3.52:1** | `"Logged ✓"` — `pick-button.tsx:49`, `tonight-row.tsx:175` |
| light `danger` on `bg` | **4.48:1** | all inline error copy |
| dark `danger` on `surface` | **3.94:1** | same, dark |
| dark `accent` + white label | **3.63:1** | the AI **Search** button, `tonight-screen.tsx:1053-1058` |
| dark `exclude` chip label | **2.84:1** | `bg-exclude text-action-ink` — `tonight-screen.tsx:1216` |

Two of these are already half-flagged in `DESIGN.md` — the dark theme is
marked *"derived, not yet visually verified"* (`:185`) and `exclude` is marked
as awaiting its own pass (`:151-154`). These are the concrete numbers. The
`exclude` one is a theme bug specifically: `action-ink` flips to near-black in
dark, landing dark text on clay-brown.

Minimum fixes: `success` `#3f8a4a→#367740`; `danger` `#c4453a→#b84137` (light) /
`#d65a4f→#de7970` (dark); dark `accent` `#8b73ee→#7a65d1`.

**Found during the pass-(a) fix, not in the original sweep:** the search
button's "done" badge (`tonight-screen.tsx`) pairs `bg-success` with a
hardcoded white `text-accent-ink` label. Darkening dark-theme `success` enough
to survive as a solid fill with a white label would push it below 4.5:1 as
*text* elsewhere (Log "Saved", "Logged ✓") — the two roles can't share one flat
hex in dark mode, confirmed by search (no single darkening of `#5aa863`
satisfies both the white-label-fill and the on-dark-surface-text constraints
simultaneously). Fixed by pairing the fill with `action-ink` instead (already
the "ink for a filled surface" token) rather than inventing a new
`success-ink`: 5.87:1 dark / 5.43:1 light.

### A3 — WCAG 2.2 2.4.11 (Focus Not Obscured) — no `scroll-padding` anywhere *(pass a)* ✅ fixed
Tonight's filter zone is `sticky top-0 z-10` (`tonight-screen.tsx:692`) and the
nav is `fixed bottom-0 z-20` (`app-nav.tsx:31`). No `scroll-padding` /
`scroll-margin` anywhere in the codebase. Tabbing down the ranked list, the
browser scrolls the focused Pick/Reject flush to the viewport edge — i.e.
**under** one bar or the other. `pb-24` protects the end of the document, not
mid-list focus.

One-line fix in `globals.css`'s `html` block: `scroll-padding-top` for the
sticky zone, `scroll-padding-bottom` for the nav.

### A4 — The hand-rolled comboboxes break the listbox ownership contract ✅ fixed
`OptionListbox` (`option-combobox.tsx:156-186`) and `TagInput`
(`tag-input.tsx:114-154`) both nested `<li>` between `role="listbox"` and
`role="option"`, and made each option a focusable `<button>` while driving
selection with `aria-activedescendant`. A listbox may only own
`option`/`group`, and a focusable child plus activedescendant gives AT two
competing focus models. Fixed in both: `role="presentation"` on the `<li>`,
and `<div role="option" tabIndex={-1}>` instead of `<button>` (a
`cursor-pointer` class replaces the affordance a real button gave for free).

**Separately, `TagInput` had no keyboard path into its menu at all.**
`tag-input.tsx` used to handle only Enter / comma / Backspace — no ↑/↓, no
`aria-activedescendant`, `aria-selected` hardcoded `"false"`. Rebuilt on the
same contract `OptionCombobox`'s dropdown uses: matches and the "create" row
are now one indexable `menuItems` list, ↑/↓ move a highlight through it,
Enter commits the highlighted item (or the typed draft when nothing is
highlighted, preserving the old plain-Enter behavior), and Escape dismisses
the menu without blurring the field.

### A5 — Error announcement is inconsistent ✅ fixed
`rejection-row.tsx:100,128` and `tonights-dinner-block.tsx:154,323` already
did it right (`role="alert"`). Added `role="alert"` to the three that
didn't announce at all: `option-form.tsx` (Name-field error), `option-row.tsx`
(delete error), `log-entry-row.tsx` (date-field error).

`option-form.tsx` also funneled **every** error into the Name field's
`aria-describedby`, including `updateOption`'s "That option is no longer
available" (the Option was deleted out from under an in-progress edit) —
not a Name problem. Split `error` into `nameError` (only the literal "Enter a
name" validation message, still wired to the Name input's
`aria-invalid`/`aria-describedby`) and `formError` (everything else, rendered
as its own `role="alert"` paragraph above the Save/Cancel row, not tied to
any field). Places failures were already handled locally inside
`PlacesSearchBox` and never touched this `error` state — that part of the
original finding didn't hold up on closer reading.

### A6 — `aria-live="polite"` on the button element itself ✅ fixed
`pick-button.tsx:45` and `tonight-row.tsx:193` made the control its own live
region. The button is usually focused when its label flips to `"Logged ✓"`, so
AT may double-announce, and some screen readers skip live regions on
interactive elements. Both now use a sibling `sr-only` `role="status"`
paragraph instead — the pattern the screen already uses elsewhere
(`tonight-screen.tsx:257`, `:741`) — that announces "Logged" only while
`justLogged` is true.

### A7 — One control is 30px where its twin is 44px ✅ fixed
The Log/detail combobox clear was `h-9 w-8` → **36 × 30px**
(`option-combobox.tsx:347`), the rem-default accident from D6. Resized to
match the Tonight search box's identical clear (`absolute inset-y-0 right-0
w-11`, 44×44px) and widened the input's `pr-9` to `pr-11` to keep query text
clear of the wider button.

### Stale code comments ✅ fixed (2026-09-22)
- `tonight-row.tsx` said the never-eaten `new` chip is "tinted green like a
  long-overdue one." Post-swap, overdue is red — and `recencyChipBgStrong(60)`
  does render red. Corrected to "red."
- `tonight-screen.tsx` called the exclude chip "a filled danger exclude chip";
  it's `bg-exclude`, not danger. The word "danger" dropped from the comment.

## 3. UX improvement ideas (not scheduled into a/b/c — proposals only)

Ranked by value, kept inside the "sharp instrument" brief. #1-3 are done;
#4-7 remain proposals.

1. ~~**Build the desktop row (D3).**~~ ✅ done — cherry-picked from `7d6a4f7`
   (pass c); see D3 above.
2. ~~**Darken the ledger rule.**~~ ✅ done (2026-09-22) — `line` went from
   1.27:1 against `bg` to 3.0:1 (`#8a8c8e`). See the Decisions Log.
3. ~~**Let the Household out of a 50–90s AI search.**~~ ✅ done (2026-09-22) —
   the search input and its in-field Clear are never disabled anymore, so
   typing and picking by name during the wait works exactly as it does at
   rest; the Search button becomes a Cancel affordance while pending (still
   showing the live elapsed-second count) that returns the Household to
   "Search" immediately, without waiting on the model call already dispatched
   server-side. A `searchGenerationRef` bump on Cancel/Clear guards a
   since-abandoned response from landing late and overwriting state nobody is
   waiting on. (A day change used to bump it too; since ADR-0009's 2026-09-22
   amendment a search in flight survives the day change and still lands.)
   Covered by three `tonight-screen.test.tsx` cases: the box
   staying enabled in flight, a typeahead Pick succeeding while a search never
   resolves, and Cancel dropping a late-arriving result.
4. **Auto-expand the disclosures when the picker is empty.** In the
   `allFiltered` state the screen says *"No Options are available for
   Friday"* and the actual explanation is two **collapsed** buttons further
   down (`tonight-screen.tsx:351`, `:363`). That's the one moment those lists
   are the answer rather than an aside — open them by default when
   `allFiltered` is true.
5. **Grow the detail-page tap target.** The Option name `<Link>`
   (`tonight-row.tsx:144`) is ~18px tall, sitting in a row whose right edge
   carries two 44px buttons. The most common non-Pick intent on a row has the
   smallest target on it. Wrapping the name+chips block in the link (leaving
   the Last-note button as an interactive island) costs no layout.
6. **Resolve the Affinity chip trial.** `DESIGN.md:412` still marks it
   **"Trialling"**. As shipped, a single row can carry `1.4`, `18d`, and
   `pasta 6d` — three unlabelled numerals on two heatmap scales with inverted
   mappings, no legend anywhere. Either it has earned its slot (then update
   the log and consider a one-line legend under the hint) or it hasn't.
   Leaving the question open is the worst of the three.
7. **Make a Pick leave a mark.** Confirmation today is a smooth scroll
   (`tonight-screen.tsx:212-223`) plus a 1600ms `"Logged ✓"` on a button that
   is about to unmount. Anyone who looked away misses both. Briefly outlining
   the newly-added decided row would reuse motion you already have permission
   for (`state-transition`, 140ms).

## Computed token fixes reference (pass a)

```
light muted   #767a82 -> #656970   (bg 5.01, surface 5.51, raised 4.58)
light success #3f8a4a -> #367740   (bg 4.93, surface 5.43, raised 4.50)
light danger  #c4453a -> #b84137   (bg 4.96, surface 5.46, raised 4.53)
dark  danger  #d65a4f -> #de7970   (bg 5.75, surface 5.12, raised 4.53)
dark  accent  #8b73ee -> #7a65d1   (white label 4.56)
```

`planned` was not adjusted — it is dead per D4, deferred to pass (b)/(c)
decision on whether to wire it up or drop it from `DESIGN.md`.

`exclude` (dark, label contrast 2.84:1) was not adjusted in pass (a) — it is
explicitly marked in `DESIGN.md` as carried-over and awaiting its own pass;
fixing it here would be scope creep past a mechanical contrast pass. Flagging
so it isn't lost.
