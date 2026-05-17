import { beforeEach, describe, expect, it, vi } from "vitest";

// The Anthropic SDK is mocked so no live call is ever made — the failure-model
// tests drive `messages.create` through canned rejections and responses, the
// way `places.test.ts` drives the Places client through a stubbed `fetch`.
const { messagesCreate } = vi.hoisted(() => ({ messagesCreate: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: messagesCreate };
  },
}));

import {
  AI_SEARCH_UNAVAILABLE,
  buildSnapshot,
  classifyError,
  createAiSearchClient,
  parseAndValidate,
  type AiRankingRow,
  type SnapshotLogEntry,
  type SnapshotOption,
} from "./ai-search";

const TODAY = 100;

/** An active Catalog Option as the snapshot builder consumes it. */
function option(
  id: string,
  name: string,
  tags: string[] = [],
  notes: string | null = null,
): SnapshotOption {
  return { id, name, kind: "home", tags, notes };
}

describe("buildSnapshot", () => {
  const options = [
    option("b1", "Banana Bread", ["sweet"], "freeze half"),
    option("a1", "Apple Crumble", ["sweet", "fruit"]),
  ];
  const logEntries: SnapshotLogEntry[] = [
    { optionId: "a1", eatenOn: 90, note: "with cream" },
    { optionId: "b1", eatenOn: 95, note: null },
  ];
  const snapshot = buildSnapshot({
    options,
    logEntries,
    today: TODAY,
    query: "something sweet",
  });

  it("sends Options in alphabetical order by name, not input order", () => {
    expect(snapshot.options.map((o) => o.id)).toEqual(["a1", "b1"]);
  });

  it("carries only ranking-relevant fields — the Places fields are absent", () => {
    expect(Object.keys(snapshot.options[0]).sort()).toEqual(
      ["daysSinceLastEaten", "id", "kind", "name", "notes", "tags"].sort(),
    );
  });

  it("includes Option notes and Log-entry notes", () => {
    const bananaBread = snapshot.options.find((o) => o.id === "b1");
    expect(bananaBread?.notes).toBe("<household-text>freeze half</household-text>");
    const creamEntry = snapshot.log.find((entry) => entry.optionId === "a1");
    expect(creamEntry?.note).toBe("<household-text>with cream</household-text>");
  });

  it("leaves a missing note as null rather than an empty delimiter", () => {
    expect(snapshot.options.find((o) => o.id === "a1")?.notes).toBeNull();
    expect(snapshot.log.find((e) => e.optionId === "b1")?.note).toBeNull();
  });

  it("wraps every piece of Household-authored text in delimiters", () => {
    expect(snapshot.query).toBe("<household-text>something sweet</household-text>");
    expect(snapshot.options[0].name).toBe(
      "<household-text>Apple Crumble</household-text>",
    );
    expect(snapshot.options[0].tags[0].name).toBe(
      "<household-text>sweet</household-text>",
    );
  });

  it("derives correct per-Option recency integers", () => {
    // a1 last eaten on day 90, b1 on day 95; today is 100.
    expect(snapshot.options.find((o) => o.id === "a1")?.daysSinceLastEaten).toBe(
      10,
    );
    expect(snapshot.options.find((o) => o.id === "b1")?.daysSinceLastEaten).toBe(
      5,
    );
  });

  it("derives correct per-Tag recency integers across every carrier", () => {
    const apple = snapshot.options.find((o) => o.id === "a1");
    // "sweet" is carried by both Options — most recent use is b1 on day 95.
    const sweet = apple?.tags.find(
      (t) => t.name === "<household-text>sweet</household-text>",
    );
    expect(sweet?.daysSinceTagLastEaten).toBe(5);
    // "fruit" is carried only by a1, last eaten on day 90.
    const fruit = apple?.tags.find(
      (t) => t.name === "<household-text>fruit</household-text>",
    );
    expect(fruit?.daysSinceTagLastEaten).toBe(10);
  });
});

