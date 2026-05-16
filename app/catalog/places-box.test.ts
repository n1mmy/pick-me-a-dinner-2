import { describe, expect, it } from "vitest";
import type { PlaceDetails } from "../../lib/places";
import {
  PLACES_UNAVAILABLE_NOTICE,
  autofillFromPlace,
  boxStateFromSearch,
} from "./places-box";

const fullDetails: PlaceDetails = {
  name: "El Comal",
  address: "123 Main St",
  phone: "+1 555-1234",
  lat: 37.7749,
  lng: -122.4194,
  url: "https://elcomal.example",
  mapsUrl: "https://maps.google.com/?cid=1",
  googlePlaceId: "place-1",
};

describe("autofillFromPlace", () => {
  it("maps every one of the eight fields a selected place fills in", () => {
    expect(autofillFromPlace(fullDetails)).toEqual({
      name: "El Comal",
      address: "123 Main St",
      phone: "+1 555-1234",
      lat: "37.7749",
      lng: "-122.4194",
      url: "https://elcomal.example",
      mapsUrl: "https://maps.google.com/?cid=1",
      googlePlaceId: "place-1",
    });
  });

  it("renders a missing coordinate as an empty, still-editable field", () => {
    const autofill = autofillFromPlace({
      ...fullDetails,
      lat: null,
      lng: null,
    });

    expect(autofill.lat).toBe("");
    expect(autofill.lng).toBe("");
  });
});

describe("boxStateFromSearch", () => {
  it("shows the hits when the search succeeds", () => {
    expect(
      boxStateFromSearch({
        ok: true,
        value: [{ placeId: "place-1", name: "El Comal", address: "123 Main St" }],
      }),
    ).toEqual({
      status: "results",
      results: [{ placeId: "place-1", name: "El Comal", address: "123 Main St" }],
    });
  });

  it("shows the fallback notice when a Places request fails", () => {
    expect(boxStateFromSearch({ ok: false })).toEqual({
      status: "unavailable",
    });
    expect(PLACES_UNAVAILABLE_NOTICE).toBe(
      "Google search unavailable — enter details manually",
    );
  });
});
