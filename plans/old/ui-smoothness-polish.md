# UI smoothness polish — plan

Status: **approved, not started** (2026-09-24). Came out of an `/impeccable`
review of the live app (Tonight, Log, Catalog, Option detail at 1280px and
375px). User complaint: "the UI feels a little blocky and less smooth." The
user approved all eight items below, including the two (P1, P3) that amend
`DESIGN.md`.

## Diagnosis

Two causes, neither structural:

1. **Too many heavy, equal-weight rectangles.** Solid charcoal buttons repeated
   down every list, a wall of bordered tag boxes, rows edged three times
   (tint + kind bar + divider), header controls drawn as separate boxes, and a
   focus ring that draws a second box around inputs.
2. **No motion at all.** The whole app uses only `transition-colors`. The
   `--motion-medium` 220ms token ("inline expand" in `DESIGN.md` › Motion) is
   declared but used nowhere; there are no easing tokens. Everything snaps.

**This is refinement, not redesign.** Keep the "sharp instrument" world:
Fraunces/Geist/Geist Mono, the 6px/3px radii (do *not* round things off — the
blockiness is weight, not corners), density, the kind bar, the heatmap chips,
the flat ledger, every 44px tap floor and every documented control-height
exception. Do not touch the dark theme beyond what the token changes imply (it
is still "not yet visually verified" and is a separate pass).

## Ground rules for the implementer

- Read `CLAUDE.md`, `DESIGN.md`, and `PRODUCT.md` first. `DESIGN.md` is binding;
  where an item below amends it, update `DESIGN.md` in the same change (the
  section text *and* a Decisions Log row dated the day you land it).
- Tokens only — no hex literals in components. On-scale spacing only (see
  `DESIGN.md` › Spacing: `html` is 15px, so off-scale Tailwind keys silently
  resolve wrong). A literal px value is acceptable only where the codebase
  already does it for the same reason (e.g. the 3px kind bar, `py-[10px]`),
  with a comment saying why.
- Every new motion must respect `prefers-reduced-motion: reduce` (turn
  transforms/height animation off; a plain opacity fade or nothing is fine).
- Match the surrounding code's comment density — components here carry
  explanatory doc comments; update them where behavior changes rather than
  leaving them stale.
- Do not add features, abstractions, or machinery beyond what an item needs
  (`CLAUDE.md` › Scope). If an item seems to need real machinery, stop and ask.
- Existing tests must stay green: `corepack pnpm test` (and
  `corepack pnpm exec tsc --noEmit`). Several tests query by role/name and
  `aria-expanded`; keep accessible names, roles, DOM order, and tab order
  unchanged.

---

## Weight: fewer, lighter rectangles

### P1 — Demote Pick off Tonight; demote Menu/Call/Recipe  ⚠️ amends DESIGN.md

**Problem.** Catalog and Log show a column of ~20 identical solid-charcoal 44px
Pick buttons; on Tonight's decided block, Menu / Call / Recipe are the same
solid charcoal as Pick. The primary action has nothing to stand out against.

**Change.**
- Tonight's ranked picker rows (`app/tonight-row.tsx`) and Closed-disclosure
  rows: **unchanged** — filled `action` Pick stays the one primary action.
- Everywhere else Pick appears — `app/pick-button.tsx` (used by
  `app/catalog/option-row.tsx`, `app/log/log-entry-row.tsx`,
  `app/catalog/[id]/option-controls.tsx`, and possibly others; grep for
  `PickButton` and for `bg-action text-action-ink`) — render a **secondary**
  style: `bg-surface`, `border border-line`, `text-ink` label, `hover:bg-raised`.
  Keep `min-h-11`, font weight, the "Logged ✓" success state, and the
  live-region behavior. Prefer a `variant` prop on `PickButton` (default the
  secondary look; Tonight rows have their own inline button) over forking the
  component.
- Decided-block actions in `app/tonights-dinner-block.tsx` (the shared class
  for Menu / Call / Recipe near line 23, component near line 423): the same
  secondary style. Keep 44px.
- Audit other `bg-action` fills (`app/catalog/option-form.tsx` save button is a
  form submit — leave it filled; the Closed-day toggles' selected state is a
  toggle, leave it). Only demote repeated per-row actions.

**DESIGN.md.** Layout/Color: "PICK is a filled `action` button on Tonight's
ranked rows only; on Catalog, Log, the detail page, and the decided block's
Menu/Call/Recipe, row actions use the secondary outlined style (`surface` fill,
`line` border, `ink` label)." Decisions Log row with the rationale above.

### P2 — Tag filter chips and Log per-day buttons lose their boxes

**Problem.** Tonight's tag filter is ~20 chips each with a 3:1 `line` border — a
grid of boxes. The Log repeats "+ Dinner / + Rejection" as `bg-raised` +
`border-line` buttons under *every* day (`app/log/log-screen.tsx` ~lines
122–128).

