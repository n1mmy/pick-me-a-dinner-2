# 03 — "Add 'X'…" row and the inline add form on Tonight

Status: done
Type: AFK

## Parent

[PRD: Add an Option from Tonight](../PRD.md)

## What to build

**The Add row.** In Tonight's `SearchBox` dropdown, append a last row `Add
"<query>"…` whenever the trimmed query is non-empty and no candidate from issue
02 (all active Options, whatever their suppression) has that exact name,
case-insensitive. The dropdown now also opens when the Add row is the only row.
It is never the default highlight (`initialActiveIndex: -1` stays), so Enter
with nothing highlighted still runs AI search. It is reachable with ↑/↓.

**The form.** Selecting the Add row closes the dropdown and expands
`OptionForm` (`app/catalog/option-form.tsx`) inline directly below the search
box, pushing the list down (DESIGN.md: medium inline expand, no modal):

- Name prefilled with the typed query.
- Kind **Restaurant**, with a Home meal / Restaurant switch inside the form.
  Always Restaurant by default; do not derive it from the KindSegment.
- Places search available as in Catalog (`placesEnabled` passed down from
  `app/page.tsx`); Closed days, Notes, Tags as usual. `allTags` must also reach
  Tonight.
- If the name matches an **Archived** Option (case-insensitive), show a warning
  line above the buttons — "Aji Ichi is archived" — linking to its detail page.
  Saving is still allowed.

**Buttons.** `OptionForm` gains an optional secondary save. Here:

- Primary **Add & Pick for tonight** / **Add & Pick for Friday** (the Selected
  day's label; any day, past included). Creates the Option, then Picks it for
  the Selected day.
- Secondary **Add**. Creates only; the new Option appears in the ranked list
  with its `new` Recency chip.
- Cancel closes the form and keeps the query.

Both saves clear the query and close the form. `createOption`
(`app/catalog/actions.ts:146`) returns the new id (`{ ok: true, id }`) so Add &
Pick can call `pickTonight(id, day)`. If the Pick fails after the create
succeeded, show the Pick error inline; the Option stays created.

Catalog's add flow is unchanged apart from ignoring the returned id.

## Acceptance criteria

- [ ] Typing a name matching no active Option shows only the Add row
- [ ] Typing "Thai" with "Thai Orchid" in the Catalog shows both, Add row last
- [ ] Typing an exact existing name (any case, any suppression) shows no Add row
- [ ] Enter with nothing highlighted runs AI search even with the Add row shown
- [ ] Selecting the Add row opens the inline form prefilled with the name, kind
      Restaurant, switchable to Home meal
- [ ] Add & Pick creates the Option and Picks it for the Selected day; the
      button label is day-aware; it works for a past Selected day
- [ ] Add creates without Picking; the Option appears in the ranked list
- [ ] A name matching an Archived Option shows the warning with a detail-page
      link
- [ ] Catalog's add flow still works
- [ ] Tests cover the Add row rules, both saves, and the Archived warning
- [ ] Matches `DESIGN.md`; keyboard-operable with visible focus
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green

## Blocked by

- Issue 02 — the Add row's exact-name check runs against its widened candidate
  set
