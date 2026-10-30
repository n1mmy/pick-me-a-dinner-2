# 04 — Catalog, Option detail page, and Log specs

Status: ready-for-agent
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

- [ ] Catalog passes at phone and desktop with every fixture Option and its kind bar
- [ ] The `@dark` Catalog test passes under `phone-dark`
- [ ] The Option detail page passes at phone and desktop with the name in Fraunces and its Log entries listed
- [ ] The Log passes at phone and desktop with entries newest first
- [ ] Screenshots for Catalog (phone, desktop, phone-dark), the detail page, and the Log exist

## Blocked by

- [02 — Playwright scaffolding, the fixture, and the Login tracer bullet](02-playwright-scaffolding-and-login.md)
- [03 — Tonight specs, today and tomorrow, light and dark](03-tonight-specs-light-and-dark.md) (for the dark project and contrast helper)
