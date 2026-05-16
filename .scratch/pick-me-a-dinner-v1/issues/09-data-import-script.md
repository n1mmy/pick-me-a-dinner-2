# 09 — Prior-version data import script

Status: ready-for-agent
Type: AFK

## Parent

[PRD: Pick Me a Dinner — v1](../PRD.md)

## What to build

A **one-off script** — not an ongoing feature — that imports the prior version's
real Catalog and Log history into the v1 schema. This data is the v1 starting
point; there is no hand-seed step.

The script runs inside a **single transaction**: any failure rolls the whole
import back, leaving the DB untouched, so after fixing the offending row it is
simply re-run from scratch. It targets a fresh empty DB — no upsert / idempotency
machinery.

The prior app was Prisma-backed with tables `Meal` (7), `Restaurant` (21),
`Dinner` (67). Mapping (full table in PRD "Data import"):

- `Meal` → `options` `kind='home'`; `Restaurant` → `options` `kind='restaurant'`;
  `Dinner` → `dinner_log`.
- Text cuid `id`s → fresh `uuid`s; keep an old→new id map to rewire FKs.
- `hidden` → `active = NOT hidden` (inverted).
- `Restaurant.phoneNumber` → `phone`; `orderUrl`/`menuUrl` → `url =
  coalesce(orderUrl, menuUrl)` (never both populated).
- `tags` (`text[]`) → normalized via the shared `normalizeTag` helper into
  `tags` + `option_tags`, deduped across all Options.
- `Dinner.date` → `eaten_on`; `Dinner.notes` → `note`; `Dinner.type` dropped
  (redundant with `kind`); `option_id` from the mapped option.

Import-time defaults for fields the prior schema lacks: `dinner_log.created_at`
= the Dinner's `date` at local midnight (`APP_TZ`); Restaurant
`address`/`lat`/`lng`/`google_place_id`/`maps_url` = `null`; Home meal `url` =
`null`.

## Acceptance criteria

- [ ] The script maps `Meal`/`Restaurant`/`Dinner` into `options` / `dinner_log`
      with fresh uuids and rewired FKs
- [ ] `hidden` is inverted to `active`; `orderUrl`/`menuUrl` coalesce into `url`
- [ ] Tags are normalized via the shared `normalizeTag` helper and deduped
      across all Options into `tags` + `option_tags`
- [ ] `dinner_log.created_at` is set to the Dinner's date at local midnight
      (`APP_TZ`); absent Restaurant/Home fields import as `null`
- [ ] The whole import runs in one transaction and rolls back fully on any
      failure
- [ ] Tests cover mapping correctness (`hidden→active` inverted, `url` coalesced,
      tags normalized + deduped, `created_at` rule) and the all-or-nothing
      rollback

## Blocked by

- Issue 03 — Tags on Options (needs the shared `normalizeTag` helper)
