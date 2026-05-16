import { afterEach, describe, expect, it, vi } from "vitest";

// The actions are authedAction-wrapped (F1); stub the session check so the
// tests drive the action bodies directly.
vi.mock("../../lib/require-session", () => ({
  requireSession: vi.fn(async () => {}),
}));

import { fetchPlaceDetails, searchGooglePlaces } from "./places-actions";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("with GOOGLE_PLACES_API_KEY unset", () => {
  it("searchGooglePlaces returns the typed unavailable", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
    expect(await searchGooglePlaces("comal")).toEqual({ ok: false });
  });

  it("fetchPlaceDetails returns the typed unavailable", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
    expect(await fetchPlaceDetails("place-1")).toEqual({ ok: false });
  });
});

describe("with GOOGLE_PLACES_API_KEY set", () => {
  it("searchGooglePlaces delegates to the Places client", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "a-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            places: [
              {
                id: "place-1",
                displayName: { text: "El Comal" },
                formattedAddress: "123 Main St",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ) as unknown as typeof fetch,
    );

    expect(await searchGooglePlaces("comal")).toEqual({
      ok: true,
      value: [{ placeId: "place-1", name: "El Comal", address: "123 Main St" }],
    });
  });
});
