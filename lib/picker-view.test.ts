import { describe, expect, it } from "vitest";
import type { TonightRow } from "./ranking";
import {
  chipStateLabel,
  cycleChipState,
  pickerView,
  showAddRow,
  type TonightChoice,
} from "./picker-view";

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
  it("mirrors every row in `rows`, name-sorted, regardless of the active filter, each unsuppressed", () => {
    // Restaurant-only filter still yields typeahead choices for every Option
    // in `rows`, including the Home rows it hides — the kind/Tag filter
    // narrows the ranked list, never what the typeahead can find.
    const { choices } = pickerView(ROWS, "restaurant", {});
    expect(choices).toEqual([
      { id: "fish-home", name: "fish-home", kind: "home", suppression: "none" },
      { id: "pasta-home", name: "pasta-home", kind: "home", suppression: "none" },
      { id: "pasta-rest", name: "pasta-rest", kind: "restaurant", suppression: "none" },
      { id: "plain-rest", name: "plain-rest", kind: "restaurant", suppression: "none" },
    ]);
  });

  it("widens past `rows` to the Closed, Rejected, and Picked candidates, each carrying its suppression", () => {
    const { choices } = pickerView([row("open-home", "home")], "all", {}, {
      closed: [row("closed-rest", "restaurant")],
      rejected: [row("rejected-home", "home")],
      picked: [row("picked-rest", "restaurant")],
    });
    expect(choices).toEqual([
      { id: "closed-rest", name: "closed-rest", kind: "restaurant", suppression: "closed" },
      { id: "open-home", name: "open-home", kind: "home", suppression: "none" },
      { id: "picked-rest", name: "picked-rest", kind: "restaurant", suppression: "picked" },
      { id: "rejected-home", name: "rejected-home", kind: "home", suppression: "rejected" },
    ]);
  });

  it("defaults to no suppressed candidates when the caller omits them", () => {
    const { choices } = pickerView(ROWS, "all", {});
    expect(choices.every((c) => c.suppression === "none")).toBe(true);
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

describe("showAddRow (issue 03)", () => {
  const CHOICES: TonightChoice[] = [
    { id: "o1", name: "Thai Orchid", kind: "restaurant", suppression: "none" },
    { id: "o2", name: "Aji Ichi", kind: "restaurant", suppression: "closed" },
    { id: "o3", name: "Curry House", kind: "restaurant", suppression: "rejected" },
    { id: "o4", name: "Zed Diner", kind: "restaurant", suppression: "picked" },
  ];

  it("is false for an empty or whitespace-only query", () => {
    expect(showAddRow(CHOICES, "")).toBe(false);
    expect(showAddRow(CHOICES, "   ")).toBe(false);
  });

  it("is true when no candidate's name matches at all", () => {
    expect(showAddRow(CHOICES, "Pizza Place")).toBe(true);
  });

  it("is true for a substring match that is not an exact name", () => {
    // "Thai" matches "Thai Orchid" by substring, but not exactly — the Add
    // row still offers to create "Thai" as its own new Option.
    expect(showAddRow(CHOICES, "Thai")).toBe(true);
  });

  it("is false for an exact name match, any case, any suppression", () => {
    expect(showAddRow(CHOICES, "Thai Orchid")).toBe(false);
    expect(showAddRow(CHOICES, "thai orchid")).toBe(false);
    expect(showAddRow(CHOICES, "AJI ICHI")).toBe(false);
    expect(showAddRow(CHOICES, "curry house")).toBe(false);
    expect(showAddRow(CHOICES, "Zed Diner")).toBe(false);
  });

  it("ignores surrounding whitespace on the query", () => {
    expect(showAddRow(CHOICES, "  Thai Orchid  ")).toBe(false);
  });
});
