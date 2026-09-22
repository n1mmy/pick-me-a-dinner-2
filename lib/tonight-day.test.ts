import { describe, expect, it } from "vitest";
import { CAP } from "./ranking.config";
import {
  tonightForDay,
  type TonightDayLogEntry,
  type TonightDayOption,
} from "./tonight-day";
import type { TodayLogEntry } from "./tonights-dinner";

/** A minimal active Catalog Option. */
function option(
  id: string,
  name: string,
  overrides: Partial<Pick<TonightDayOption, "closedDays" | "tags">> = {},
): TonightDayOption {
  return {
    id,
    name,
    kind: "restaurant",
    tags: overrides.tags ?? [],
    url: null,
    phone: null,
    closedDays: overrides.closedDays ?? [],
  };
}

/** A Log entry dated by SQL date, as `tonightForDay` takes it. */
function logEntry(
  optionId: string,
  eatenOn: string,
  note: string | null = null,
  createdAt = "2026-05-17T12:00:00Z",
): TonightDayLogEntry {
  return { optionId, eatenOn, createdAt: new Date(createdAt), note };
}

/** A Selected-day `dinner_log` row — what puts an Option into the decided block. */
function dayEntry(
  id: string,
  optionId: string,
  createdAt = "2026-05-17T12:00:00Z",
  note: string | null = null,
): TodayLogEntry {
  return { id, optionId, createdAt: new Date(createdAt), note };
}

// 2026-05-17 is a Sunday.
const SUNDAY = "2026-05-17";

describe("tonightForDay", () => {
  it("lists closed rows alphabetically, not in rank order", () => {
    const closedSundays = { closedDays: [0] };
    const result = tonightForDay({
      options: [
        option("c", "Charlie", closedSundays),
        option("a", "Alpha", closedSundays),
        option("b", "Beta", closedSundays),
      ],
      // Charlie longest ago, Alpha most recently: rank order is Charlie, Beta,
      // Alpha — the reverse of alphabetical.
      logEntries: [
        logEntry("c", "2026-04-01"),
        logEntry("b", "2026-05-01"),
        logEntry("a", "2026-05-16"),
      ],
      dayEntries: [],
      rejectedOptionIds: [],
      selectedDay: SUNDAY,
    });
    expect(result.picker).toEqual([]);
    expect(result.closed.map((r) => r.option.name)).toEqual([
      "Alpha",
      "Beta",
      "Charlie",
    ]);
  });

  it("puts a Restaurant both closed and rejected for the Selected day in neither the picker nor closed", () => {
    const options = [
      option("a", "Alpha", { closedDays: [0] }), // closed Sundays
      option("b", "Beta"),
    ];
    const result = tonightForDay({
      options,
      logEntries: [],
      dayEntries: [],
      rejectedOptionIds: ["a"],
      selectedDay: SUNDAY,
    });
    expect(result.picker.map((r) => r.option.id)).not.toContain("a");
    expect(result.closed.map((r) => r.option.id)).not.toContain("a");
    // Beta is neither closed nor rejected, so it stays on the picker.
    expect(result.picker.map((r) => r.option.id)).toEqual(["b"]);
    expect(result.closed).toEqual([]);
  });

  it("gives the decided block's row pre-Pick recency, not the Selected day's own entry", () => {
    const options = [option("a", "Alpha")];
    const result = tonightForDay({
      options,
      // The only Log entry for "a" is dated the Selected day itself — the Pick
      // that puts it in the decided block.
      logEntries: [logEntry("a", SUNDAY)],
      dayEntries: [dayEntry("e1", "a")],
      rejectedOptionIds: [],
      selectedDay: SUNDAY,
    });
    expect(result.tonightsDinner).toHaveLength(1);
    // Excluding the Selected day's own entry, "a" has no prior Log entry, so
    // its decided row reads "never eaten" (CAP), not the misleadingly fresh
    // 0d a same-day ranking would give it.
    expect(result.tonightsDinner[0].row.recencyDays).toBe(CAP);
    expect(result.tonightsDinner[0].row.neverEaten).toBe(true);
  });

  it("gives the picker's rows the day's own ranking, not the pre-Pick one", () => {
    // "a" and "b" share a Tag; "a" is Picked today, which should freshen the
    // shared Tag's recency for "b" too — but only if the picker is ranked over
    // the day's entries (inclusive of today), not the decided (pre-Pick) ones.
    const options = [
      option("a", "Alpha", { tags: ["spicy"] }),
      option("b", "Beta", { tags: ["spicy"] }),
    ];
    const result = tonightForDay({
      options,
      logEntries: [logEntry("a", SUNDAY)],
      dayEntries: [dayEntry("e1", "a")],
      rejectedOptionIds: [],
      selectedDay: SUNDAY,
    });
    const betaRow = result.picker.find((r) => r.option.id === "b");
    expect(betaRow).toBeDefined();
    const spicyTag = betaRow!.tags.find((t) => t.tag === "spicy");
    expect(spicyTag?.days).toBe(0);
  });

  it("keeps an Option Picked for the day off the picker", () => {
    const options = [option("a", "Alpha"), option("b", "Beta")];
    const result = tonightForDay({
      options,
      logEntries: [logEntry("a", SUNDAY)],
      dayEntries: [dayEntry("e1", "a")],
      rejectedOptionIds: [],
      selectedDay: SUNDAY,
    });
    expect(result.picker.map((r) => r.option.id)).toEqual(["b"]);
    expect(result.tonightsDinner.map((d) => d.row.option.id)).toEqual(["a"]);
  });

  it("marks allFiltered true when Rejections empty a non-empty picker", () => {
    const options = [option("a", "Alpha")];
    const result = tonightForDay({
      options,
      logEntries: [],
      dayEntries: [],
      rejectedOptionIds: ["a"],
      selectedDay: SUNDAY,
    });
    expect(result.picker).toEqual([]);
    expect(result.allFiltered).toBe(true);
  });

  it("marks allFiltered true when Closed days empty a non-empty picker", () => {
    const options = [option("a", "Alpha", { closedDays: [0] })];
    const result = tonightForDay({
      options,
      logEntries: [],
      dayEntries: [],
      rejectedOptionIds: [],
      selectedDay: SUNDAY,
    });
    expect(result.picker).toEqual([]);
    expect(result.allFiltered).toBe(true);
  });

  it("marks allFiltered false for a genuinely empty Catalog", () => {
    const result = tonightForDay({
      options: [],
      logEntries: [],
      dayEntries: [],
      rejectedOptionIds: [],
      selectedDay: SUNDAY,
    });
    expect(result.picker).toEqual([]);
    expect(result.allFiltered).toBe(false);
  });

  it("marks allFiltered false when the picker still has rows left", () => {
    const options = [option("a", "Alpha"), option("b", "Beta")];
    const result = tonightForDay({
      options,
      logEntries: [],
      dayEntries: [],
      rejectedOptionIds: ["a"],
      selectedDay: SUNDAY,
    });
    expect(result.picker.map((r) => r.option.id)).toEqual(["b"]);
    expect(result.allFiltered).toBe(false);
  });
});
