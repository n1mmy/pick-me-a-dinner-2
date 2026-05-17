import { beforeEach, describe, expect, it, vi } from "vitest";

// The mock factories below are hoisted above these declarations, so the spies
// they close over must be created with `vi.hoisted` to exist in time.
const { getTonightData, getRejections, search } = vi.hoisted(() => ({
  getTonightData: vi.fn(),
  getRejections: vi.fn(),
  search: vi.fn(),
}));

// `getTonightData` and `getRejections` are the DB reads `aiSearchAction` makes
// — stub them so the test never touches a database, and so the snapshot wiring
// can be asserted.
vi.mock("../db/queries", () => ({ getTonightData, getRejections }));

// `authedAction` wraps the action with the shared-password session check;
// that check has its own coverage, so here it is a pass-through and the test
// exercises the action body directly.
vi.mock("../lib/authed-action", () => ({
  authedAction: (fn: unknown) => fn,
}));

// The Anthropic client is replaced so no live call is made; `search` is the
// spy the action's forwarded result is asserted against. `buildSnapshot` and
// `AI_SEARCH_UNAVAILABLE` stay real, so the snapshot is genuinely built.
vi.mock("../lib/ai-search", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/ai-search")>()),
  createAiSearchClient: () => ({ search }),
}));

import { aiSearchAction } from "./tonight-actions";
import { AI_SEARCH_UNAVAILABLE } from "../lib/ai-search";
import { todaySqlDate } from "../lib/local-day";

const TONIGHT_DATA = {
  options: [
    {
      id: "o1",
      name: "Apple Crumble",
      kind: "home" as const,
      tags: ["sweet"],
      notes: null,
      url: null,
      phone: null,
    },
  ],
  logEntries: [{ optionId: "o1", eatenOn: "2026-05-10", note: null }],
  todayEntries: [],
};

beforeEach(() => {
  getTonightData.mockReset();
  getRejections.mockReset();
  search.mockReset();
  getTonightData.mockResolvedValue(TONIGHT_DATA);
  getRejections.mockResolvedValue([]);
  delete process.env.ANTHROPIC_API_KEY;
});

describe("aiSearchAction", () => {
  it("returns the typed unavailable when ANTHROPIC_API_KEY is unset", async () => {
    const result = await aiSearchAction("something light");
    expect(result).toEqual(AI_SEARCH_UNAVAILABLE);
    // Unconfigured — no DB read and no model call.
    expect(getTonightData).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });

  it("builds the snapshot and forwards the search result when configured", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    search.mockResolvedValue({
      ok: true,
      results: [{ id: "o1", reason: "fits" }],
    });

    const result = await aiSearchAction("something sweet");

    expect(result).toEqual({
      ok: true,
      results: [{ id: "o1", reason: "fits" }],
    });
    expect(search).toHaveBeenCalledTimes(1);
    const [snapshot, activeIds] = search.mock.calls[0];
    // The query is wrapped in the prompt-injection delimiter...
    expect(snapshot.query).toBe(
      "<household-text>something sweet</household-text>",
    );
    // ...and only the real active Option ids form the validation set.
    expect([...activeIds]).toEqual(["o1"]);
  });

  it("drops a today-rejected Option from the candidate set and activeIds", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const today = todaySqlDate(new Date(), process.env.APP_TZ ?? "UTC");
    getRejections.mockResolvedValue([
      {
        optionId: "o1",
        reason: "too heavy tonight",
        rejectedOn: today,
        optionName: "Apple Crumble",
        kind: "home",
        tags: ["sweet"],
      },
    ]);
    search.mockResolvedValue({ ok: true, results: [] });

    await aiSearchAction("something sweet");

    const [snapshot, activeIds] = search.mock.calls[0];
    // o1 was rejected today — gone from the candidate options and the
    // validation set, so an AI search cannot resurface it for the rest of the
    // day. Its Rejection still rides along in the snapshot's Rejections block.
    expect(snapshot.options).toEqual([]);
    expect([...activeIds]).toEqual([]);
    expect(snapshot.rejections.rejectedTonight.map((r) => r.optionId)).toEqual([
      "o1",
    ]);
  });

  it("passes an empty query straight through — an empty search is valid", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    search.mockResolvedValue({ ok: true, results: [] });

    await aiSearchAction("");

    const [snapshot] = search.mock.calls[0];
    expect(snapshot.query).toBe("<household-text></household-text>");
  });
});
