# 04 — Catalog, Option detail page, and Log specs

Status: done
Type: AFK

## Parent

[Spec: Browser tests](../PRD.md)

## What to build

The **Catalog** lists every fixture **Option** with its kind bar, in light
and dark. The **Option detail page** of an eaten Option shows its name in
Fraunces and lists its **Log entries**. The **Log** lists the fixture's
entries newest first.

- Catalog spec: the shared checks plus every fixture Option listed with its
  kind bar; a `@dark` test using the contrast helper from ticket 03.
- Option detail page spec, for an eaten fixture Option: the shared checks
  plus the name's computed family starting with Fraunces and its Log
  entries listed.
- Log spec: the shared checks plus the fixture entries listed, newest
  first.

## Acceptance criteria

- [x] Catalog passes at phone and desktop with every fixture Option and its kind bar
- [x] The `@dark` Catalog test passes under `phone-dark`
- [x] The Option detail page passes at phone and desktop with the name in Fraunces and its Log entries listed
- [x] The Log passes at phone and desktop with entries newest first
- [x] Screenshots for Catalog (phone, desktop, phone-dark), the detail page, and the Log exist

## Blocked by

- [02 — Playwright scaffolding, the fixture, and the Login tracer bullet](02-playwright-scaffolding-and-login.md)
- [03 — Tonight specs, today and tomorrow, light and dark](03-tonight-specs-light-and-dark.md) (for the dark project and contrast helper)

## Comments

- Done, with one reading of the ticket changed to match `DESIGN.md`: Catalog
  rows have no kind bar by design ("Untinted rows on plain `bg` (Catalog
  lists…)"). The Catalog spec asserts each fixture Option under its kind's
  section ("Home meals" / "Restaurants"), and the `@dark` Catalog test
  measures the kind-hued "Add a meal" / "Add a restaurant" fills against the
  page at the 3:1 floor. Giving Catalog rows a kind bar would be a design
  change, so it isn't made here.
