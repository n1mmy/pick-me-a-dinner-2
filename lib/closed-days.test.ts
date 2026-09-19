import { describe, expect, it } from "vitest";
import { isClosedOn, partitionClosedRows } from "./closed-days";
import type { TonightRow } from "./ranking";

/** Build a Tonight row; only `option.id` and `option.name` drive the split. */
function row(id: string, name: string): TonightRow {
  return {
    option: { id, name, kind: "restaurant", tags: [], url: null, phone: null },
    score: 0,
    affinity: 0,
    readiness: 0,
    tags: [],
    recencyDays: 0,
    neverEaten: false,
  };
}

describe("isClosedOn", () => {
  it("never suppresses when closedDays is empty", () => {
    // 2026-05-17 is a Sunday.
    expect(isClosedOn([], "2026-05-17")).toBe(false);
  });

  it("suppresses on a matching weekday", () => {
    // 2026-05-17 is a Sunday (weekday 0).
    expect(isClosedOn([0], "2026-05-17")).toBe(true);
  });

  it("does not suppress on a non-matching weekday", () => {
    // 2026-05-17 is a Sunday (weekday 0); the Restaurant is closed Mondays.
    expect(isClosedOn([1], "2026-05-17")).toBe(false);
  });

  it("suppresses every day when all seven weekdays are closed", () => {
    const allWeek = [0, 1, 2, 3, 4, 5, 6];
    // A run of seven consecutive dates starting on a Sunday.
    expect(isClosedOn(allWeek, "2026-05-17")).toBe(true); // Sunday
    expect(isClosedOn(allWeek, "2026-05-18")).toBe(true); // Monday
    expect(isClosedOn(allWeek, "2026-05-19")).toBe(true); // Tuesday
    expect(isClosedOn(allWeek, "2026-05-20")).toBe(true); // Wednesday
    expect(isClosedOn(allWeek, "2026-05-21")).toBe(true); // Thursday
    expect(isClosedOn(allWeek, "2026-05-22")).toBe(true); // Friday
    expect(isClosedOn(allWeek, "2026-05-23")).toBe(true); // Saturday
  });

  it("gives the identical result for a past, present, and future Selected day sharing a weekday", () => {
    // 2026-05-15, 2026-05-22, 2026-05-29 are all Fridays.
    const closedFridays = [5];
    expect(isClosedOn(closedFridays, "2026-05-15")).toBe(true);
    expect(isClosedOn(closedFridays, "2026-05-22")).toBe(true);
    expect(isClosedOn(closedFridays, "2026-05-29")).toBe(true);
  });
});

describe("partitionClosedRows", () => {
  // 2026-05-17 is a Sunday.
  const SUNDAY = "2026-05-17";

  it("keeps every row visible when nothing is closed", () => {
    const rows = [row("a", "Alpha"), row("b", "Beta")];
    const options = [
      { id: "a", closedDays: [] },
      { id: "b", closedDays: [] },
    ];
    const { visible, closed } = partitionClosedRows(rows, options, SUNDAY);
    expect(visible).toEqual(rows);
    expect(closed).toEqual([]);
  });

  it("moves a row closed on the Selected day's weekday out of visible", () => {
    const rows = [row("a", "Alpha"), row("b", "Beta")];
    const options = [
      { id: "a", closedDays: [0] }, // closed Sundays
      { id: "b", closedDays: [] },
    ];
    const { visible, closed } = partitionClosedRows(rows, options, SUNDAY);
    expect(visible.map((r) => r.option.id)).toEqual(["b"]);
    expect(closed.map((r) => r.option.id)).toEqual(["a"]);
  });

  it("treats a row missing from options as open, not closed", () => {
    // e.g. a stale row referencing an id `options` no longer carries.
    const rows = [row("ghost", "Ghost")];
    const { visible, closed } = partitionClosedRows(rows, [], SUNDAY);
    expect(visible.map((r) => r.option.id)).toEqual(["ghost"]);
    expect(closed).toEqual([]);
  });

  it("sorts closed rows alphabetically by name, ignoring rank order", () => {
    const rows = [row("c", "Charlie"), row("a", "Alpha"), row("b", "Beta")];
    const options = [
      { id: "a", closedDays: [0] },
      { id: "b", closedDays: [0] },
      { id: "c", closedDays: [0] },
    ];
    const { closed } = partitionClosedRows(rows, options, SUNDAY);
    expect(closed.map((r) => r.option.name)).toEqual([
      "Alpha",
      "Beta",
      "Charlie",
    ]);
  });

  it("keeps visible rows in the caller's order", () => {
    const rows = [row("c", "Charlie"), row("a", "Alpha"), row("b", "Beta")];
    const { visible } = partitionClosedRows(rows, [], SUNDAY);
    expect(visible.map((r) => r.option.id)).toEqual(["c", "a", "b"]);
  });
});
