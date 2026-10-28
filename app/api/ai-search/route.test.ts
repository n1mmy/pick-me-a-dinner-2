import { beforeEach, describe, expect, it, vi } from "vitest";

// The mock factories below are hoisted above these declarations, so the spies
// they close over must be created with `vi.hoisted` to exist in time.
const { snapshotForDay, search } = vi.hoisted(() => ({
  snapshotForDay: vi.fn(),
  search: vi.fn(),
}));

// What goes into the snapshot is `lib/snapshot`'s to test
// (`lib/snapshot.db.test.ts`); here it only has to reach the client intact.
vi.mock("../../../lib/snapshot", () => ({ snapshotForDay }));

// The Anthropic client is replaced so no live call is made.
vi.mock("../../../lib/ai-search", () => ({
  AI_SEARCH_UNAVAILABLE: { ok: false },
  createAiSearchClient: () => ({ search }),
}));

import { POST } from "./route";
import { todaySqlDate } from "../../../lib/local-day";

/** A built snapshot as `snapshotForDay` hands it over — opaque to the route. */
const BUILT = {
  snapshot: { today: "2026-05-22 (Friday)" },
  idByIndex: new Map([[1, "o1"]]),
  nameById: new Map([["o1", "Apple Crumble"]]),
};

function post(body: Record<string, unknown>): Promise<Response> {
  return POST(
    new Request("http://localhost/api/ai-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  snapshotForDay.mockReset();
  search.mockReset();
  snapshotForDay.mockResolvedValue(BUILT);
  search.mockResolvedValue({ ok: true, results: [] });
  delete process.env.ANTHROPIC_API_KEY;
});

describe("POST /api/ai-search", () => {
  it("returns the typed unavailable when ANTHROPIC_API_KEY is unset", async () => {
    const response = await post({ query: "something light" });

    expect(await response.json()).toEqual({ ok: false });
    // Unconfigured — no DB read and no model call.
    expect(snapshotForDay).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });

  it("searches the Selected day's snapshot and forwards the result", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    search.mockResolvedValue({
      ok: true,
      results: [{ id: "o1", reason: "fits" }],
    });

    const response = await post({
      query: "something sweet",
      selectedDay: "2026-05-22",
    });

    expect(await response.json()).toEqual({
      ok: true,
      results: [{ id: "o1", reason: "fits" }],
    });
    expect(snapshotForDay).toHaveBeenCalledWith({
      asOf: "2026-05-22",
      query: "something sweet",
    });
    expect(search).toHaveBeenCalledWith(BUILT);
  });

  it("passes an empty query straight through — an empty search is valid", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";

    await post({ query: "", selectedDay: "2026-05-22" });

    expect(snapshotForDay).toHaveBeenCalledWith({ asOf: "2026-05-22", query: "" });
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("defaults a malformed or missing selectedDay to today rather than throwing", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";

    const response = await post({ query: "", selectedDay: 12345 });

    expect(response.status).toBe(200);
    expect(snapshotForDay).toHaveBeenCalledWith({
      asOf: todaySqlDate(new Date(), process.env.APP_TZ ?? "UTC"),
      query: "",
    });
  });
});
