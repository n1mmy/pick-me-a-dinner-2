# 03 — Remove a pick from Tonight's dinner

Status: done
Type: AFK

## Parent

[PRD: Tonight — decided mode](../PRD.md)

## What to build

Picking is one tap, so mis-taps happen. Each Option in the "Tonight's dinner"
block gets a "Remove" control that deletes today's Log entry for it — letting
the Household correct a Pick without leaving Tonight.

"Remove" uses the app's existing inline-confirm pattern — a confirm step in
place, no modal and no undo-toast — the same as destructive actions elsewhere
in the app. It reuses the existing `deleteLogEntry` server action; no new
mutation is added. Removing the last Option from Tonight's dinner leaves it
empty, so the screen returns to picker mode.

## Acceptance criteria

- [x] Each decided-block row has a "Remove" control
- [x] "Remove" asks for an inline confirm before deleting; confirming deletes
      today's Log entry for that Option
- [x] After a Remove the Option is gone from Tonight's dinner and reappears in
      the picker
- [x] Removing the last Option in Tonight's dinner drops the screen back to
      picker mode
- [x] Removal reuses `deleteLogEntry` — no new server action is introduced
- [x] "Remove" is keyboard-operable with visible focus and meets the 44×44px
      touch-target minimum

## Blocked by

- Issue 01 — Two-mode Tonight: the "Tonight's dinner" decided block
