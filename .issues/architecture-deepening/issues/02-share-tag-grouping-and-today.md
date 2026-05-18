# 02 — Share the Catalog tag-grouping join and the "today" binding

Status: ready-for-agent
Type: AFK

## What to build

Two small pieces of logic are copied across several call sites. This slice
concentrates each so a future change is one edit.

**Tag grouping.** `getActiveCatalog`, `getTonightData`, and `getRejections` in
`db/queries.ts` each run the same `option_tags ⋈ tags` join and build the same
`Map<optionId, string[]>` with the same accumulation loop. Extract one private
helper in `db/queries.ts` — returning Tag names grouped by Option id for the
whole Catalog — and have those three readers use it. The Tag-ordering and the
join stay exactly as they are. `getOptionById`'s scoped, single-Option variant
is deliberately left as-is: it is a genuinely narrower query for a one-row
page, not a copy of the whole-Catalog block.

**The "today" binding.** The Household's calendar day is computed inline as
`todaySqlDate(new Date(), process.env.APP_TZ ?? "UTC")` in `app/page.tsx`,
`app/catalog/[id]/page.tsx`, `app/log/page.tsx`, and `app/tonight-actions.ts`,
plus a private `today()` in `app/log/actions.ts`. Add a `today()` function to
`lib/local-day.ts` — the standard binding of the pure `todaySqlDate` to the
wall clock and the `APP_TZ` fallback — and route every one of those call sites
through it, so the `?? "UTC"` fallback lives in one place. The pure
conversions in `local-day.ts` stay pure and unit-testable; `today()` is the
one impure convenience.

## Acceptance criteria

- [ ] One private tag-grouping helper in `db/queries.ts` is the single
      `option_tags ⋈ tags` join; `getActiveCatalog`, `getTonightData`, and
      `getRejections` all use it
- [ ] `getOptionById` is left unchanged — its scoped variant is not folded in
- [ ] `today()` is exported from `lib/local-day.ts`; `app/page.tsx`,
      `app/catalog/[id]/page.tsx`, `app/log/page.tsx`,
      `app/tonight-actions.ts`, and `app/log/actions.ts` all route through it,
      and the `process.env.APP_TZ ?? "UTC"` fallback appears exactly once
- [ ] Query results and screen behaviour are unchanged — existing query and
      action tests pass without modification
- [ ] No `CONTEXT.md` or ADR changes are needed
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green, and
      `pnpm build` passes with no env vars set

## Blocked by

- None - can start immediately
