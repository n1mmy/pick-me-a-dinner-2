/**
 * Pure logic behind the "Search Google" box on the Restaurant form — kept
 * apart from the React component so it is directly unit-testable (the
 * `lib/tonight-filter.ts` pattern). The component is a thin renderer of the
 * state these functions produce.
 */
import type {
  PlaceDetails,
  PlaceSummary,
  PlacesResult,
} from "../../lib/places";

/** The inline notice shown when a Places request fails (plan §8). */
export const PLACES_UNAVAILABLE_NOTICE =
  "Google search unavailable — enter details manually";

/**
 * What the Search Google box is currently showing: nothing yet, a list of
 * hits to pick from, or the fallback notice after a request failed.
 */
export type PlacesBoxState =
  | { status: "idle" }
  | { status: "results"; results: PlaceSummary[] }
  | { status: "unavailable" };

/**
 * Fold a search result into the box state. Any failure — the typed
 * "unavailable" — shows the fallback notice; success shows the hits.
 */
export function boxStateFromSearch(
  result: PlacesResult<PlaceSummary[]>,
): PlacesBoxState {
  if (!result.ok) return { status: "unavailable" };
  return { status: "results", results: result.value };
}

/**
 * The eight Restaurant fields a selected Google place autofills, each as the
 * string the form's inputs hold. `lat`/`lng` render as their decimal text and
 * stay editable; a missing coordinate becomes an empty field.
 */
export type PlaceAutofill = {
  name: string;
  address: string;
  phone: string;
  lat: string;
  lng: string;
  url: string;
  mapsUrl: string;
  googlePlaceId: string;
};

/** Map a fetched `PlaceDetails` to the eight editable form-field strings. */
export function autofillFromPlace(details: PlaceDetails): PlaceAutofill {
  return {
    name: details.name,
    address: details.address,
    phone: details.phone,
    lat: details.lat === null ? "" : String(details.lat),
    lng: details.lng === null ? "" : String(details.lng),
    url: details.url,
    mapsUrl: details.mapsUrl,
    googlePlaceId: details.googlePlaceId,
  };
}
