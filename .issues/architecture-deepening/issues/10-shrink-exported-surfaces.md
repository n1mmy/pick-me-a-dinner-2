# 10 — Shrink the exported surfaces; delete the exports nothing calls

Status: done
Type: AFK

## What to build

Two kinds of interface bloat, both of which make a reader guess what is live.

**Exported only so a test can reach it.** The module's real seam is its public
function, but the tests reach past it, so an internal rename becomes a test
edit and the interface reads as wider than it is:

- `lib/ranking.ts` — `daysSince`, `lastEaten`, `lastTagUse`, `decayedEatCount`,
  `decayedTagCount` are exported; the only importer outside the module is
  `lib/ranking.test.ts`. Production calls `rankTonight` and `rankOption`.
- `lib/recency-color.ts` — `recencyColor` and `affinityColor` are exported;
  only `lib/recency-color.test.ts` imports them (`app/tonight-row.tsx:9-11`
  uses the other three).

**Dead outright.** No production caller at all:

- `lib/dinner-grouping.ts` — `groupByDate` (`:33`) and `splitDinners` (`:56`).
  Both screens moved to `groupByDay` (`app/log/log-screen.tsx:52`,
  `app/catalog/[id]/page.tsx:109`). Roughly 75 of `lib/dinner-grouping.test.ts`'s
  186 lines exist only to keep them covered.
- `app/log/log-entry-row.tsx:28` — `DinnerGroup`, the only consumer of the
  (also dead) `Dinner` type.
- `lib/pg-error.ts:68` — the `export type { ActionResult }` re-export; every
  caller imports it from `lib/action-result.ts` directly.

Do both.

- Make the five `lib/ranking.ts` helpers and the two `lib/recency-color.ts`
  helpers module-private. Move their table tests onto the public functions:
  each existing case becomes an assertion about `rankTonight` / `rankOption`
  output (or about the colour the public helper returns) for an input that
  exercises the same rule. **Coverage of the rules must not drop** — the
  recency cap, the never-eaten case, the future-entry exclusion, and the decay
  weighting each keep a test. Where a case genuinely cannot be reached through
  the public function, leave that helper exported and say why in a one-line
  comment, rather than deleting the test.
- Delete `groupByDate`, `splitDinners`, `DinnerGroup`, the `Dinner` type if it
  is then unused, and the `pg-error` re-export — with their tests.
- `lib/dinner-grouping.ts`'s module comment should end up describing one
  grouping function, `groupByDay`, rather than three.

ADR-0003 names `lib/ranking.ts`'s table tests as "the reference test pattern
for the project" — that stays true, and this is the point of the change: the
reference pattern becomes table tests **through the module's interface**,
which is what the next reader will copy.

No behaviour change anywhere. No `CONTEXT.md` change; no ADR change beyond the
reading above.

## Acceptance criteria

- [x] `lib/ranking.ts` exports only what production imports, plus any helper
      carrying a one-line note explaining why it must stay reachable
- [x] `lib/recency-color.ts` exports only the three helpers
      `app/tonight-row.tsx` uses, under the same exception rule
- [x] `groupByDate`, `splitDinners`, `DinnerGroup`, and the `pg-error`
      `ActionResult` re-export are deleted, along with their tests
- [x] No production behaviour changes: `pnpm test` covers the same ranking and
      colour rules as before, asserted through the public functions
- [x] `lib/dinner-grouping.ts`'s module comment describes only `groupByDay`
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green

## Comments

- Acceptance criteria were ticked prematurely when `Status` was first set to
  `done`: `lib/ranking.ts`'s five helpers got their exception comment
  (`daysSince` etc.), but `lib/recency-color.ts`'s `RECENCY_COLOR_CAP` and
  `AFFINITY_COLOR_FULL` were still exported with no exception note and no
  importer but `lib/recency-color.test.ts`.
- Fixed by making both constants module-private and inlining their values
  (30, 2) as local literals in `lib/recency-color.test.ts`, which already
  only exercised them through the public `recencyChipBg` / `affinityChipBg` /
  `recencyChipBgStrong` functions — no coverage lost. `lib/recency-color.ts`
  now exports exactly the three helpers `app/tonight-row.tsx` imports.
  `pnpm typecheck`, `pnpm lint`, `pnpm test` (347 passing), and `pnpm build`
  all verified green after the change.

## Blocked by

- [05 — Concentrate Tonight's Selected-day suppression into one module](./05-tonight-day-candidate-set.md)
  — sequencing only: 05 moves `lib/ranking.ts`'s callers, so narrowing its
  exports afterwards avoids two passes over the same imports.
