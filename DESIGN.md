# Design System — Pick Me a Dinner

The canonical visual system. Code, components, and review must follow this
file. The typography, spacing, layout, and motion sections were implemented
in code on 2026-05-16; the Color section was revised on 2026-05-17 via
`/design-shotgun` and implemented in code the same day (see "Implementation
note" below). The code now matches this file.

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
  numbers, dates, and every numeral in an Explanation chip ("18" in "No fish in
  18 days"). The mono is the instrument readout — it makes numbers align to the
  pixel down a column. Use it for numerals and dates only, not whole sentences.
- **Scale** (px):
  - `h1` screen title — Fraunces, 28px / weight 600
  - `name` Option name — Fraunces, 18px / weight 500
  - `body` — Geist, 15px / weight 400 / line-height 1.5
  - `chip` Explanation chip text — Geist 13px (numerals in Geist Mono 13px)
  - `meta` tags, rank, dates, secondary labels — Geist / Geist Mono 12px
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

1. **Meal kind** — a 3px solid vertical bar on the row's left edge. Teal
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
| `muted` | `#767a82` | Tags baseline, dates, secondary text, rank numbers |
| `line` | `#d8dade` | Hairline rules and borders |
| `kind-home` | `#2c6e6e` | Meal-kind left bar — home-cooked (teal) |
| `kind-restaurant` | `#7a4f6b` | Meal-kind left bar — restaurant (plum) |
| `kind-home-wash` | `#dde8e8` | Decided-row background — much-lighter home wash |
| `kind-restaurant-wash` | `#e7e0e6` | Decided-row background — much-lighter restaurant wash |
| `recency-overdue` | `#c4453a` | Recency heatmap — red end, long overdue |
| `recency-mid` | `#c8b78f` | Recency heatmap — muted tan midpoint |
| `recency-recent` | `#3f8a4a` | Recency heatmap — green end, eaten recently |
| `action` | `#2c2f36` | PICK button fill (charcoal-ink) |
| `action-hover` | `#3c4049` | PICK hover / pressed |
| `action-ink` | `#ffffff` | Text/label on the PICK fill |
| `accent` | `#6d4ed6` | AI search button fill — vivid violet, set apart from `action` |
| `accent-hover` | `#5c3ec4` | AI search button hover / pressed |
| `accent-ink` | `#ffffff` | Text/label on the `accent` fill |
| `success` | `#3f8a4a` | Confirmation, success feedback (shares the green) |
| `success-wash` | `#dee9db` | Logged-dinner-row background — much-lighter success wash |
| `danger` | `#c4453a` | Destructive actions, errors (shares the red) |
| `danger-wash` | `#f3ddda` | Rejected-row background — much-lighter danger wash |
| `planned` | `#b9822b` | Amber — the Upcoming planned-dinner section |

`recency-overdue` / `recency-mid` / `recency-recent` are the three anchor
stops of a continuous green→red scale that saturates at 30 days; the
implementation interpolates between them, applying the result at low opacity
for Recency chip backgrounds and at higher strength for Tag text. The PICK
button is a neutral charcoal so it never collides with the heatmap.

`accent` is the one deliberate exception to the neutral-everything-else rule:
the Tonight AI-search button is a vivid violet so the smart-search affordance
is unmistakably its own thing, not a second PICK. It is a UI-action accent,
not a third data channel — it never appears on a dinner row, so it does not
compete with the meal-kind or recency signals.

The earlier excluded-tag-filter chip token (`exclude`) is carried over from
the prior warm system and should be re-tuned against this cool base when the
Tonight tag filters get their own visual pass — it was not part of this
exploration.

### App icon

The home-screen / install icon (PWA — `app/manifest.ts`) is a white Fraunces
"D" on a solid `accent` violet (`#6d4ed6`) field. This is a **deliberate,
sanctioned extension of `accent`** beyond its UI-action role into brand
identity: a launcher tile wants one confident saturated mark, and violet is
the only non-neutral the system owns. It does not break the rule above — the
violet still never appears on a dinner row or as a data channel; the icon is
chrome, seen only on the OS home screen. Do not "correct" it back to neutral.

The *installed app's* system chrome deliberately does **not** follow the icon:
the manifest `theme_color` / `background_color` and the `theme-color` meta
track the app `bg` (cool grey, per theme) so the status bar blends into the
top of every screen instead of flashing violet. Violet is the identity mark
only. The app is install-as-standalone with no service worker (online-only,
auth-gated — offline caching would only add stale-cache risk).

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
| `kind-home` | `#4a9a9a` |
| `kind-restaurant` | `#a87d99` |
| `kind-home-wash` | `#212e30` |
| `kind-restaurant-wash` | `#2e2a30` |
| `recency-overdue` | `#d65a4f` |
| `recency-mid` | `#bdae89` |
| `recency-recent` | `#5aa863` |
| `success-wash` | `#26312a` |
| `danger-wash` | `#33272a` |
| `action` | `#e6e7ea` |
| `action-ink` | `#1a1c1f` |
| `accent` | `#8b73ee` |
| `accent-hover` | `#7a60e3` |
| `accent-ink` | `#ffffff` |
| `planned` | `#cf9a45` |

## Spacing

- **Base unit:** 4px.
- **Density:** Compact. Tonight rows use ~10–12px vertical padding so more
  Options are visible per screen without scrolling.
- **Scale:** 2xs(2) xs(4) sm(8) md(12) lg(16) xl(24) 2xl(32) 3xl(48).

## Layout

- **Approach:** Hybrid — a disciplined ledger grid with a real responsive
  *structural* shift between mobile and desktop (not just a wider column).
- **Mobile (< 720px):** Single centered column, max-width 560px. Bottom tab
  bar: Tonight / Log / Catalog. Tonight rows are two-line — rank + Option name +
  tags on the first line group, Explanation chip + PICK on the row.
- **Desktop (≥ 720px):** Bottom tab bar is replaced by a persistent left rail
  (~200px) holding the same nav. Content column to its right, max-width 700px.
  Tonight rows collapse to a single dense line: rank + name + tags on the left,
  Explanation chip center, PICK on the right edge. Keyboard-navigable.
- **Tonight row anatomy:** A flat, uniform ledger — every row the same height,
  separated by a 1px `line` rule, no cards, no shadows, no row given a
  different background. A 3px vertical meal-kind bar (`kind-home` /
  `kind-restaurant`) sits flush on the row's left edge. Rank number in Geist
  Mono `muted`. Option name in Fraunces, uncolored. Tags as plain lowercase
  Geist text directly under the name, each tinted on the recency heatmap by
  that tag's own recency (overdue greener, recent redder). Explanation chip
  background carries the recency-heatmap color for the Option, its numerals in
  Geist Mono. PICK as a filled `action` (charcoal-ink) button with
  `action-ink` label. The uniform flat list is intentional and locked — no
  lead-item prominence, no collapsed long tail, no per-row background tint.
- **Decided block ("Tonight's dinner"):** unlike the picker ledger above, each
  decided row carries a much-lighter wash of its meal-kind hue
  (`kind-home-wash` / `kind-restaurant-wash`) as its background, so the
  decided area reads as a distinct, settled panel above the picker. The
  "no per-row background tint" rule applies to the *ranked picker*, not here.
- **Border radius:** badge/chip 3px, inputs 6px, buttons/controls 6px. Sharp
  crisp corners suit a sharp tool — no pill shapes except where a control is
  genuinely circular.

## Motion

- **Approach:** Minimal-functional — only transitions that aid comprehension.
  No bounce, no scroll choreography. A sharp instrument does not animate for
  personality.
- **Easing:** enter `ease-out`, exit `ease-in`, move `ease-in-out`.
- **Duration:** micro 80ms (hover/press), short 140ms (state change), medium
  220ms (inline expand, e.g. Catalog edit).
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
Explanation chip is the `recencyDays` field on `TonightRow`. The dark theme is
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
