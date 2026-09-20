# 09 — One combobox module behind Tonight's search box and the Option forms

Status: done
Type: AFK

## What to build

The known-item typeahead exists twice.

- `app/option-combobox.tsx` (241 lines) — used by the Log forms and the Option
  detail forms, and covered by `app/option-combobox.test.tsx`.
- `SearchBox` inside `app/tonight-screen.tsx:834-1135` — a second
  implementation folded into Tonight's search box when the typeahead was added
  there, with **no test of its own**.

They differ in three ways, two of them deliberate and one incidental:

| | `option-combobox.tsx` | `SearchBox` |
| --- | --- | --- |
| empty query | `return choices` — show everything | `return []` — show nothing (deliberate: the box is also an AI search field) |
| initial `activeIndex` | `0` — Enter picks the first match | `-1` — Enter submits the AI search (deliberate) |
| filter | lowercase substring (`:87-91`) | lowercase substring (`:907-913`) — the same code |

Plus its own `handleKeyDown` (`:937-960`), its own `pickError` state, and its
own pick transition (`:918-935`). So the untested copy is the one on the home
screen, and the two copies will drift on any keyboard-behaviour change.

Make the two differences inputs to the tested module.

- `app/option-combobox.tsx` gains two optional props:
  - `emptyQueryBehaviour?: "all" | "none"` (default `"all"`, preserving today's
    form behaviour);
  - `initialActiveIndex?: 0 | -1` (default `0`).
  Everything else — the filter, the keyboard handling, the listbox markup and
  ARIA wiring, the pick transition — stays as it is and stays the single
  implementation.
- Tonight's `SearchBox` keeps what is genuinely its own — the query state it
  shares with AI search, the submit/clear affordances, the pending and error
  states, the sticky header layout — and renders the combobox for the
  typeahead half instead of reimplementing it. Its bespoke `handleKeyDown`,
  filter, and `activeIndex` state go.
- Enter with no active option still submits the AI search; Enter on an active
  option still Picks it. This is the one behaviour to watch: cover it with a
  test in `app/tonight-screen.test.tsx` if it is not already pinned there.
- `app/option-combobox.test.tsx` gains cases for both new props — empty query
  with `"none"` shows no listbox, and `initialActiveIndex: -1` leaves no option
  active until the first arrow key.

`app/tonight-screen.tsx` should lose roughly 300 lines. No visual change: the
two boxes keep their current appearance and `DESIGN.md` is unaffected. No ADR
change, no `CONTEXT.md` change.

## Acceptance criteria

- [x] One typeahead implementation remains; `app/tonight-screen.tsx` contains
      no substring filter, no `activeIndex` state, and no listbox keyboard
      handler
- [x] `emptyQueryBehaviour` and `initialActiveIndex` default to today's form
      behaviour, so the Log and detail forms are unchanged
- [x] Tonight's search box still: shows no suggestions on an empty query,
      submits the AI search on Enter with nothing active, and Picks on Enter
      with an option active — each covered by a test
- [x] `app/option-combobox.test.tsx` covers both new props
- [x] No visual change to either box
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green

## Comments

- Acceptance criteria were ticked prematurely when `Status` was first set to
  `done`: the filter and keyboard contract were shared, but the listbox
  markup and ARIA wiring were still duplicated verbatim (including a second
  `kindLabel`), so "one typeahead implementation" was not literally true and
  `app/tonight-screen.tsx` had netted only −12 lines, not the ~300 the issue
  estimated.
- Fixed by extracting the shared `<ul role="listbox">` + row rendering into a
  new `OptionListbox` component in `app/option-combobox.tsx`, parameterized
  on the two genuine differences (`isSelected`, `showNoMatchesRow`) plus each
  caller's own wrapper/row classes. Both `OptionCombobox` and Tonight's
  `SearchBox` now render it instead of hand-rolling their own markup; the
  duplicate `kindLabel` in `tonight-screen.tsx` is deleted. No prop, class,
  or DOM structure changed, so there is no visual change to either box.
  `pnpm typecheck`, `pnpm lint`, `pnpm test` (347 passing), and `pnpm build`
  all verified green after the change.

## Blocked by

- [08 — Deepen `lib/tonight-filter` into the Picker's view model](./08-picker-view-model.md)
  — sequencing only: both edit `app/tonight-screen.tsx` heavily.
