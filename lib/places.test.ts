import { afterEach, describe, expect, it, vi } from "vitest";
import { createPlacesClient, placesEnabled } from "./places";

/** A JSON `Response`, as the global `fetch` would return. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Stub the global `fetch` with a single canned outcome. */
function stubFetch(impl: typeof fetch): void {
  vi.stubGlobal("fetch", impl);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("placesEnabled", () => {
  it("is true only when GOOGLE_PLACES_API_KEY is set", () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "a-key");
    expect(placesEnabled()).toBe(true);

    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
    expect(placesEnabled()).toBe(false);
  });
});

describe("searchGoogle", () => {
  it("parses search hits into PlaceSummary values", async () => {
    stubFetch(
      vi.fn(async () =>
        jsonResponse({
          places: [
            {
              id: "place-1",
              displayName: { text: "El Comal" },
              formattedAddress: "123 Main St",
            },
          ],
        }),
      ) as unknown as typeof fetch,
    );

    const result = await createPlacesClient("key").searchGoogle("comal");

    expect(result).toEqual({
      ok: true,
      value: [{ placeId: "place-1", name: "El Comal", address: "123 Main St" }],
    });
  });

  it("returns an empty list for a blank query without calling fetch", async () => {
    const fetchSpy = vi.fn();
    stubFetch(fetchSpy as unknown as typeof fetch);

    const result = await createPlacesClient("key").searchGoogle("   ");

    expect(result).toEqual({ ok: true, value: [] });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("treats a quota error (HTTP 429) as unavailable", async () => {
    stubFetch(
      vi.fn(async () =>
        jsonResponse({ error: "quota" }, 429),
      ) as unknown as typeof fetch,
    );

    const result = await createPlacesClient("key").searchGoogle("comal");

    expect(result).toEqual({ ok: false });
  });

  it("treats a 4xx response as unavailable", async () => {
    stubFetch(
      vi.fn(async () => jsonResponse({}, 403)) as unknown as typeof fetch,
    );

    expect(await createPlacesClient("key").searchGoogle("comal")).toEqual({
      ok: false,
    });
  });

  it("treats a 5xx response as unavailable", async () => {
    stubFetch(
      vi.fn(async () => jsonResponse({}, 502)) as unknown as typeof fetch,
    );

    expect(await createPlacesClient("key").searchGoogle("comal")).toEqual({
      ok: false,
    });
  });

  it("treats a network error as unavailable", async () => {
    stubFetch(
      vi.fn(async () => {
        throw new TypeError("network down");
      }) as unknown as typeof fetch,
    );

    expect(await createPlacesClient("key").searchGoogle("comal")).toEqual({
      ok: false,
    });
  });

  it("treats a request that exceeds its timeout as unavailable", async () => {
    vi.useFakeTimers();
    // A fetch that never resolves — it only rejects when its signal aborts.
    stubFetch(
      ((_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        })) as typeof fetch,
    );

    const pending = createPlacesClient("key").searchGoogle("comal");
    await vi.advanceTimersByTimeAsync(6_000);

    expect(await pending).toEqual({ ok: false });
  });
});

describe("getPlaceDetails", () => {
  it("maps a place body to the nine autofill fields", async () => {
    stubFetch(
      vi.fn(async () =>
        jsonResponse({
          id: "place-1",
          displayName: { text: "El Comal" },
          formattedAddress: "123 Main St",
          internationalPhoneNumber: "+1 555-1234",
          location: { latitude: 37.7749, longitude: -122.4194 },
          websiteUri: "https://elcomal.example",
          googleMapsUri: "https://maps.google.com/?cid=1",
          regularOpeningHours: {
            // Tue–Sat dinner service; shut Sunday and Monday.
            periods: [2, 3, 4, 5, 6].map((day) => ({
              open: { day, hour: 17, minute: 0 },
              close: { day, hour: 22, minute: 0 },
            })),
          },
        }),
      ) as unknown as typeof fetch,
    );

    const result = await createPlacesClient("key").getPlaceDetails("place-1");

    expect(result).toEqual({
      ok: true,
      value: {
        name: "El Comal",
        address: "123 Main St",
        phone: "+1 555-1234",
        lat: 37.7749,
        lng: -122.4194,
        url: "https://elcomal.example",
        mapsUrl: "https://maps.google.com/?cid=1",
        googlePlaceId: "place-1",
        closedDays: [0, 1],
      },
    });
  });

  it("requests regularOpeningHours in the details field mask", async () => {
    const fetchSpy = vi.fn(async () => jsonResponse({ id: "place-1" }));
    stubFetch(fetchSpy as unknown as typeof fetch);

    await createPlacesClient("key").getPlaceDetails("place-1");

    const init = (fetchSpy.mock.calls[0] as unknown[])[1] as RequestInit;
    expect(
      (init.headers as Record<string, string>)["X-Goog-FieldMask"],
    ).toContain("regularOpeningHours");
  });

  /** Fetch details for a body carrying only the given `regularOpeningHours`. */
  async function closedDaysFor(regularOpeningHours: unknown) {
    stubFetch(
      vi.fn(async () =>
        jsonResponse({ id: "place-1", regularOpeningHours }),
      ) as unknown as typeof fetch,
    );
    const result = await createPlacesClient("key").getPlaceDetails("place-1");
    if (!result.ok) throw new Error("expected details");
    return result.value.closedDays;
  }

  it("counts an after-midnight close only for the day the period opens", async () => {
    // Opens Fri and Sat evenings, each closing early the next morning — so
    // Saturday and Sunday mornings are not "open days" in their own right.
    expect(
      await closedDaysFor({
        periods: [
          { open: { day: 5, hour: 18, minute: 0 }, close: { day: 6, hour: 2, minute: 0 } },
          { open: { day: 6, hour: 18, minute: 0 }, close: { day: 0, hour: 2, minute: 0 } },
        ],
      }),
    ).toEqual([0, 1, 2, 3, 4]);
  });

  it("reads an always-open place (a period with no close) as never closed", async () => {
    expect(
      await closedDaysFor({ periods: [{ open: { day: 0, hour: 0, minute: 0 } }] }),
    ).toEqual([]);
  });

  it("returns null closed days when Google has no hours on file", async () => {
    expect(await closedDaysFor(undefined)).toBeNull();
    expect(await closedDaysFor({ periods: [] })).toBeNull();
  });

  it("leaves a missing field empty rather than failing", async () => {
    stubFetch(
      vi.fn(async () =>
        jsonResponse({ id: "place-1", displayName: { text: "El Comal" } }),
      ) as unknown as typeof fetch,
    );

    const result = await createPlacesClient("key").getPlaceDetails("place-1");

    expect(result).toEqual({
      ok: true,
      value: {
        name: "El Comal",
        address: "",
        phone: "",
        lat: null,
        lng: null,
        url: "",
        mapsUrl: "",
        googlePlaceId: "place-1",
        closedDays: null,
      },
    });
  });

  it("treats an unparseable body as unavailable", async () => {
    stubFetch(
      vi.fn(async () => new Response("<<not json>>", { status: 200 })) as
        unknown as typeof fetch,
    );

    expect(
      await createPlacesClient("key").getPlaceDetails("place-1"),
    ).toEqual({ ok: false });
  });
});
