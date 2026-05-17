import { describe, expect, it } from "vitest";
import { formatDinnerDate, groupByDate, splitDinners } from "./dinner-grouping";

/** A minimal Log-entry-shaped fixture — the module only ever reads `eatenOn`. */
function entry(id: string, eatenOn: string) {
  return { id, eatenOn };
}

describe("splitDinners — realized / Planned split", () => {
  it("splits exactly at the today boundary", () => {
    // An entry dated today is realized; only an entry dated *after* today is
    // a Planned dinner.
    const { planned, realized } = splitDinners(
      [
        entry("future", "2026-05-18"),
        entry("today", "2026-05-17"),
        entry("past", "2026-05-16"),
      ],
      "2026-05-17",
    );
    expect(planned.flatMap((d) => d.entries.map((e) => e.id))).toEqual([
      "future",
    ]);
    expect(realized.flatMap((d) => d.entries.map((e) => e.id))).toEqual([
      "today",
      "past",
    ]);
  });

  it("returns realized newest-first and Planned soonest-first", () => {
    const { planned, realized } = splitDinners(
      [
        entry("p2", "2026-05-20"),
        entry("p1", "2026-05-18"),
        entry("r1", "2026-05-16"),
        entry("r2", "2026-05-14"),
      ],
      "2026-05-17",
    );
    expect(planned.map((d) => d.date)).toEqual(["2026-05-18", "2026-05-20"]);
    expect(realized.map((d) => d.date)).toEqual(["2026-05-16", "2026-05-14"]);
  });

  it("leaves planned empty for an Option with no future entries", () => {
    const { planned, realized } = splitDinners(
      [entry("r1", "2026-05-17")],
      "2026-05-17",
    );
    expect(planned).toEqual([]);
    expect(realized).toHaveLength(1);
  });
});

describe("groupByDate", () => {
  it("collapses entries sharing a date into one Dinner, preserving order", () => {
    const dinners = groupByDate([
      entry("a", "2026-05-16"),
      entry("b", "2026-05-16"),
      entry("c", "2026-05-14"),
    ]);
    expect(dinners.map((d) => d.date)).toEqual(["2026-05-16", "2026-05-14"]);
    expect(dinners[0].entries.map((e) => e.id)).toEqual(["a", "b"]);
    expect(dinners[1].entries.map((e) => e.id)).toEqual(["c"]);
  });

  it("treats a non-adjacent repeat of a date as a separate Dinner", () => {
    // groupByDate trusts the input is date-sorted — which is why the Log query
    // orders by `eaten_on` before the entries reach this module.
    const dinners = groupByDate([
      entry("a", "2026-05-16"),
      entry("b", "2026-05-14"),
      entry("c", "2026-05-16"),
    ]);
    expect(dinners.map((d) => d.date)).toEqual([
      "2026-05-16",
      "2026-05-14",
      "2026-05-16",
    ]);
  });

  it("returns no Dinners for an empty Log", () => {
    expect(groupByDate([])).toEqual([]);
  });
});

describe("formatDinnerDate", () => {
  const today = "2026-05-17";

  it("labels today, tomorrow, and yesterday by name", () => {
    expect(formatDinnerDate("2026-05-17", today)).toBe("Today");
    expect(formatDinnerDate("2026-05-18", today)).toBe("Tomorrow");
    expect(formatDinnerDate("2026-05-16", today)).toBe("Yesterday");
  });

  it("falls back to the weekday-month-day form for any other date", () => {
    expect(formatDinnerDate("2026-05-15", today)).toBe("Fri, May 15");
    expect(formatDinnerDate("2026-05-22", today)).toBe("Fri, May 22");
  });

  it("crosses a month boundary correctly", () => {
    expect(formatDinnerDate("2026-04-30", today)).toBe("Thu, Apr 30");
  });
});
