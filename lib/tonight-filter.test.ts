import { describe, expect, it } from "vitest";
import type { TonightRow } from "./ranking";
import {
  chipStateLabel,
  cycleChipState,
  distinctTags,
  filterHint,
  filterTonightRows,
} from "./tonight-filter";

/** Build a Tonight row; only `kind` and `tags` drive the filter under test. */
function row(
  id: string,
  kind: "home" | "restaurant",
  tags: string[] = [],
): TonightRow {
  return {
    option: { id, name: id, kind, tags },
    score: 0,
    explanation: "",
    tags: tags.map((tag) => ({ tag, days: 0, overdue: false })),
  };
}

const ROWS: TonightRow[] = [
  row("pasta-home", "home", ["pasta", "quick"]),
  row("fish-home", "home", ["fish"]),
  row("pasta-rest", "restaurant", ["pasta"]),
  row("plain-rest", "restaurant", []),
];

const ids = (rows: TonightRow[]) => rows.map((r) => r.option.id);

describe("cycleChipState", () => {
  it("cycles off → include → exclude → off", () => {
    expect(cycleChipState("off")).toBe("include");
    expect(cycleChipState("include")).toBe("exclude");
    expect(cycleChipState("exclude")).toBe("off");
  });
});

describe("chipStateLabel", () => {
  it("names each state for the chip's accessible name", () => {
    expect(chipStateLabel("off")).toBe("not filtered");
    expect(chipStateLabel("include")).toBe("included");
    expect(chipStateLabel("exclude")).toBe("excluded");
  });
});

describe("filterTonightRows — kind segment", () => {
  it("All shows every row", () => {
    expect(ids(filterTonightRows(ROWS, "all", {}))).toEqual([
      "pasta-home",
      "fish-home",
      "pasta-rest",
      "plain-rest",
    ]);
  });

  it("Home keeps only Home meals", () => {
    expect(ids(filterTonightRows(ROWS, "home", {}))).toEqual([
      "pasta-home",
      "fish-home",
    ]);
  });

  it("Restaurant keeps only Restaurants", () => {
    expect(ids(filterTonightRows(ROWS, "restaurant", {}))).toEqual([
      "pasta-rest",
      "plain-rest",
    ]);
  });
});

describe("filterTonightRows — tag chips", () => {
  it("an include chip shows only Options carrying that Tag", () => {
    expect(ids(filterTonightRows(ROWS, "all", { pasta: "include" }))).toEqual([
      "pasta-home",
      "pasta-rest",
    ]);
  });

  it("an exclude chip hides Options carrying that Tag", () => {
    expect(ids(filterTonightRows(ROWS, "all", { pasta: "exclude" }))).toEqual([
      "fish-home",
      "plain-rest",
    ]);
  });

  it("a chip left off does not filter", () => {
    expect(ids(filterTonightRows(ROWS, "all", { pasta: "off" }))).toEqual(
      ids(ROWS),
    );
  });
});

describe("filterTonightRows — filters AND together", () => {
  it("the kind segment and an include Tag AND together", () => {
    // Home AND pasta — pasta-rest is excluded by kind, fish-home by tag.
    expect(
      ids(filterTonightRows(ROWS, "home", { pasta: "include" })),
    ).toEqual(["pasta-home"]);
  });

  it("multiple include Tags AND together (a row needs every one)", () => {
    expect(
      ids(filterTonightRows(ROWS, "all", { pasta: "include", quick: "include" })),
    ).toEqual(["pasta-home"]);
  });

  it("an include and an exclude Tag AND together", () => {
    // pasta included, quick excluded — pasta-home carries quick, so it drops.
    expect(
      ids(filterTonightRows(ROWS, "all", { pasta: "include", quick: "exclude" })),
    ).toEqual(["pasta-rest"]);
  });

  it("the kind segment and an exclude Tag AND together", () => {
    expect(
      ids(filterTonightRows(ROWS, "restaurant", { pasta: "exclude" })),
    ).toEqual(["plain-rest"]);
  });
});

describe("distinctTags", () => {
  it("collects every Tag across the rows, sorted", () => {
    expect(distinctTags(ROWS)).toEqual(["fish", "pasta", "quick"]);
  });

  it("is empty when no row carries a Tag", () => {
    expect(distinctTags([row("plain", "home")])).toEqual([]);
  });
});

describe("filterHint", () => {
  it("states no active filter", () => {
    expect(filterHint("all", {})).toBe("Showing all Options");
  });

  it("states the kind segment", () => {
    expect(filterHint("home", {})).toBe("Showing Home meals");
    expect(filterHint("restaurant", {})).toBe("Showing Restaurants");
  });

  it("states include and exclude Tags in words", () => {
    expect(
      filterHint("home", { pasta: "include", fish: "exclude", quick: "off" }),
    ).toBe("Showing Home meals with pasta, without fish");
  });
});
