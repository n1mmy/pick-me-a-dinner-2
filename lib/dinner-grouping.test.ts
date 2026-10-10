import { describe, expect, it } from "vitest";
import { formatDinnerDate, groupByDay } from "./dinner-grouping";

/** A minimal Log-entry-shaped fixture — the module only ever reads `eatenOn`. */
function entry(id: string, eatenOn: string) {
  return { id, eatenOn };
}

/** A minimal Rejection-shaped fixture — the module only reads `rejectedOn`. */
function rejection(id: string, rejectedOn: string) {
  return { id, rejectedOn };
}

describe("formatDinnerDate", () => {
  const today = "2026-05-17";

  it("labels today, tomorrow, and yesterday by name", () => {
    expect(formatDinnerDate("2026-05-17", today)).toBe("Today");
    expect(formatDinnerDate("2026-05-18", today)).toBe("Tomorrow");
    expect(formatDinnerDate("2026-05-16", today)).toBe("Yesterday");
  });

  it("suffixes a past date with 'N days ago', leaves a future date plain", () => {
    expect(formatDinnerDate("2026-05-15", today)).toBe("Fri, May 15 · 2 days ago");
    expect(formatDinnerDate("2026-05-22", today)).toBe("Fri, May 22");
  });

  it("crosses a month boundary correctly", () => {
    expect(formatDinnerDate("2026-04-30", today)).toBe("Thu, Apr 30 · 17 days ago");
  });
});

describe("groupByDay — interleaved Log entries and Rejections", () => {
  const today = "2026-05-17";

  it("groups a Log entry and a Rejection sharing a date into one record", () => {
    const { history } = groupByDay(
      [entry("e1", "2026-05-16")],
      [rejection("r1", "2026-05-16")],
      today,
    );
    expect(history).toHaveLength(1);
    expect(history[0].date).toBe("2026-05-16");
    expect(history[0].entries.map((e) => e.id)).toEqual(["e1"]);
    expect(history[0].rejections.map((r) => r.id)).toEqual(["r1"]);
  });

  it("forms a record for a date with only Rejections and no Dinner", () => {
    const { history } = groupByDay([], [rejection("r1", "2026-05-15")], today);
    expect(history).toHaveLength(1);
    expect(history[0].date).toBe("2026-05-15");
    expect(history[0].entries).toEqual([]);
    expect(history[0].rejections.map((r) => r.id)).toEqual(["r1"]);
  });

  it("splits exactly at the today boundary", () => {
    // A record dated today is History; only a record dated *after* today is
    // Upcoming. Holds for both Log entries and Rejections.
    const { upcoming, history } = groupByDay(
      [entry("e-future", "2026-05-18"), entry("e-today", "2026-05-17")],
      [rejection("r-future", "2026-05-19"), rejection("r-past", "2026-05-16")],
      today,
    );
    expect(upcoming.map((d) => d.date)).toEqual(["2026-05-18", "2026-05-19"]);
    expect(history.map((d) => d.date)).toEqual(["2026-05-17", "2026-05-16"]);
  });

  it("returns Upcoming soonest-first and History newest-first", () => {
    const { upcoming, history } = groupByDay(
      [
        entry("e1", "2026-05-22"),
        entry("e2", "2026-05-19"),
        entry("e3", "2026-05-16"),
        entry("e4", "2026-05-13"),
      ],
      [rejection("r1", "2026-05-20"), rejection("r2", "2026-05-14")],
      today,
    );
    expect(upcoming.map((d) => d.date)).toEqual([
      "2026-05-19",
      "2026-05-20",
      "2026-05-22",
    ]);
    expect(history.map((d) => d.date)).toEqual([
      "2026-05-16",
      "2026-05-14",
      "2026-05-13",
    ]);
  });

  it("preserves input order of entries and Rejections within a record", () => {
    const { history } = groupByDay(
      [entry("e1", "2026-05-16"), entry("e2", "2026-05-16")],
      [rejection("r1", "2026-05-16"), rejection("r2", "2026-05-16")],
      today,
    );
    expect(history[0].entries.map((e) => e.id)).toEqual(["e1", "e2"]);
    expect(history[0].rejections.map((r) => r.id)).toEqual(["r1", "r2"]);
  });

  it("returns empty Upcoming and History for an empty Log and no Rejections", () => {
    expect(groupByDay([], [], today)).toEqual({ upcoming: [], history: [] });
  });
});

/** A Day-note-shaped fixture — `{ notedOn, note }`, as the Log query returns. */
function dayNote(notedOn: string, note: string) {
  return { notedOn, note };
}

describe("groupByDay — Day notes", () => {
  const today = "2026-05-17";

  it("forms a record for a date with only a Day note", () => {
    const { history } = groupByDay([], [], today, [
      dayNote("2026-05-15", "Guests over"),
    ]);
    expect(history).toHaveLength(1);
    expect(history[0].date).toBe("2026-05-15");
    expect(history[0].entries).toEqual([]);
    expect(history[0].rejections).toEqual([]);
    expect(history[0].dayNote).toBe("Guests over");
  });

  it("attaches a Day note to a date that has Log entries and Rejections", () => {
    const { history } = groupByDay(
      [entry("e1", "2026-05-16")],
      [rejection("r1", "2026-05-16")],
      today,
      [dayNote("2026-05-16", "Jen won't be around")],
    );
    expect(history).toHaveLength(1);
    expect(history[0].entries.map((e) => e.id)).toEqual(["e1"]);
    expect(history[0].rejections.map((r) => r.id)).toEqual(["r1"]);
    expect(history[0].dayNote).toBe("Jen won't be around");
  });

  it("places past and today's Day notes in History and future ones in Upcoming", () => {
    const { upcoming, history } = groupByDay([], [], today, [
      dayNote("2026-05-22", "Guests over"),
      dayNote("2026-05-17", "Late back"),
      dayNote("2026-05-10", "Pizza night"),
    ]);
    expect(upcoming.map((r) => [r.date, r.dayNote])).toEqual([
      ["2026-05-22", "Guests over"],
    ]);
    expect(history.map((r) => [r.date, r.dayNote])).toEqual([
      ["2026-05-17", "Late back"],
      ["2026-05-10", "Pizza night"],
    ]);
  });

  it("leaves dayNote unset on a date without one", () => {
    const { history } = groupByDay([entry("e1", "2026-05-16")], [], today, [
      dayNote("2026-05-15", "Guests over"),
    ]);
    expect(history.find((r) => r.date === "2026-05-16")?.dayNote).toBeUndefined();
  });
});

