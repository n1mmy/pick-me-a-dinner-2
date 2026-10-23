# Architecture deepening (2026-10-23) — plan

Status: **approved design, not started** (2026-10-23). The candidates came out
of an `/improve-codebase-architecture` review of the recent hot spots (Prepared
notes, AI search, Tonight, the Log and Rejection write paths); the decisions
below came out of the `/grilling` session that followed.

This plan is the source of truth for the work: what changes, in what order, and
how each slice is verified. Issues live in
`.issues/architecture-deepening-2026-10-23/issues/`.

Domain terms: `CONTEXT.md` (**Prepared note**, **Selected day**, **Pick**,
**Rejection**, **Day decision**, **Closed disclosure**, **Last note**).
Architecture vocabulary (module, interface, depth, seam, adapter, leverage,
locality) is the `/codebase-design` skill's. ADR-0011 was amended in the same
commit as this plan: a note also freezes once its date has passed.

## Why

Each candidate turns a cluster of shallow modules, or a rule spread across
callers, into one deep module whose interface is also its test surface. Three
of them also carry suspected bugs found while reading (not yet reproduced):

- A past date with a Prepared note and no Pick reads "out of date, updating"
  forever: `lib/tonight-prepared-note.ts` has no today..+6 window, and the
  sweep never revisits past dates.
- A Pick made during an hour-long sweep lets that date's frozen note be
  overwritten: `runSweep` reads decided dates once
  (`lib/prepared-notes-job.ts:141`) and stores without re-checking (`:160`).
- "Decided" has three definitions: active-Option Log entries (sweep),
  `todayEntries.length` (page), `eaten.length` (`PreparedBrief`).
- `updateLogEntry` can move a Log entry onto a date where that Option has a
  Rejection, and leaves the Rejection in place.
- Tonight's Rejected disclosure reads raw Rejections (`app/page.tsx:91`), so a
  Picked-and-Rejected Option shows in both the decided block and "Rejected
  tonight".

**Each suspected bug becomes a failing test first; the refactor turns it
green.** A test that won't go red means the bug wasn't real — drop it and say
so in the issue's Comments.

## Decisions settled in the grill

1. **Decided** means the date has any Log entry, including a Pick of an Option
   since Archived (`CONTEXT.md`: **Day decision**).
2. **A Prepared note freezes** once its date is decided **or has passed**. A
   frozen note is never out of date.
3. **Storing a note** is one conditional update: write only if the date still
   has no Log entry; release the claim either way. No other locking.
4. **A Pick wins.** An Option has a Pick or a Rejection on a date, never both.
   A Pick (one tap, typed date, or a Log entry edited onto the date) removes the
   Rejection; a Rejection of an Option already Picked on that date (created,
   from the Option detail page, or edited onto the date) is refused with
   "Already picked for that date — remove the Pick first".
5. **Enforced in code only** — no database trigger. A read-only check of the
   local prod copy (2026-10-23: 88 Rejections, 212 Log entries) found no
   (Option, date) with both, so there is no cleanup migration.
6. **Snapshot order is canonical.** Same-date Log entries sort by a fixed key,
   so the input hash can't flip on Postgres row order. The one-time rewrite of
   every stored note this causes is accepted; no billed `ai-search-eval.ts` run
   — the prompt's content is unchanged, only possibly its order.
7. **The reply parser stays put.** `parseRankingText` stays in
   `lib/ai-search.ts`; sharing prompt framing between the two models is out of
   scope (review candidate 6, Speculative).
8. **`backfillOmittedCandidates` stays put.** It works on ids on the server
   before rows exist; only the two client-side ranking matches merge.
9. **`app/tonight-screen.tsx` is not split** into files. Moving code without
   hiding anything fails the deletion test.
10. **Everything lands on this branch** (`grill-ai-precomputed-dinner-notes`),
    before the Prepared notes deploy. Prepared notes issue 07 waits for all
    five issues here.
11. **Two open manual checks move here.** Prepared notes issue 06's freeze
    check moves into issue 01; issue 05's 1280px/375px layout check moves into
    issue 05's `/browse` check. Prepared notes 05 and 06 are marked `done`.

## Order

The tracker has no machine-readable `Blocked by:`, so the order is here:

| # | Issue | Review candidate | Dependency type |
|---|---|---|---|
| 01 | Prepared note status | 1 | Postgres (test DB) |
| 02 | Snapshot module | 5 | in-process + Postgres |
| 03 | Day decisions | 2 | Postgres (test DB) |
| 04 | Ranking resolution | 4 | in-process (pure) |
| 05 | Selected-day view | 3 | in-process (pure) |

