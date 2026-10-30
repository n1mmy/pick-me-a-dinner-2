# 03 — Tonight specs, today and tomorrow, light and dark

Status: ready-for-agent
Type: AFK

## Parent

[Spec: Browser tests](../PRD.md)

## What to build

Tonight today shows the fixture's **brief**, the first row's **AI
rationale**, and the **Day note**, with no AI search control, which proves
the keys stayed blank. Tonight tomorrow shows the **Planned dinner** decided
with the brief beneath it. Tonight today is also checked in the dark theme.

- Tonight today spec at `/`: the shared checks plus the brief visible, the
  first row's rationale visible, the Day note visible, the AI search
  control absent.
- Tonight tomorrow spec at the Selected-day URL for tomorrow: the shared
  checks plus the Planned dinner row shown decided and the brief under it.
- The `phone-dark` project (375×812, dark colour scheme) with `grep` for
  `@dark`, and `grepInvert` for `@dark` on the light projects.
- A contrast helper: the computed page background is dark by luminance,
  and body text, the `h1`, and a row's kind bar each clear a contrast
  floor against what they sit on (4.5:1 for text, 3:1 for the bar). Used
  by a `@dark` Tonight today test.

## Acceptance criteria

- [ ] Tonight today passes at phone and desktop with brief, rationale, and Day note visible and no AI search control
- [ ] Tonight tomorrow passes at phone and desktop with the Planned dinner decided and the brief beneath
- [ ] The `@dark` Tonight today test runs only under `phone-dark` and passes the luminance and contrast floors
- [ ] Light projects never run `@dark` tests
- [ ] Screenshots for Tonight today (phone, desktop, phone-dark) and Tonight tomorrow (phone, desktop) exist

## Blocked by

- [01 — Tonight shows a stored Prepared note whenever one exists](01-tonight-shows-a-stored-prepared-note.md)
- [02 — Playwright scaffolding, the fixture, and the Login tracer bullet](02-playwright-scaffolding-and-login.md)
