# 05 — Autofill Closed days from Google Places

Status: done
Type: AFK

## Parent

[PRD: Closed days](../PRD.md)

## What to build

Deliberately deferred out of the Closed days PRD — see ADR-0010's final
consequence. Filed so the idea is not lost, **not** ready to pick up.

Google's Places API (New) can return `regularOpeningHours` on a place-details
request, whose `periods` omit the days a place is shut — so Closed days are
derivable from it. `lib/places.ts:167` requests a fixed field mask that does not
currently ask for it.

The work would be: add `regularOpeningHours` to the details field mask, derive
the closed weekday set in `toDetails`, carry it through `PlaceDetails` and
`PlaceAutofill`, and prefill the form's toggles — editable afterward like every
other autofilled field, per the form's existing "autofill, everything stays
editable" pattern.

## Why it was deferred

- **It would not have touched the problem.** The pain that motivated Closed
  days is the *existing* Catalog — those Restaurants are already saved, so every
  one of them needs hand entry regardless of what autofill does for the next new
  one.
- **The manual field has to exist either way.** Google's hours are wrong often
  enough that an uneditable autofill would be worse than nothing, so autofill
  can only ever be a convenience layer over issue 02's control.
- Keeping it out kept the PRD to one coherent slice.

## Before starting

Verify the `regularOpeningHours` response shape against a live Places call
rather than trusting this description — the field mask, the `periods` structure,
and how a 24-hour or never-open place is represented all need checking. Note
also that a place with no hours on file returns nothing, which must leave the
toggles untouched rather than clearing them.

## Out of scope even if picked up

Keeping Closed days **synced** with Google over time. That needs background
machinery this app has no business growing; autofill writes once, at the moment
of the match, and the Household owns the value from then on.

## Blocked by

- Issue 02 (there must be a Closed-days control to prefill)

## Comments

- 2026-09-23: Picked up by user request. A weekday is closed when no
  `regularOpeningHours` period opens on it; a period with no `close` (always
  open) means none closed; missing/empty hours leave the toggles untouched.
  Shape checked against Google's published reference, not a live call.
