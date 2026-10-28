# 05 — Prepared brief and layer line: one design pass

Status: ready-for-agent
Type: AFK

## Parent

[Prepared notes: pre-landing review](../../../plans/prepared-notes-review.md)
— findings D1–D7 and M4;
[Code review 2026-10-23](../../../plans/code-review-2026-10-23.md) —
Standards #1, #3, #4. Also carries the 1280px and 375px layout check that
architecture issue 05 ticked without running.

## What to build

Read `DESIGN.md` "Prepared brief", "AI layers", "Typography", "Motion", and
"Focus" first. Every item below is a rule already written there.

1. **D2 — the label's time isn't in Geist Mono** (hard violation).
   `lib/prepared-label.ts:32` returns `Prepared 2:14pm` as one string and
   `app/prepared-brief.tsx:53` renders it in sans. Return the prefix and the
   time separately (`{ prefix: "Prepared Mon", time: "9:40pm" }` or similar)
   and render the time in `font-mono tabular-nums`. `preparedLabel`'s tests
   follow.
2. **D5 — the frozen brief has no `.expand-in`.** "Read the note" mounts the
   brief fresh (`app/prepared-brief.tsx:57`); Motion requires `.expand-in` on
   a disclosure body's arrival, as the Rejected and Closed disclosures do.
   Add it when `decided`.
3. **D4 — the LayerLine hit area bleeds onto a row in decided mode.**
   `-my-3` (`app/tonight-screen.tsx:992`) assumes `main`'s 22px gap; the
   decided-mode picker section uses `gap-2` (`:430`), so the 44px target
   overlaps the first row by 4px, against "never onto a row". Wrap the
   LayerLine and its list in one `flex flex-col gap-3` container in both
   branches so the bleed is the same in each mode.
4. **D6 — the LayerLine button has no hover or press state and a ~30px
   target.** Add `hover:bg-raised rounded-control duration-micro` and `px-2`
   with a matching `-mx-2`, like the brief's own toggle.
5. **D1 — focus drops to `<body>`** after "Show ranked list" (`:933`) and
   after "AI search · Clear" when no note is underneath (`:910`): the
   focused button unmounts. Move focus to a stable target after the layer is
   peeled off — the list's first row or the filter zone — per "Focus".
6. **D3 — the list live region is conditional** (`:382`). Stepping from a
   no-note day to a note day with Claude search off mounts it already
   holding "Showing the prepared ranking.", which screen readers don't
   announce; it can also say so when no list renders. Render it
   unconditionally, empty when no list is shown.
7. **D7 — the brief's numerals aren't mono.** Rationales wrap prose in
   `MonoNumerals` (`app/tonight-row.tsx:183`); the brief renders raw text
   (`app/prepared-brief.tsx:64`). Export `MonoNumerals` and use it. Confirm
   first that the brief ever carries numerals the rule covers (prompt v10
   keeps counts out of the prose); if it never does, record that in Comments
   and skip.
8. **M4 — `aria-controls` points at an unrendered element** on a decided
   date with the brief collapsed (`app/prepared-brief.tsx:73`). Set it only
   while the brief is rendered.

Then the `/browse` check: Tonight at 1280px and 375px on today, a Picked
day, and a day with a note and Closed and Rejected Options, against
DESIGN.md. If the browser is unavailable, leave the box unticked and say so
in Comments; do not tick it.

## Acceptance criteria

- [ ] `lib/prepared-label.test.ts` and `app/tonight-screen.test.tsx` cover
      the split label, the `expand-in` class on a decided-date brief, the
      unconditional live region, and focus landing on the list after
      dismissal
- [ ] `DESIGN.md` updated in the same commit only where a rule changes
      (none expected; the items above apply rules already written)
- [ ] 1280px and 375px layouts checked in a browser, or left unticked with a
      Comment
- [ ] `corepack pnpm typecheck`, `lint`, `test`, `build` all green

## Blocked by

- Issue 04 (the brief's `decided` input changes shape there). Fifth in the
  review's suggested order.
