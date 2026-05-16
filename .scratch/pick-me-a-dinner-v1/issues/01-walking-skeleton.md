# 01 — Walking skeleton: scaffold, schema, design foundation

Status: ready-for-agent
Type: AFK

## Parent

[PRD: Pick Me a Dinner — v1](../PRD.md)

## What to build

The walking skeleton that proves the whole stack wires up end-to-end. Scaffold
the Next.js (App Router) + TypeScript + Tailwind app, add Drizzle ORM against
PostgreSQL, and define the full 4-table schema (`options`, `tags`,
`option_tags`, `dinner_log`) with the first generated migration. Implement the
§16 design foundation as CSS custom properties plus Tailwind theme tokens so
every later screen consumes shared tokens with no per-screen hex literals.

The app should boot, the first migration should apply cleanly to an empty
Postgres DB, and the root route should render a styled placeholder using the
design tokens (warm palette, system font stack, single centered column —
max-width 560px phone / 700px desktop) — proving Next.js, Drizzle, Postgres and
Tailwind are integrated.

Schema must match PRD "Schema (4 tables — ADR-0001)" exactly: `options` with
`kind enum('home','restaurant')`, `active` flag, restaurant-only nullable
fields; `tags` with a **UNIQUE INDEX on `lower(name)`**; `option_tags` M2M with
both FKs `ON DELETE CASCADE`; `dinner_log` with `option_id` FK
`ON DELETE RESTRICT`, `eaten_on date`, and `UNIQUE (option_id, eaten_on)`.

Add `.env.example` with placeholders for `DATABASE_URL`, `APP_PASSWORD`,
`APP_SECRET`, `APP_TZ`, `GOOGLE_PLACES_API_KEY`. Migration files are
version-controlled; nothing applies them automatically.

## Acceptance criteria

- [ ] `next dev` boots and the root route renders a placeholder styled from the
      design tokens
- [ ] Drizzle schema defines all 4 tables with the exact constraints from the
      PRD (enum, `lower(name)` unique index, `ON DELETE CASCADE` / `RESTRICT`,
      `UNIQUE (option_id, eaten_on)`)
- [ ] The first migration is generated, committed, and applies cleanly to an
      empty Postgres database
- [ ] §16 palette, type scale, and spacing exist as CSS custom properties +
      Tailwind theme tokens; the placeholder uses the single centered-column
      primitive (560px phone / 700px desktop, 720px breakpoint)
- [ ] `.env.example` lists all five env vars with placeholder values only
- [ ] Vitest is configured and runs

## Blocked by

None - can start immediately.
