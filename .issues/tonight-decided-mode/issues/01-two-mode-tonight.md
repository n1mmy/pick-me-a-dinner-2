# 01 — Two-mode Tonight: the "Tonight's dinner" decided block

Status: ready-for-agent
Type: AFK

## Parent

[PRD: Tonight — decided mode](../PRD.md)

## What to build

The core of the Tonight redesign: the screen gains a second mode.

When the Household has no Log entry dated today, Tonight is the ranked
**picker**, exactly as it is now. As soon as an Option is Picked, Tonight
switches to **decided mode**: a "Tonight's dinner" block shows what was Picked,
and the ranked picker — its All/Home/Restaurant segment, Tag filter chips, and
ranked list — collapses behind an "Add another option" control. The heading
stays "Tonight" in both modes; the decided block sits under a quiet "Tonight's
dinner" sub-label. The mode is decided server-side from today's Log entries
("today" is the Household's calendar day in `APP_TZ`).

Each Option in the decided block shows its name, a Home/Restaurant badge, and
its Tag chips with per-Tag recency. No Explanation chip. (Action buttons and a
Remove control are separate slices — issues 02 and 03.)

"Add another option" re-opens the picker so a second Option can be Picked — a
multi-Option Dinner. An already-Picked Option does not appear in the re-opened
picker. After any Pick the picker auto-collapses back to decided mode and the
new Option joins the block. A multi-Option block lists Options in pick order,
oldest first.

Introduce a new pure module, `lib/tonights-dinner`, exporting `splitTonight`:
given the ranked Tonight rows and today's Log entries it returns the picked
Options (ordered by pick order) and the picker rows with picked Options
removed. No DB, no React. Extend `getTonightData` to return today's Log entries
with their `id` and `created_at` (needed here for pick order, and by the later
slices). The `pickTonight` action is unchanged; the transition into decided
mode replaces the old 1.6-second "Logged ✓" flash as the confirmation of a
Pick.

## Acceptance criteria

- [ ] With no Log entry dated today, Tonight renders picker mode — ranked list,
      kind segment, Tag filters — behaving as before
- [ ] Picking an Option switches Tonight to decided mode, showing that Option
      under a "Tonight's dinner" sub-label; the heading stays "Tonight"
- [ ] A decided-block row shows the Option name, a Home/Restaurant badge, and
      Tag chips with per-Tag recency; no Explanation chip
- [ ] In decided mode the picker is collapsed behind an "Add another option"
      control
- [ ] "Add another option" re-opens the picker; an already-Picked Option is
      absent from it
- [ ] Picking a second Option appends it to Tonight's dinner and auto-collapses
      the picker
- [ ] A multi-Option Tonight's dinner lists Options in pick order, oldest first
- [ ] Returning to Tonight later the same day opens directly in decided mode; a
      new calendar day returns it to picker mode
- [ ] `splitTonight` is unit-tested: no picks → empty dinner + full picker;
      one/several picks → picked Options excluded from the picker and ordered
      by `created_at`; all Options picked → empty picker; a today entry for an
      Option not in the ranked set is handled without error
- [ ] The mode change is announced to assistive tech; "Add another option" is
      keyboard-operable with visible focus

## Blocked by

- None — can start immediately