- 01 first: it holds the freeze bugs and is the hottest code.
- 02 next: a stable snapshot order makes 01's hash trustworthy, and 02 moves
  `snapshotForDay`, which 01 calls.
- 03 depends on nothing; 05 relies on it (a Picked Option can no longer also
  be Rejected).
- 04 before 05, so the Selected-day view uses the ranking function rather than
  inlining it.

## The slices

### 01 — Prepared note status

Merge `lib/tonight-prepared-note.ts` into the sweep module and rename it
`lib/prepared-notes.ts`. Two entry points:

- **The sweep** — as today, but storing through the conditional update.
- **Tonight's read for a date** — the stored note plus whether it is frozen or
  out of date.

Behind them: the today..+6 window, frozen (decided or passed), the input hash,
and `LOCAL_AI_MODEL` read once. Decided dates get their own query;
`getFullLogForSnapshot` stays active-only because the AI snapshot reads it. `app/page.tsx` stops passing `decided` and
`model`; `PreparedBrief` stops overriding `outOfDate` itself. The brief still
starts hidden whenever the date has a Pick (`DESIGN.md` unchanged).
`instrumentation.ts` stops passing the model twice.

Verified by DB tests through the two entry points (past undecided date → never
out of date; a Pick landing between snapshot and store → note not overwritten;
an Archived Option's Pick → frozen), and by Prepared notes issue 06's
dev-server freeze check.

### 02 — Snapshot module

A new `lib/snapshot.ts` absorbs `lib/snapshot-source.ts` and, from
`lib/ai-search.ts`, the snapshot types and `buildSnapshot`. It returns **one**
built value carrying the snapshot, the index-to-id map, and the names; both
model clients (`createAiSearchClient`, `createPreparedNoteClient`) take that
value instead of a `(snapshot, idByIndex)` pair. Same-date Log entries sort by
a fixed key. `lib/snapshot-format.ts` stays (`lib/rejections.ts` uses it).

Verified by a new DB test for the snapshot (none exists today) including the
order-independence case, and by `app/api/ai-search/route.test.ts` dropping its
partial mock of `lib/ai-search` and its re-tests of candidate drops.

### 03 — Day decisions

Every write to `dinner_log` and `rejections` goes through a new
`lib/day-decisions.ts`: add a Pick (one tap or a typed date), edit or delete a
Log entry, create, edit, or delete a Rejection — each in its own transaction,
enforcing decision 4. The server actions in `app/log/actions.ts` and
`app/rejection-actions.ts` become thin callers: session, date parsing, error
messages, revalidation.

Verified by DB tests through the module (the rule from every entry point; the
rollback test drives the module, with no `db.transaction` Proxy), and a
`/browse` check of the refusal on the Option detail page and the Log screen.

### 04 — Ranking resolution

One pure function in `lib/picker-view.ts` replaces the Prepared-ranking reorder
(`app/tonight-screen.tsx:857-872`) and the AI-result match (`:883-890`): resolve
an id-ranked list against the rows on screen, deduplicating, and optionally
appending the rows it didn't name. `AiRankingRow` and `PreparedRankingRow`
become one type if nothing else distinguishes them.

Verified by plain unit tests; the existing screen tests pass unchanged.

### 05 — Selected-day view

`tonightForDay` returns one Selected-day view: whether it is today, the day
label and heading, the date writes go to (`undefined` for today), Tonight's
dinner, rows already tagged picked / rejected / closed with the Rejection's id
and reason, and the Last notes. `app/page.tsx` hands it to `TonightScreen`,
which drops from 13 props to about four (the view, the Prepared note, the
quick-add sources, whether search is enabled). Gone: the `SuppressedRows`
re-bundle, the parallel `rejectedTonight` / `rejectedRows` props, the six
`isToday ? undefined : selectedDay` repeats, and the `"tonight"` string
compare.

`app/tonight-screen.test.tsx` builds its input with `tonightForDay` from
Options, Log entries, and Rejections, in this issue; tests of prop combinations
production can't produce are deleted, not ported.

Verified by the converted screen tests and a `/browse` check of Tonight on
today, a Picked day, a future day, and a day with Closed and Rejected Options,
including the 1280px and 375px layouts against `DESIGN.md`.

## Gate

Every issue: `corepack pnpm typecheck`, `lint`, `test`, `build` green, plus
`test:db` for 01, 02, and 03.