describe("parseAndValidate", () => {
  const activeIds = new Set(["a1", "b1"]);

  it("drops an id that is not in the active Catalog (a hallucination)", () => {
    const result = parseAndValidate(
      {
        results: [
          { id: "a1", reason: "Sweet and overdue" },
          { id: "ghost", reason: "Not a real Option" },
          { id: "b1", reason: "Also sweet" },
        ],
      },
      activeIds,
    );
    expect(result).toEqual([
      { id: "a1", reason: "Sweet and overdue" },
      { id: "b1", reason: "Also sweet" },
    ]);
  });

  it("preserves the model's ordering — the array order is the ranking", () => {
    const result = parseAndValidate(
      { results: [{ id: "b1", reason: "first" }, { id: "a1", reason: "second" }] },
      activeIds,
    );
    expect(result.map((row) => row.id)).toEqual(["b1", "a1"]);
  });

  it("skips a malformed entry and a non-array input", () => {
    expect(
      parseAndValidate({ results: [{ id: "a1" }, { reason: "no id" }] }, activeIds),
    ).toEqual([]);
    expect(parseAndValidate(null, activeIds)).toEqual([]);
    expect(parseAndValidate({ results: "nope" }, activeIds)).toEqual([]);
  });

  it("dedupes a repeated id, keeping the first occurrence", () => {
    const result = parseAndValidate(
      {
        results: [
          { id: "a1", reason: "first take" },
          { id: "b1", reason: "other Option" },
          { id: "a1", reason: "second take — dropped" },
        ],
      },
      activeIds,
    );
    expect(result).toEqual([
      { id: "a1", reason: "first take" },
      { id: "b1", reason: "other Option" },
    ]);
  });

  it("truncates a rationale over ~80 characters", () => {
    const longReason = "x".repeat(200);
    const [row] = parseAndValidate(
      { results: [{ id: "a1", reason: longReason }] },
      activeIds,
    );
    expect(row.reason.length).toBeLessThan(longReason.length);
    expect(row.reason.length).toBeLessThanOrEqual(81);
    expect(row.reason.endsWith("…")).toBe(true);
  });

  it("leaves a short rationale unchanged", () => {
    const shortReason = "Light and quick — a soup, three weeks since fish";
    const [row] = parseAndValidate(
      { results: [{ id: "a1", reason: shortReason }] },
      activeIds,
    );
    expect(row.reason).toBe(shortReason);
  });
});

describe("classifyError", () => {
  it("treats a 429, any 5xx, and a statusless failure as transient", () => {
    expect(classifyError({ status: 429 })).toBe("transient");
    expect(classifyError({ status: 500 })).toBe("transient");
    expect(classifyError({ status: 503 })).toBe("transient");
    // No HTTP status: a network error, or our own abort/timeout.
    expect(classifyError(new Error("network down"))).toBe("transient");
    expect(
      classifyError(Object.assign(new Error("aborted"), { name: "AbortError" })),
    ).toBe("transient");
  });

  it("treats a non-429 4xx as fatal — a retry would not fix it", () => {
    expect(classifyError({ status: 400 })).toBe("fatal");
    expect(classifyError({ status: 401 })).toBe("fatal");
    expect(classifyError({ status: 404 })).toBe("fatal");
  });
});

describe("createAiSearchClient — failure model and fallback", () => {
  const snapshot = buildSnapshot({
    options: [],
    logEntries: [],
    today: TODAY,
    query: "",
  });
  const activeIds = new Set(["a1"]);

  /** A model response carrying a valid `rank_options` tool-use block. */
  function toolUseResponse(rows: AiRankingRow[]) {
    return {
      content: [
        { type: "tool_use", name: "rank_options", input: { results: rows } },
      ],
    };
  }

  beforeEach(() => {
    messagesCreate.mockReset();
  });

  it("returns the validated ordered result on a tool-use response", async () => {
    messagesCreate.mockResolvedValueOnce(
      toolUseResponse([{ id: "a1", reason: "fits" }]),
    );
    const result = await createAiSearchClient("k").search(snapshot, activeIds);
    expect(result).toEqual({ ok: true, results: [{ id: "a1", reason: "fits" }] });
    expect(messagesCreate).toHaveBeenCalledTimes(1);
  });

  it("retries a transient failure exactly once, then succeeds", async () => {
    messagesCreate
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValueOnce(toolUseResponse([{ id: "a1", reason: "fits" }]));
    const result = await createAiSearchClient("k").search(snapshot, activeIds);
    expect(result).toEqual({ ok: true, results: [{ id: "a1", reason: "fits" }] });
    expect(messagesCreate).toHaveBeenCalledTimes(2);
  });

  it("collapses each transient failure class to the fallback after one retry", async () => {
    // timeout/abort, HTTP 429, 5xx, and a network error — every transient class.
    const transientErrors = [
      Object.assign(new Error("aborted"), { name: "AbortError" }),
      { status: 429 },
      { status: 500 },
      new Error("network down"),
    ];
    for (const error of transientErrors) {
      messagesCreate.mockReset();
      messagesCreate.mockRejectedValue(error);
      const result = await createAiSearchClient("k").search(snapshot, activeIds);
      expect(result).toEqual(AI_SEARCH_UNAVAILABLE);
      // Exactly one retry — the call is made twice, never a third time.
      expect(messagesCreate).toHaveBeenCalledTimes(2);
    }
  });

  it("does not retry malformed tool-use output — a retry would not fix it", async () => {
    messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "no tool call here" }],
    });
    const result = await createAiSearchClient("k").search(snapshot, activeIds);
    expect(result).toEqual(AI_SEARCH_UNAVAILABLE);
    expect(messagesCreate).toHaveBeenCalledTimes(1);
  });

  it("does not retry a fatal HTTP status", async () => {
    messagesCreate.mockRejectedValue({ status: 400 });
    const result = await createAiSearchClient("k").search(snapshot, activeIds);
    expect(result).toEqual(AI_SEARCH_UNAVAILABLE);
    expect(messagesCreate).toHaveBeenCalledTimes(1);
  });
});
