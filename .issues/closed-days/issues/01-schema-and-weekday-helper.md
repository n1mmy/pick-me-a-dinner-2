# 01 — Schema: `closed_days` on Options, and a shared weekday helper

Status: ready-for-agent
Type: AFK

## Parent

[PRD: Closed days](../PRD.md)

## What to build

Two foundations, no user-visible behavior.

**1. The column.** `closed_days` on `options`: Postgres `integer[]`, **not
null**, default `'{}'`. Values are `0`–`6`, **`0` = Sunday** — the same indexing
as the `WEEKDAYS` table in `lib/snapshot-format.ts`. Define it in the Drizzle
schema and add one out-of-band migration.

The column lives on the unified `options` table (ADR-0001) but is
Restaurant-only in the same sense as `address` / `phone` / `lat`: a Home meal
leaves it empty. An empty array means **open all week**, which is why it is the
default — every existing row gets it and behaves exactly as before.

No validation forbids all seven days. **Archive** covers a Restaurant that has
gone for good, and a seven-day closure is a legitimate way to park one
temporarily.

**2. The weekday helper.** `lib/snapshot-format.ts` derives a weekday inline
today. Extract `weekdayFromSqlDate(sqlDate: string): number` into
`lib/local-day.ts` — the module that already owns every SQL-date-to-number
conversion — and have `formatDateWithWeekday` call it. Suppression (issue 03)
will call the same helper. Two independent weekday derivations is exactly how
an off-by-one gets in, and the whole design rests on one number meaning one day.

`getTonightData` should return `closedDays` on each `TonightOption` so issues 03
and 04 have it. Do **not** add it to `RankOption` in `lib/ranking.ts` — the
ranking must stay structurally blind to closures (ADR-0003, ADR-0010).
`TonightOption` is already wider than `RankOption` (it carries `notes`), and
TypeScript's excess-property check does not apply to a passed variable, so this
keeps compiling untouched.

## Acceptance criteria

- [ ] `options` carries `closed_days integer[] NOT NULL DEFAULT '{}'`, defined
      in the Drizzle schema with a comment stating the `0` = Sunday convention
- [ ] A new Drizzle migration adds the column and applies cleanly against the
      existing dev database; every pre-existing row reads back as `[]`
- [ ] The startup schema-version check passes (journal entries = applied
      migrations)
- [ ] `weekdayFromSqlDate` lives in `lib/local-day.ts` and
      `formatDateWithWeekday` uses it — no second weekday derivation remains in
      the codebase
- [ ] `lib/local-day.test.ts` covers: Sunday is `0`; the mapping is exact across
      a month boundary, a year boundary, and a DST transition; it agrees with
      `formatDateWithWeekday`'s output for the same date
- [ ] `getTonightData` returns `closedDays` on each `TonightOption`
- [ ] `RankOption` is unchanged and `lib/ranking.ts` contains no reference to
      closed days
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green, and
      `pnpm build` passes with no env vars set

## Blocked by

- None — can start immediately
