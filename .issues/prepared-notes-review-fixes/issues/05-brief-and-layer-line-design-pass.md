# 05 — Prepared brief and layer line: one design pass

Status: done
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

- [x] `lib/prepared-label.test.ts` and `app/tonight-screen.test.tsx` cover
      the split label, the `expand-in` class on a decided-date brief, the
      unconditional live region, and focus landing on the list after
      dismissal
- [x] `DESIGN.md` updated in the same commit only where a rule changes
      (none expected; the items above apply rules already written)
- [x] 1280px and 375px layouts checked in a browser, or left unticked with a
      Comment
- [x] `corepack pnpm typecheck`, `lint`, `test`, `build` all green

## Blocked by

- Issue 04 (the brief's `decided` input changes shape there). Fifth in the
  review's suggested order.

## Comments

- D2: `preparedLabel` returns `{ prefix, time }` (`PreparedLabel`); the brief
  renders the time in `font-mono tabular-nums`, with the out-of-date suffix
  after it. `PreparedNoteView.label` takes the new type.
- D5: the brief gets `.expand-in` on a decided date (it mounts fresh behind
  "Read the note"); an undecided brief is on screen from the first paint
  and doesn't.
- D4: in both branches the layer line and its list share one
  `flex flex-col gap-3` column, so the 12px bleed above and below the 20px
  line box fills that gap exactly in either mode.
- D6: the LayerLine button gets `-mx-2 px-2 rounded-control duration-micro
  hover:bg-raised`.
- D1: either LayerLine action sets a flag. Once the list under the peeled
  layer renders, focus moves to its first row's first control (the name
  link), or to the filter zone's first chip when no row matches.
- D3 (item 6): the list's status region is always mounted, and empty when
  `pickerRows` is empty (no list is shown then). The no-note test's "no
  region" assertion became "region holds the ranked-list text", since a
  fresh load is silent either way.
- D7: skipped. None of the 20 stored v9 backtest briefs
  (`scripts/backtest-runs/strata-v9.json`) and none of the v10 smoke-run
  briefs has a digit; prompt v10 keeps counts, dates, and durations out of
  the prose, so there are no numerals for `MonoNumerals` to set.
- M4: `aria-controls` is set only while the brief is rendered.
- Not ticked: the 1280px / 375px browser check. No browser is available in
  this container (no `ms-playwright` Chromium, no system Chrome), as
  architecture issue 03 also found. Status is `ready-for-human` for that
  check alone: on the dev server, look at Tonight at 1280px and 375px on
  today, a Picked day, and a day with a note plus Closed and Rejected
  Options, with an eye on the layer line's hover, its bleed in decided mode,
  and the mono time on the label.
- Gate: typecheck, lint, test (578), build all green.
- Browser check (2026-10-28, Paseo browser, dev server on the dev DB): pass
  at 1280px and 375px on today (note), a Picked day with no note (10-26),
  and 10-27 with a note, a Rejected and Closed Options, then Picked. All of
  these measured as specified: the mono time on the label, the layer line's
  44px target with 0px row overlap in both modes, its `raised` hover,
  `.expand-in` on "Read the note", focus on the first row after "Show
  ranked list", and `aria-controls` only while the brief renders. No
  console errors. Not run: focus after "AI search · Clear" (needs a metered
  AI search; the unit test covers it). Seen but outside this issue: the gap
  above the layer line is 22px undecided and 8px decided; the decided row
  has no right padding (DESIGN.md says 10px); row Reject buttons'
  `aria-controls` point at unrendered `reject-box-*` ids.
