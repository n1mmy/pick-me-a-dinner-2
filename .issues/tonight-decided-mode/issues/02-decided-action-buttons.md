# 02 — Action buttons on a picked Option (Menu / Call / Recipe)

Status: ready-for-agent
Type: AFK

## Parent

[PRD: Tonight — decided mode](../PRD.md)

## What to build

Once an Option is in Tonight's dinner, its decided-block row surfaces prominent
action buttons so the Household can act on the choice instead of keep
searching.

A Picked **Restaurant** shows a "Menu" button (opening its `url`) and a "Call"
button (a `tel:` link to its `phone`). A Picked **Home meal** shows a "Recipe"
button (opening its `url`). Each button appears only when its source field is
set — a Restaurant with no `phone` shows no "Call". The `url` button is
labelled "Menu" for a Restaurant regardless of whether the link is actually a
menu or an order/delivery page.

Add `decidedActions` to the `lib/tonights-dinner` module: given an Option's
`kind`, `url`, and `phone` it returns which buttons the decided row should
render. Extend `getTonightData` so each Option also carries `url` and `phone`.

## Acceptance criteria

- [ ] A Picked Restaurant with both fields shows a "Menu" button and a "Call"
      button in the decided block
- [ ] A Picked Restaurant missing one field shows only the button whose field
      is set; with neither, it shows no action buttons
- [ ] A Picked Home meal with a `url` shows a "Recipe" button; without a `url`,
      no button
- [ ] A Home meal never shows "Menu" or "Call"
- [ ] "Call" is a `tel:` link; "Menu" and "Recipe" open the Option's `url`
- [ ] `decidedActions` is unit-tested across the kind/field combinations above
- [ ] The buttons are keyboard-operable with visible focus and meet the
      44×44px touch-target minimum

## Blocked by

- Issue 01 — Two-mode Tonight: the "Tonight's dinner" decided block
