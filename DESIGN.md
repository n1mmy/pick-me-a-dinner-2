# Design System — Pick Me a Dinner

The canonical visual system. Code, components, and review must follow this
file; it supersedes the placeholder `§16 design foundation` block currently in
`app/globals.css` / `tailwind.config.ts` (those tokens predate this system and
need an implementation pass to match — see "Implementation note" below).

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
the numbers, one note of warmth so it doesn't read clinical.

## Aesthetic Direction

- **Direction:** Industrial / utilitarian, leaning *field instrument*.
- **Decoration level:** Minimal — typography and hairline rules do all the
  work. No shadows, no cards, no nested surfaces, no icons-in-circles, no
  decorative imagery.
- **Mood:** Looks like it was built by someone who actually uses it at 5:37pm.
  Quiet, dense, slightly austere — the relief of a tool that is just *right*
  rather than trying to delight.

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

- **Approach:** Restrained — warm neutrals, a single clay accent, semantic
  colors used sparingly. Color is rare and always meaningful. The light theme
  is primary; dark mode is a derived theme (below).

### Light theme (primary)

| Token | Hex | Role |
|---|---|---|
| `bg` | `#faf8f4` | App background (warm cream) |
| `surface` | `#ffffff` | Cards-less content surface, modals, inputs base |
| `raised` | `#f1ece3` | Explanation chip background, input fill |
| `ink` | `#2c2823` | Primary text |
| `muted` | `#8a8278` | Tags, dates, secondary text, rank numbers |
| `line` | `#ded6c8` | Hairline rules and borders (crisp, slightly dark) |
| `accent` | `#c4502e` | Clay — the PICK action and active states only |
| `accent-dark` | `#8f321d` | Accent hover / pressed |
| `accent-ink` | `#ffffff` | Text/label on an accent fill |
| `success` | `#3f6b4a` | Confirmation, success feedback |
| `danger` | `#b23b25` | Destructive actions, errors |
| `planned` | `#b9822b` | Amber — the Upcoming planned-dinner section |
| `home` | `#3f6b4a` | Home meal kind marker |
| `rest` | `#7a5a2e` | Restaurant kind marker |

### Dark theme

Redesigned surfaces (not inverted), saturation pulled down ~10–15%.

| Token | Hex |
|---|---|
| `bg` | `#1c1a17` |
| `surface` | `#25221e` |
| `raised` | `#2f2b26` |
| `ink` | `#ece7dd` |
| `muted` | `#9a9286` |
| `line` | `#3a352e` |
| `accent` | `#cf5d3c` |
| `accent-dark` | `#b8431f` |
| `success` | `#5a8c5f` |
| `danger` | `#c8543e` |
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
  separated by a 1px `line` rule, no cards, no shadows. Rank number in Geist
  Mono `muted`. Option name in Fraunces. Tags as plain lowercase `muted` Geist
  text directly under the name. Explanation chip on a `raised` background, its
  numerals in Geist Mono. PICK as a filled `accent` button with `accent-ink`
  label. The uniform flat list is intentional and locked — no lead-item
  prominence, no collapsed long tail.
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

The live `app/globals.css` and `tailwind.config.ts` carry an earlier
placeholder foundation (system font stack, lighter `#e4ded4` hairline, 8–9px
radii, single-column-only layout). Adopting this system means an implementation
pass: wire Fraunces / Geist / Geist Mono via `next/font`, update the color and
radius tokens, add the desktop left-rail layout, and add the dark-theme token
set. This file is the target; the code is not there yet.

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-16 | Design system created via `/design-consultation` | Memorable thing: "a sharp instrument". Emphasis: data density + ease of use on mobile and desktop. |
| 2026-05-16 | Fraunces (display) / Geist (body) / Geist Mono (data) | Codex and a Claude subagent both independently reached for a serif display; grotesque body chosen over a serif body for legibility in dense lists; mono carries the instrument-readout feel. All free, `next/font`-loadable. |
| 2026-05-16 | Keep the warm §16 palette, refined | Approved in the earlier plan design review. Hairline darkened to `#ded6c8` for crisp rules; added `accent-dark`, `planned` amber, `raised`. |
| 2026-05-16 | Desktop = persistent left rail, not a wider column | User chose to include it: desktop gets its own identity and more density instead of feeling like a stretched phone. |
| 2026-05-16 | PICK = filled clay button; Tonight rows compact | User decisions. PICK is the app's single primary action — must be unmissable; compact density serves the data-density brief. |
