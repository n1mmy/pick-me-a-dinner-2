# 07 — Google Places autofill for Restaurants

Status: ready-for-agent
Type: AFK

## Parent

[PRD: Pick Me a Dinner — v1](../PRD.md)

## What to build

Google Places autofill on the Catalog add/edit Restaurant form.

Build the **Places client** as a deep module: `searchGoogle(query)` and
`getPlaceDetails(placeId)` behind a small interface, each carrying a request
timeout so a flaky network cannot hang the form. Network error, quota exceeded,
and any 4xx/5xx all map to a single typed "unavailable" result.

The Restaurant form gets a "Search Google" box. Selecting a result autofills
`name`, `address`, `phone`, `lat`, `lng`, `url` (website), `maps_url`, and
`google_place_id`; every autofilled field stays editable. When
`GOOGLE_PLACES_API_KEY` is unset, the box is not rendered at all and the form
degrades to plain manual entry. On a Places request failure the box shows an
inline "Google search unavailable — enter details manually" notice and the
manual fields stay fully editable, so a save still works.

Home meals have no Places integration — this issue touches only the Restaurant
form.

## Acceptance criteria

- [ ] The Places client is a deep module with a small interface; all failure
      modes (network/quota/4xx/5xx) map to one typed "unavailable" result; each
      request has a timeout
- [ ] Selecting a Google result autofills all eight fields; every field stays
      editable afterward
- [ ] With `GOOGLE_PLACES_API_KEY` unset, the Search Google box is not rendered
- [ ] A Places request failure shows the inline fallback notice; manual entry
      and save still work
- [ ] Tests (Places client stubbed): autofill populates the fields; key-unset
      hides the box; a request failure shows the fallback notice

## Blocked by

- Issue 02 — Catalog: Options CRUD (the Restaurant form)
