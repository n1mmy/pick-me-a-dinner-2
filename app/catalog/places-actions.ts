"use server";

import { authedAction } from "../../lib/authed-action";
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
 *
 * Both actions are `authedAction`-wrapped (review fix F1): a Server Action is
 * reachable by id from any route, so without the wrapper an anonymous caller
 * could drive the billed Google Places API.
 */

/** Build a Places client from the env key, or `null` when it is unset. */
function placesClient() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  return apiKey ? createPlacesClient(apiKey) : null;
}

/** Search Google for restaurants matching a free-text query. */
export const searchGooglePlaces = authedAction(
  async (query: string): Promise<PlacesResult<PlaceSummary[]>> => {
    const client = placesClient();
    if (!client) return PLACES_UNAVAILABLE;
    return client.searchGoogle(query);
  },
);

/** Fetch the autofill detail for one selected Google place. */
export const fetchPlaceDetails = authedAction(
  async (placeId: string): Promise<PlacesResult<PlaceDetails>> => {
    const client = placesClient();
    if (!client) return PLACES_UNAVAILABLE;
    return client.getPlaceDetails(placeId);
  },
);
