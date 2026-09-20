import { describe, expect, it } from "vitest";
import type { TonightRow } from "./ranking";
import { chipStateLabel, cycleChipState, pickerView } from "./picker-view";

/** Build a Tonight row; only `kind` and `tags` drive the filter under test. */
function row(
  id: string,
  kind: "home" | "restaurant",
  tags: string[] = [],
): TonightRow {
  return {
    option: { id, name: id, kind, tags, url: null, phone: null },
    score: 0,
    affinity: 0,
    readiness: 0,
    tags: tags.map((tag) => ({ tag, days: 0, overdue: false })),
    recencyDays: 0,
    neverEaten: false,
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

describe("pickerView — visible (kind segment)", () => {
  it("All shows every row", () => {
    expect(ids(pickerView(ROWS, "all", {}).visible)).toEqual([
      "pasta-home",
      "fish-home",
      "pasta-rest",
      "plain-rest",
    ]);
  });

  it("Home keeps only Home meals", () => {
    expect(ids(pickerView(ROWS, "home", {}).visible)).toEqual([
      "pasta-home",
      "fish-home",
    ]);
  });

  it("Restaurant keeps only Restaurants", () => {
    expect(ids(pickerView(ROWS, "restaurant", {}).visible)).toEqual([
      "pasta-rest",
      "plain-rest",
    ]);
  });
});

describe("pickerView — visible (tag chips)", () => {
  it("an include chip shows only Options carrying that Tag", () => {
    expect(
      ids(pickerView(ROWS, "all", { pasta: "include" }).visible),
    ).toEqual(["pasta-home", "pasta-rest"]);
  });

  it("an exclude chip hides Options carrying that Tag", () => {
    expect(
      ids(pickerView(ROWS, "all", { pasta: "exclude" }).visible),
    ).toEqual(["fish-home", "plain-rest"]);
  });

  it("a chip left off does not filter", () => {
    expect(ids(pickerView(ROWS, "all", { pasta: "off" }).visible)).toEqual(
      ids(ROWS),
    );
  });
});

describe("pickerView — visible (filters AND together)", () => {
  it("the kind segment and an include Tag AND together", () => {
    // Home AND pasta — pasta-rest is excluded by kind, fish-home by tag.
    expect(
      ids(pickerView(ROWS, "home", { pasta: "include" }).visible),
    ).toEqual(["pasta-home"]);
  });

  it("multiple include Tags AND together (a row needs every one)", () => {
    expect(
      ids(
        pickerView(ROWS, "all", { pasta: "include", quick: "include" })
          .visible,
      ),
    ).toEqual(["pasta-home"]);
  });

  it("an include and an exclude Tag AND together", () => {
    // pasta included, quick excluded — pasta-home carries quick, so it drops.
    expect(
      ids(
        pickerView(ROWS, "all", { pasta: "include", quick: "exclude" })
          .visible,
      ),
    ).toEqual(["pasta-rest"]);
  });

  it("the kind segment and an exclude Tag AND together", () => {
    expect(
      ids(pickerView(ROWS, "restaurant", { pasta: "exclude" }).visible),
    ).toEqual(["plain-rest"]);
  });
});

describe("pickerView — rankOf", () => {
  it("reports each Option's position in the unfiltered ranking", () => {
    const { rankOf } = pickerView(ROWS, "all", {});
    expect(rankOf.get("pasta-home")).toBe(1);
    expect(rankOf.get("fish-home")).toBe(2);
    expect(rankOf.get("pasta-rest")).toBe(3);
    expect(rankOf.get("plain-rest")).toBe(4);
  });

  it("does not renumber when a filter drops rows — a filtered row keeps its true rank", () => {
    // Restaurant-only filter drops the two Home rows; the surviving rows keep
    // ranks 3 and 4, not renumbered to 1 and 2.
    const { rankOf } = pickerView(ROWS, "restaurant", {});
    expect(rankOf.get("pasta-rest")).toBe(3);
    expect(rankOf.get("plain-rest")).toBe(4);
  });
});

describe("pickerView — choices", () => {
  it("mirrors every row in `rows`, name-sorted, regardless of the active filter", () => {
    // Restaurant-only filter still yields typeahead choices for every Option
    // in `rows`, including the suppressed Home rows — so a typeahead pick can
    // never hit an already-Picked or Selected-day-rejected Option that the
    // filter (not the ranking) has hidden.
    const { choices } = pickerView(ROWS, "restaurant", {});
    expect(choices).toEqual([
      { id: "fish-home", name: "fish-home", kind: "home" },
      { id: "pasta-home", name: "pasta-home", kind: "home" },
      { id: "pasta-rest", name: "pasta-rest", kind: "restaurant" },
      { id: "plain-rest", name: "plain-rest", kind: "restaurant" },
    ]);
  });
});

describe("pickerView — tags", () => {
  it("collects every Tag across the rows, sorted", () => {
    expect(pickerView(ROWS, "all", {}).tags).toEqual([
      "fish",
      "pasta",
      "quick",
    ]);
  });

  it("is empty when no row carries a Tag", () => {
    expect(pickerView([row("plain", "home")], "all", {}).tags).toEqual([]);
  });
});

describe("pickerView — hint", () => {
  it("states no active filter", () => {
    expect(pickerView(ROWS, "all", {}).hint).toBe("Showing all Options");
  });

  it("states the kind segment", () => {
    expect(pickerView(ROWS, "home", {}).hint).toBe("Showing Home meals");
    expect(pickerView(ROWS, "restaurant", {}).hint).toBe(
      "Showing Restaurants",
    );
  });

  it("states include and exclude Tags in words", () => {
    expect(
      pickerView(ROWS, "home", {
        pasta: "include",
        fish: "exclude",
        quick: "off",
      }).hint,
    ).toBe("Showing Home meals with pasta, without fish");
  });
});
