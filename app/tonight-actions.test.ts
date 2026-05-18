import { beforeEach, describe, expect, it, vi } from "vitest";

// The mock factories below are hoisted above these declarations, so the spies
// they close over must be created with `vi.hoisted` to exist in time.
const { getTonightData, getFullLogForSnapshot, getRejections, search } =
  vi.hoisted(() => ({
    getTonightData: vi.fn(),
    getFullLogForSnapshot: vi.fn(),
    getRejections: vi.fn(),
    search: vi.fn(),
  }));

// `getTonightData`, `getFullLogForSnapshot`, and `getRejections` are the DB
// reads `aiSearchAction` makes — stub them so the test never touches a
// database, and so the snapshot wiring can be asserted.
vi.mock("../db/queries", () => ({
  getTonightData,
  getFullLogForSnapshot,
  getRejections,
}));

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
  // `getTonightData`'s own non-future Log — `aiSearchAction` no longer reads
  // it; the AI snapshot's Log comes from `getFullLogForSnapshot` instead.
  logEntries: [{ optionId: "o1", eatenOn: "2026-05-10", note: null }],
  todayEntries: [],
};

/** The full Log `getFullLogForSnapshot` feeds the AI snapshot — any date. */
const FULL_LOG = [{ optionId: "o1", eatenOn: "2026-05-10", note: null }];

beforeEach(() => {
  getTonightData.mockReset();
  getFullLogForSnapshot.mockReset();
  getRejections.mockReset();
  search.mockReset();
  getTonightData.mockResolvedValue(TONIGHT_DATA);
  getFullLogForSnapshot.mockResolvedValue(FULL_LOG);
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
    const [snapshot, idByIndex] = search.mock.calls[0];
    // The query is wrapped in the prompt-injection delimiter...
    expect(snapshot.query).toBe(
      "<household-text>something sweet</household-text>",
    );
    // ...and `idByIndex` maps each candidate number back to the real id.
    expect([...idByIndex.values()]).toEqual(["o1"]);
  });

  it("drops a today-rejected Option from the candidate set and idByIndex", async () => {
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

    const [snapshot, idByIndex] = search.mock.calls[0];
    // o1 was rejected today — gone from the candidate options and absent from
    // `idByIndex`, so an AI search cannot resurface it for the rest of the day.
    // Its Rejection still rides along in the snapshot's Rejections block,
    // carrying o1's number (1).
    expect(snapshot.options).toEqual([]);
    expect([...idByIndex.values()]).toEqual([]);
    expect(
      snapshot.rejections.rejectedTonight.map(
        (r: { optionId: number }) => r.optionId,
      ),
    ).toEqual([1]);
  });

  it("passes an empty query straight through — an empty search is valid", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    search.mockResolvedValue({ ok: true, results: [] });

    await aiSearchAction("");

    const [snapshot] = search.mock.calls[0];
    expect(snapshot.query).toBe("<household-text></household-text>");
  });

  it("feeds the snapshot the full Log including a future-dated Planned dinner", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    // The full-Log feed carries a future-dated entry the deterministic Log
    // (`getTonightData`) would have filtered out — the AI snapshot sees it.
    getFullLogForSnapshot.mockResolvedValue([
      { optionId: "o1", eatenOn: "2026-05-10", note: null },
      { optionId: "o1", eatenOn: "2099-01-01", note: null },
    ]);
    search.mockResolvedValue({ ok: true, results: [] });

    await aiSearchAction("");

    const [snapshot] = search.mock.calls[0];
    expect(snapshot.log.map((e: { date: string }) => e.date)).toContain(
      "2099-01-01 (Thursday)",
    );
  });
});
