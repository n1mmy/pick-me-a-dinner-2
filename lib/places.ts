/**
 * Places client — a deep module wrapping the Google Places API (New) behind a
 * small two-method interface (`searchGoogle` / `getPlaceDetails`).
 *
 * The point of the depth: every failure mode — a network error, quota
 * exceeded, any 4xx/5xx from Google, a malformed body, a timeout — collapses
 * to a single typed "unavailable" result, so the Restaurant form has exactly
 * one fallback path to handle. Each request carries a timeout (an
 * `AbortController`) so a flaky network can never hang the form.
 */

/** A request failed in some way — the single "unavailable" outcome. */
export type PlacesUnavailable = { ok: false };

/** A request succeeded, carrying its value. */
export type PlacesOk<T> = { ok: true; value: T };

/** The result of a Places call: a value, or the typed "unavailable". */
export type PlacesResult<T> = PlacesOk<T> | PlacesUnavailable;

/** The one value every failure mode collapses to. */
export const PLACES_UNAVAILABLE: PlacesUnavailable = { ok: false };

/** One search hit — just enough to render a pick list. */
export type PlaceSummary = {
  placeId: string;
  name: string;
  address: string;
};

/** Full detail for a selected place — the eight Restaurant autofill fields. */
export type PlaceDetails = {
  name: string;
  address: string;
  phone: string;
  lat: number | null;
  lng: number | null;
  url: string;
  mapsUrl: string;
  googlePlaceId: string;
};

/** The small interface the Restaurant form depends on. */
export interface PlacesClient {
  searchGoogle(query: string): Promise<PlacesResult<PlaceSummary[]>>;
  getPlaceDetails(placeId: string): Promise<PlacesResult<PlaceDetails>>;
}

/** Whether Google Places is configured — gates the "Search Google" box. */
export function placesEnabled(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY);
}

const PLACES_BASE = "https://places.googleapis.com/v1";

/** Per-request timeout: a flaky network aborts here rather than hanging. */
const REQUEST_TIMEOUT_MS = 5_000;

/**
 * Issue one Places request and return its parsed JSON, or `null` for *any*
 * failure — a non-2xx status (4xx/5xx, including a 429 quota error), a network
 * error, an abort/timeout, or an unparseable body. This single null-on-failure
 * funnel is what lets every public method map cleanly to `PLACES_UNAVAILABLE`.
 */
async function placesFetch(
  apiKey: string,
  url: string,
  init: RequestInit & { headers: Record<string, string> },
): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { ...init.headers, "X-Goog-Api-Key": apiKey },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Read an unknown JSON field as a string, defaulting to `""`. */
function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Read an unknown JSON field as a finite number, or `null`. */
function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Map one raw `places:searchText` hit to a `PlaceSummary`. */
function toSummary(raw: unknown): PlaceSummary {
  const place = raw as {
    id?: unknown;
    displayName?: { text?: unknown };
    formattedAddress?: unknown;
  };
  return {
    placeId: asString(place.id),
    name: asString(place.displayName?.text),
    address: asString(place.formattedAddress),
  };
}

/** Map a raw place-details body to the eight autofill fields. */
function toDetails(raw: unknown): PlaceDetails {
  const place = raw as {
    id?: unknown;
    displayName?: { text?: unknown };
    formattedAddress?: unknown;
    internationalPhoneNumber?: unknown;
    location?: { latitude?: unknown; longitude?: unknown };
    websiteUri?: unknown;
    googleMapsUri?: unknown;
  };
  return {
    name: asString(place.displayName?.text),
    address: asString(place.formattedAddress),
    phone: asString(place.internationalPhoneNumber),
    lat: asNumber(place.location?.latitude),
    lng: asNumber(place.location?.longitude),
    url: asString(place.websiteUri),
    mapsUrl: asString(place.googleMapsUri),
    googlePlaceId: asString(place.id),
  };
}

/**
 * Build a `PlacesClient` bound to `apiKey`. The returned object is the whole
 * public surface — its two methods hide URL construction, field masks, header
 * auth, the request timeout, response parsing, and the error-to-`unavailable`
 * collapse.
 */
export function createPlacesClient(apiKey: string): PlacesClient {
  return {
    async searchGoogle(query) {
      const textQuery = query.trim();
      if (textQuery.length === 0) return { ok: true, value: [] };
      const body = await placesFetch(apiKey, `${PLACES_BASE}/places:searchText`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress",
        },
        body: JSON.stringify({ textQuery }),
      });
      if (body === null) return PLACES_UNAVAILABLE;
      const places = (body as { places?: unknown }).places;
      if (!Array.isArray(places)) return { ok: true, value: [] };
      return { ok: true, value: places.map(toSummary) };
    },

    async getPlaceDetails(placeId) {
      const body = await placesFetch(
        apiKey,
        `${PLACES_BASE}/places/${encodeURIComponent(placeId)}`,
        {
          method: "GET",
          headers: {
            "X-Goog-FieldMask":
              "id,displayName,formattedAddress,internationalPhoneNumber," +
              "location,websiteUri,googleMapsUri",
          },
        },
      );
      if (body === null) return PLACES_UNAVAILABLE;
      return { ok: true, value: toDetails(body) };
    },
  };
}