**Change.**
- `TagFilterChip` in `app/tonight-screen.tsx` (~line 1270): drop the border in
  the neutral state; use a `raised` fill with `ink` text. Selected (include)
  state: `action` fill + `action-ink` (as today). Excluded state: keep its
  current semantics and the `exclude` token, but borderless too, and keep
  whatever non-color cue it has today (the `underline` / strike / icon — do not
  make state color-only). Keep the chips' current tap size and wrapping.
  `DESIGN.md` says these chips "await their own visual pass" — this *is* that
  pass; update the Color section's `exclude` paragraph to say what was done
  (retune `exclude` only if it now fails 4.5:1 for its label; measure).
- Log per-day "+ Dinner / + Rejection": borderless, no fill, `text-muted`
  label → `hover:text-ink hover:bg-raised`, keeping `min-h-11` and
  `rounded-control`. The top-of-screen "+ Add a dinner / + Add a rejection"
  pair may keep a border (it is the screen's primary entry) but should drop the
  `raised` fill so it matches the secondary style from P1.

### P3 — Separate tinted rows by a gap, not a divider  ⚠️ amends DESIGN.md

**Problem.** Picker, decided, Log, and Rejected rows have a tinted background,
a 3px kind bar, *and* a 1px `divider` between neighbours. Between two tinted
rows the divider is redundant and reads as a heavy seam.

**Change.**
- Where rows carry a background tint/wash (Tonight picker `li` in
  `app/tonight-row.tsx` — `border-b border-divider`; decided rows in
  `app/tonights-dinner-block.tsx`; Log entry and rejection rows in
  `app/log/`; Rejected/Closed disclosure rows), remove the row divider and
  separate rows with a **2px gap of `bg`** on the parent list (`flex flex-col`
  + `gap-[2px]`, with a comment: 2px is deliberately off the spacing scale, like
  the 3px kind bar — it is a rule weight, not a layout step).
- Untinted rows (Catalog `option-row.tsx`, anything on plain `bg`) keep their
  `divider` rule — there the rule is the only separator.
- Section-level dividers (e.g. the rule above "Add another option", the Log's
  day separators) stay, but use `divider`, not `line`. The Log's day separator
  currently renders heavier than a row rule — make it `divider` at 1px.

**DESIGN.md.** Layout › Tonight row anatomy: replace "separated by a 1px
`divider` rule" with the tinted-rows-separated-by-a-2px-`bg`-gap rule and the
untinted-rows-keep-the-divider rule. Decisions Log row.

### P4 — Join the header controls into grouped controls

**Problem.** The Tonight header's day stepper is three separately bordered boxes
(‹ · date · ›, `app/day-stepper.tsx`) and the kind segment is three separate
pills (`KindSegment`, `app/tonight-screen.tsx` ~line 1227).

**Change.**
- Day stepper: one outer `border-line rounded-input` group; inner 1px `line`
  separators between ‹, date, ›; inner corners square, outer corners 6px. Same
  36px height (`h-9`), same widths — this is the header's documented tight
  exception (`DESIGN.md` › Control height, ADR-0009 amendment); measure that
  "Wednesday" at 375px does not newly ellipsize (it must fit exactly as well as
  it does today, or better — a shared border saves ~4px).
- Kind segment: one `raised` track (`rounded-control`, ~2px inset padding) with
  the selected option as an `action`-filled thumb inside it; unselected options
  transparent. Keep `aria-pressed`/radio semantics and 36px height exactly as
  today. Optional, if cheap: slide the thumb (transform, `--motion-short`,
  ease-in-out); skip if it needs measuring machinery.

### P5 — Focus ring on text inputs hugs the border

**Problem.** Text inputs get `outline-2 outline-offset-2 outline-action`, which
draws a second black box 2px outside the input's own border — and text inputs
match `:focus-visible` on mouse/tap focus too, so everyone sees it (visible in
the Reject reason box at 375px).

**Change.** For **text-entry fields only** (inputs, textareas, the combobox,
the date input), use `focus-visible:outline-offset-[-1px]` so the 2px ring sits
on the field's own border. Buttons keep the current offset ring. The ring must
stay 2px `action` — this is a visibility fix, not a removal. There are many
duplicated `focusRing` constants across files (`grep -rn "focusRing ="`); the
cleanest change is a second shared constant for fields in one module (e.g.
`app/focus-ring.ts`) and pointing field call sites at it — only if that stays
small; otherwise edit the field class strings in place.

---

## Motion: stop snapping

Add to `tailwind.config.ts` › `extend.transitionTimingFunction` and
`globals.css`: `--ease-enter: cubic-bezier(0.25, 1, 0.5, 1)` (ease-out-quart),
`--ease-exit: cubic-bezier(0.5, 0, 0.75, 0)` (ease-in), `--ease-move:
cubic-bezier(0.65, 0, 0.35, 1)`, exposed as `ease-enter` / `ease-exit` /
`ease-move`. Add a global reduced-motion block in `globals.css` that zeroes the
new transform/height animations. No bounce, no elastic, no scroll-driven
anything (`DESIGN.md` › Motion: minimal-functional).

### P6 — Inline expands open instead of popping

**Targets.** Tonight row Reject reason box (`app/tonight-row.tsx`), the
`RejectedTonightDisclosure` / `ClosedDisclosure` bodies (`app/tonight-screen.tsx`
~lines 473, 582 — custom `DisclosureToggle` + conditional render, not
`<details>`), the Catalog inline edit panel, the decided row's note editor, the
Log row edit forms, and the detail page's inline confirms (`app/confirm-pair.tsx`).

**Approach — keep conditional rendering** (it preserves `autoFocus`, tab order,
and every existing test). Animate the *enter* only, with CSS:
- `@starting-style { opacity: 0; transform: translateY(-4px) }` → `opacity 1,
  none` over `--motion-medium` with `ease-enter`, via one shared utility class
  (e.g. `.expand-in` in `globals.css` `@layer components`).
- Height: add `interpolate-size: allow-keywords` on `:root` and transition
  `height` from `0` (in `@starting-style`) to `auto` with `overflow: clip`.
  This is Chromium-only progressive enhancement — other browsers still get the
  fade and snap the height, which is acceptable.
- Exits snap. Delayed-unmount exit animations are machinery; don't add them.
- Verify `autoFocus` still lands in the Reject input and the Escape-to-cancel
  path (`app/escape-to-cancel.ts`) still works mid-animation.

### P7 — Rows move instead of teleporting after Pick / Reject  (time-boxed spike)

**Problem.** Picking moves a row into Tonight's dinner and re-sorts the list in
one frame; rejecting makes a row vanish. This is the single most "unsmooth"
moment.

**Constraint.** The app is on React 19.0 / Next 15 — React's `<ViewTransition>`
component is not available on stable, and do not upgrade React or enable
canary/experimental flags for this. Server actions commit their revalidated
tree inside the transition, so the new list and the action result arrive
together.

**Spike (time-box it; stop if it fights you).** Try `document.startViewTransition`
around the *commit*, not the network request: the page must never freeze
during the server round-trip (freezing would also hide the "Logged ✓"
feedback). Give each row `view-transition-name: row-<optionId>` (inline style;
names must be unique on the page, so the decided-block copy of an Option and
its picker row must not both carry the same name). Default VT cross-fade +
geometry morph at `--motion-medium`, `ease-move`; reduced-motion disables it.

**Fallback if the spike can't be done cleanly** (needs a freeze, a global
store, or more than a small hook): ship only an *enter* animation — newly
mounted decided rows and "Logged ✓" use the P6 `.expand-in` treatment — and
record in the plan/PR that list reordering still snaps and why. Report which
path you took.

