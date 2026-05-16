"use server";

import {
  PLACES_UNAVAILABLE,
  createPlacesClient,
  type PlaceDetails,
  type PlaceSummary,
  type PlacesResult,
} from "../../lib/places";

/**
 * Server actions backing the Restaurant form's "Search Google" box. The
 * `GOOGLE_PLACES_API_KEY` is a server secret — the client never sees it, so
 * every Places call hops through the server here. When the key is unset both
 * actions return the typed "unavailable"; the box itself is not even rendered
 * in that case (see `placesEnabled`), so this is only a defensive floor.
 */

/** Build a Places client from the env key, or `null` when it is unset. */
function placesClient() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  return apiKey ? createPlacesClient(apiKey) : null;
}

/** Search Google for restaurants matching a free-text query. */
export async function searchGooglePlaces(
  query: string,
): Promise<PlacesResult<PlaceSummary[]>> {
  const client = placesClient();
  if (!client) return PLACES_UNAVAILABLE;
  return client.searchGoogle(query);
}

/** Fetch the autofill detail for one selected Google place. */
export async function fetchPlaceDetails(
  placeId: string,
): Promise<PlacesResult<PlaceDetails>> {
  const client = placesClient();
  if (!client) return PLACES_UNAVAILABLE;
  return client.getPlaceDetails(placeId);
}
