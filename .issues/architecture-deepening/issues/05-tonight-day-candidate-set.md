# 05 — Concentrate Tonight's Selected-day suppression into one module

Status: done
Type: AFK

## What to build

"Is this Option choosable on day D?" currently has four answers in four places,
and only `app/page.tsx` knows they compose:

| Why an Option is not in the picker | Where that lives today |
| --- | --- |
| **Archived** | SQL only — `db/queries.ts` (`eq(options.active, true)`) |
| Already **Picked** for the day | `splitTonight` (`lib/tonights-dinner.ts`) |
| **Rejected** for the Selected day | an inline `Set` + `.filter` at `app/page.tsx:91-94` |
| **Closed day** on the Selected day | `partitionClosedRows` (`lib/closed-days.ts`) |

The *order* of the last two is load-bearing — a Restaurant both closed and
rejected for the Selected day must land in the Rejected disclosure only, never
in both — and it is documented in prose twice (`app/page.tsx:96-101` and
`lib/closed-days.ts:36-38`, "`app/page.tsx` applies the Rejection filter
first") but enforced nowhere. Swap the two statements and Options move between
the two disclosures with no test failing, because no test imports
`app/page.tsx`. The same page also calls `rankTonight` twice — once over the
day's entries and once over the entries strictly before it, to give the decided
block its pre-Pick recency — and the fact that the two rankings must agree is
likewise a page-level fact no module states.

Move the whole decision behind one interface.

- Create `lib/tonight-day.ts`. It exports one function,
  `tonightForDay(input)`, taking the Selected day and the day's raw data:
  - `options` — the active Catalog (`getTonightData`'s `options`), carrying
    `closedDays`.
  - `logEntries` — the non-future-relative-to-the-day Log entries, each with
    `optionId`, `eatenOn` (SQL date), `createdAt`, `note`.
  - `dayEntries` — the Selected day's Log entries (`getTonightData`'s
    `todayEntries`).
  - `rejectedOptionIds` — the Option ids carrying a **Rejection** dated the
    Selected day (`getTodayRejections`'s rows reduced to ids).
  - `selectedDay` — the Selected day as a SQL date.

  and returning everything the screen renders:
  `{ tonightsDinner, picker, closed, lastNotes, allFiltered }`.

- Inside, in this order — the order is now the module's, and gets a test:
  1. epoch-day conversion of `logEntries` (`epochDayFromSqlDate`),
  2. `rankTonight` over the day's entries,
  3. `rankTonight` over the entries strictly before the day → `decidedRows`,
  4. `splitTonight` → `tonightsDinner` + `picker`,
  5. drop the `rejectedOptionIds` from the picker,
  6. `partitionClosedRows` over what is left → `picker` + `closed`,
  7. `lastNotesByOption` for every row type,
  8. `allFiltered` = the picker had rows before steps 5-6 and none after.

- `app/page.tsx` keeps the two `Promise.all` reads, `today()`,
  `parseSelectedDay`, and `aiSearchEnabled()`, then calls `tonightForDay` once
  and spreads the result into `<TonightScreen>`. Every `epochDayFromSqlDate`
  call, both `rankTonight` calls, `splitTonight`, the rejection `Set`,
  `partitionClosedRows`, `lastNotesByOption`, and the `allFiltered` expression
  leave the page. The props `TonightScreen` receives are unchanged.

- `lib/ranking.ts`, `lib/tonights-dinner.ts`, `lib/closed-days.ts`, and
  `lib/last-note.ts` keep their current interfaces and tests — they become
  `tonight-day`'s internals rather than the page's collaborators.
  `partitionClosedRows` loses its "`app/page.tsx` applies the Rejection filter
  first" comment, which now describes `tonight-day`'s own step 5 → 6.

- New `lib/tonight-day.test.ts` covers the composition the old prose asserted,
  including at minimum:
  - a Restaurant both **closed** on the Selected day and **rejected** for it
    appears in neither the picker nor `closed` — the Rejected disclosure, fed
    from the caller's own rejection rows, is its only home;
  - the decided block's rows carry pre-Pick recency (the second ranking), while
    the picker's carry the day's;
  - an Option Picked for the day is absent from the picker;
  - `allFiltered` is true when Rejections and/or Closed days empty a
    non-empty picker, and false for a genuinely empty Catalog.

**Decided design — what stays out.** `tonightForDay` is pure: it does no DB
reads and no `today()` call, so it stays directly unit-testable and the page
keeps owning its queries. The **Archived** rule stays in SQL
(`getTonightData`); this module documents it as an input precondition rather
than re-filtering. AI search's candidate set is *not* folded in here — it
drops closed Restaurants entirely while Tonight keeps them in the **Closed
disclosure** with full controls, so the two share the predicate `isClosedOn`,
not the consequence. Add one line to `lib/closed-days.ts`'s module comment
recording that divergence, since today nothing states it.

This touches no ADR: suppression stays a presentation filter applied after a
pure `rankTonight` (ADR-0003, ADR-0006, ADR-0010), and no **Score** moves. No
`CONTEXT.md` change — "candidate set", "Closed disclosure", and "Selected day"
are already glossary terms and the module uses them as written.

## Acceptance criteria

- [ ] `lib/tonight-day.ts` exports `tonightForDay` and is pure — no DB import,
      no `today()`, no React
- [ ] `app/page.tsx` contains no `rankTonight`, `splitTonight`,
      `partitionClosedRows`, `lastNotesByOption`, `epochDayFromSqlDate`, or
      rejection-`Set` call; the props passed to `<TonightScreen>` are unchanged
- [ ] The Rejection-before-Closed order lives in `lib/tonight-day.ts` and is
      asserted by a test: an Option both rejected and closed for the Selected
      day is in neither the picker nor `closed`
- [ ] The decided block's rows still show pre-Pick recency, covered by a test
- [ ] `allFiltered` distinguishes "filtered empty" from "empty Catalog",
      covered by a test
- [ ] `lib/closed-days.ts` records that Tonight keeps closed rows while AI
      search drops them
- [ ] Tonight's on-screen behaviour is unchanged for today, a past day, and a
      future day — `app/tonight-screen.test.tsx` passes untouched
- [ ] No ADR change and no `CONTEXT.md` change
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green, and
      `pnpm build` passes with no env vars set
