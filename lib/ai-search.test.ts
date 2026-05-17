import { describe, expect, it } from "vitest";
import {
  buildSnapshot,
  parseAndValidate,
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
});
