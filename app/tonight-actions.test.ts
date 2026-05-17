import { beforeEach, describe, expect, it, vi } from "vitest";

// The mock factories below are hoisted above these declarations, so the spies
// they close over must be created with `vi.hoisted` to exist in time.
const { getTonightData, search } = vi.hoisted(() => ({
  getTonightData: vi.fn(),
  search: vi.fn(),
}));

// `getTonightData` is the only DB read `aiSearchAction` makes — stub it so the
// test never touches a database, and so the snapshot wiring can be asserted.
vi.mock("../db/queries", () => ({ getTonightData }));

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
  search.mockReset();
  getTonightData.mockResolvedValue(TONIGHT_DATA);
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

  it("passes an empty query straight through — an empty search is valid", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    search.mockResolvedValue({ ok: true, results: [] });

    await aiSearchAction("");

    const [snapshot] = search.mock.calls[0];
    expect(snapshot.query).toBe("<household-text></household-text>");
  });
});