### P8 — Press feedback on filled buttons

Filled buttons (Tonight Pick, AI Search, Catalog add buttons, form submits):
`active:scale-[0.98]` + the existing hover shade, `transition-[background-color,transform]`
at `--motion-micro` with `ease-enter`. Reduced-motion: color only. Outlined and
text buttons get the color change only. Don't scale anything that moves layout
(scale is transform-only, so it shouldn't — verify no row jitter).

**DESIGN.md › Motion** (for P6–P8): add the easing tokens, the expand-in
pattern (enter animated, exit snaps), press feedback, the view-transition
outcome from P7, and the reduced-motion rule. Decisions Log row.

---

## Verification (one bounded pass, then stop)

1. `corepack pnpm test` and `corepack pnpm exec tsc --noEmit` green.
2. Start the dev server per `docs/agents/dev-server.md` (copy `.env.k8s` in as
   `.env.local`; bind `0.0.0.0`; run in background, wait for `✓ Ready`).
3. Screenshot Tonight (default, Reject box open, a disclosure open), Log,
   Catalog, and one Option detail page at **1280×900 and 375×812**. If no
   browser is installed, a throwaway Playwright install *outside the repo*
   works: `npm i playwright` in `/tmp/pw`, `npx playwright install chromium`,
   log in by reading `APP_PASSWORD` from `.env.local` inside the script (never
   echo it). Compare against the pre-change screenshots if you took them first
   — do take them first.
4. Check specifically: "Wednesday" in the Tonight header at 375px (P4), the
   2px gaps render and untinted Catalog rows still have rules (P3), the input
   focus ring hugs the border (P5), the Reject box expands and autofocuses
   (P6), and the P7 outcome.
5. Run the Impeccable detector once over the changed UI files:
   `~/.claude/skills/impeccable/scripts/impeccable detect --json <changed files>`.
   Fix real findings in one batch; at most one more screenshot round. Stop.
6. Stop the dev server.

## Out of scope

Dark-theme verification; radius changes; typography changes; new components or
features; AI search behavior; any change to Tonight's ranked-row Pick styling.
Do not run the AI search eval script (billed — see `CLAUDE.md`).
