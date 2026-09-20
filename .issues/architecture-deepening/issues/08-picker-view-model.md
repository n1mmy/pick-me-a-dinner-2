# 08 — Deepen `lib/tonight-filter` into the Picker's view model

Status: done
Type: AFK

## What to build

`lib/tonight-filter.ts` is 102 lines behind five exports
(`cycleChipState`, `chipStateLabel`, `filterTonightRows`, `distinctTags`,
`filterHint`), every one of them used by exactly one consumer — the `Picker`
inside `app/tonight-screen.tsx`. Its interface is a 1:1 restatement of what the
Picker does, which is the shallow shape: deleting the module today would move
its complexity into the screen, not concentrate it anywhere.

Worse, the split fell on the wrong side of the risk. The module holds the
easily-tested half (a predicate over rows), while the rules most likely to
break stayed in the screen and are reachable only by rendering:

- `rankOf` (`app/tonight-screen.tsx:643-646`) is built from the **unfiltered**
  rows, so a filtered row keeps its true rank (#4, #7, …) rather than being
  renumbered. Nothing states this outside a comment.
- `choices` (`:630-640`) re-derives the typeahead's candidates from the same
  rows and re-sorts them by name, so the typeahead inherits the picker's
  suppression exactly — the invariant that a typeahead pick can never hit an
  already-Picked or Selected-day-rejected Option.
- `visible` (`:647-650`) and `hint` (`:651`) are the module's own outputs.

Turn the module into the Picker's view model: it should produce everything the
Picker renders from the ranked rows and the filter state, rather than one
predicate the Picker uses.

- Rename `lib/tonight-filter.ts` → `lib/picker-view.ts` (and its test
  alongside), and give it one primary export:

  ```ts
  pickerView(rows: TonightRow[], kind: KindFilter, tagFilters: TagFilters): {
    visible: TonightRow[];   // filtered, in rank order
    rankOf: Map<string, number>;  // from the UNFILTERED rows
    choices: OptionChoice[]; // name-sorted, derived from the unfiltered rows
    tags: string[];          // distinct Tags for the chip row
    hint: string;
  }
  ```

- `cycleChipState` and `chipStateLabel` stay exported — they are the chip
  affordance's own interface, called from the chip's click handler and its
  accessible name, not part of the view model. `filterTonightRows`,
  `distinctTags`, and `filterHint` become private: `pickerView` is the seam.
- The `Picker` keeps `tagFilters` state and calls `pickerView` in one `useMemo`.
  The three separate `useMemo`s for `tags`, `choices`, and `rankOf`, and the
  bare `filterHint` call, all go.
- `aiRows` (`:671-678`) stays in the screen — it depends on `aiResults`, which
  is search state rather than filter state, and folding it in would widen the
  interface for no locality gain.
- `lib/picker-view.test.ts` keeps the existing filter cases and adds the two
  rules the screen was carrying:
  - filtering a row out does **not** renumber the rows that remain — `rankOf`
    still reports each Option's position in the full ranking;
  - `choices` contains exactly the Options in `rows`, name-sorted — so the
    typeahead cannot offer an Option the picker has suppressed.

No behaviour change on screen; `app/tonight-screen.test.tsx` passes untouched.
No ADR change, no `CONTEXT.md` change.

## Acceptance criteria

- [ ] `lib/picker-view.ts` exports `pickerView`, `cycleChipState`, and
      `chipStateLabel`; `filterTonightRows`, `distinctTags`, and `filterHint`
      are private to the module
- [ ] `lib/tonight-filter.ts` is gone; no import of it remains
- [ ] The `Picker` derives `visible`, `rankOf`, `choices`, `tags`, and `hint`
      from one `pickerView` call
- [ ] A test asserts rank numbers come from the unfiltered rows
- [ ] A test asserts `choices` mirrors the picker's rows exactly
- [ ] `app/tonight-screen.test.tsx` passes with no changes to its assertions
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green
