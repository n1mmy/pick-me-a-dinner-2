# 07 — One Selected-day rule and one revalidation set for every Server Action (fixes Catalog staleness)

Status: done
Type: AFK

## What to build

The mutating Server Actions already share `authedAction`, `trimToNull`,
`pgErrorMessage`, and `ActionResult` (issues 01 and 04). Two things they do
*not* share are the two things most likely to drift, and one has already
drifted into a user-visible bug.

**The Selected-day fallback is written out three times, verbatim:**

```ts
typeof selectedDay === "string" && isValidSqlDate(selectedDay)
  ? selectedDay
  : todaySql
```

at `app/tonight-actions.ts:50-54`, `app/log/actions.ts:45-49`, and
`app/rejection-actions.ts:176-180`. `lib/local-day.ts` already exports exactly
this as `parseSelectedDay(rawParam: unknown, todaySql: string)` — the page uses
it; the actions re-implement it.

**The revalidation set is derived per file, and the Catalog copy is wrong:**

| Helper | Revalidates |
| --- | --- |
| `revalidateLogViews` (`app/log/actions.ts:19`) | `/`, `/log`, `/catalog/[id]` |
| `revalidateRejectionViews` (`app/rejection-actions.ts:29`) | `/`, `/log`, `/catalog/[id]` |
| `revalidateCatalog` (`app/catalog/actions.ts:147`) | `/catalog`, `/catalog/[id]` — **no `/`** |
| `createOption` (`app/catalog/actions.ts:169`) | `/catalog` only |

**The bug:** Archiving, un-archiving, editing, or hard-deleting an Option
changes who is in **Tonight**'s ranked list, but never revalidates `/`. All
routes are `force-dynamic`, so a hard reload hides it; a client-side navigation
from `/catalog` back to Tonight shows the stale list. Issue 04 fixed the mirror
image of this for Rejection writes; the Catalog side was missed.

Do three things.

- **One day rule.** Delete the three hand-rolled ternaries and call
  `parseSelectedDay(selectedDay, today())` in each action. No new module —
  `lib/local-day.ts` already owns this and its test already covers it.
- **One revalidation module.** Create `app/revalidate.ts` exporting two
  functions, named for what changed rather than for a screen:
  - `revalidateDinnerViews()` — `/`, `/log`, `/catalog/[id]`; used by every Log
    and Rejection write (replacing both existing helpers, which are already
    identical).
  - `revalidateCatalogViews()` — `/`, `/catalog`, `/catalog/[id]`; used by
    every Catalog write including `createOption`. **The added `/` is the bug
    fix.**
  Both live in one file with a comment stating the rule: a write revalidates
  every route whose content it can change, and a Catalog write can change
  Tonight.
- **Two actions stop returning `void`.** `deleteLogEntry`
  (`app/log/actions.ts:129`) and `deleteRejection` (`app/rejection-actions.ts:143`)
  return `Promise<void>`, so their callers have nothing to check — notably
  `app/tonight-screen.tsx:436-439`, where a failed **Bring back** is silent.
  Both return `ActionResult`, and their callers surface `{ ok: false }` inline
  the way the other delete affordances already do.

**Out of scope, but record it.** `app/catalog/[id]/option-controls.tsx:69`
calls `rejectOption(option.id, reason)` with no day, so a **Reject** taken on
an Option detail page reached from Friday's Tonight is recorded against today.
Fixing it needs `?day=` threaded through the detail-page links in
`app/tonight-row.tsx`, `app/tonights-dinner-block.tsx`, and
`app/log/log-entry-row.tsx`, and a decision about what the detail page shows
for a non-today day — a product question, not a refactor. Leave the behaviour
as it is here and raise it separately.

No ADR change. No `CONTEXT.md` change.

## Acceptance criteria

- [ ] No action file contains the `isValidSqlDate(...) ? ... : todaySql`
      ternary; all three call `parseSelectedDay`
- [ ] `app/revalidate.ts` exports `revalidateDinnerViews` and
      `revalidateCatalogViews`; `revalidateLogViews`, `revalidateRejectionViews`,
      and `revalidateCatalog` are gone
- [ ] Every Catalog write — `createOption`, `updateOption`, archive,
      un-archive, hard-delete — revalidates `/`
- [ ] `deleteLogEntry` and `deleteRejection` return `ActionResult`, and their
      call sites (including Tonight's **Bring back**) surface a failure inline
- [ ] `app/catalog/actions.db.test.ts`, `app/log/actions.db.test.ts`, and
      `app/rejection-actions.db.test.ts` still pass, with the two delete tests
      updated for the new return type
- [ ] The detail-page Reject day gap is recorded as its own issue rather than
      fixed here
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green, and
      `pnpm build` passes with no env vars set
