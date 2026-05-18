# 01 — Option detail page: core (fields and ranking)

Status: done
Type: AFK

## Parent

[PRD: Option detail page](../PRD.md)

## What to build

The tracer bullet for the **Option detail page**: a member of the Household
taps an **Option**'s name on the **Catalog** screen and lands on a per-Option
page at `/catalog/[id]` that shows the Option's fields and its ranking data.

The page shows the Option's name, kind (**Home meal** / **Restaurant**), notes,
and its URL as a clickable link. For a **Restaurant** it also shows the
address, the phone number, and a link to the place data on Google Maps; for a
**Home meal** those Restaurant-only fields are omitted entirely. It shows the
Option's **Score** as a rounded whole number with a one-line caption noting the
Score is a point-in-time, comparative figure; the **per-Option recency** line
("18d" / "60d+" / "new"); and the Option's **Tag** chips tinted on the red→green
recency heatmap by each Tag's **per-Tag recency** — the same chips Tonight
shows.

A request for an id that matches no `options` row renders a not-found page.

This slice adds a pure single-Option ranking function (`rankOption`) to the
ranking module, reusing the existing recency internals — the Score formula is
unchanged. For an active Option its result must equal that Option's row in
`rankTonight` over the same inputs, so the detail page and Tonight never
disagree. (The Archived case — `score: null` — is exercised in issue 05; the
function should already return it.)

The page follows the `DESIGN.md` visual system. Only the Catalog row's Option
name becomes a link in this slice; Tonight and Log links come in issue 06.

## Acceptance criteria

- [x] `/catalog/[id]` renders a detail page for an active Option of either kind
- [x] A request for an id matching no Option renders a not-found page
- [x] The page shows the name, kind, notes, and the URL as a clickable link
- [x] For a Restaurant the page shows address, phone, and a Google Maps link; for a Home meal these are omitted
- [x] The page shows the Score as a rounded whole number with a caption noting it is a point-in-time comparative figure
- [x] The page shows the per-Option recency line and the Tag chips tinted on the recency heatmap
- [x] `rankOption`'s result for an active Option matches that Option's `rankTonight` row over the same inputs
- [x] `lib/ranking.test.ts` covers `rankOption` — active Option matches `rankTonight`, the never-eaten flag and `CAP` recency
- [x] The Option name on the Catalog row links to its detail page
- [x] The full gate passes — `pnpm typecheck`, `lint`, `test`, `build`

## Blocked by

- None — can start immediately
