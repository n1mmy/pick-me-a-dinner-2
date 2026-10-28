import { describe, expect, it } from "vitest";
import { CAP } from "./ranking.config";
import {
  tonightForDay,
  type SuppressedRow,
  type TonightDayLogEntry,
  type TonightDayOption,
  type TonightDayRejection,
  type TonightForDayInput,
  type TonightView,
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

/** A Rejection dated the Selected day. */
function rejection(
  optionId: string,
  reason: string | null = null,
): TonightDayRejection {
  return { id: `r-${optionId}`, optionId, reason };
}

// 2026-05-17 is a Sunday.
const SUNDAY = "2026-05-17";

/** The view for `SUNDAY`, seen on `SUNDAY`, from whatever input a test sets. */
function view(input: Partial<TonightForDayInput> = {}): TonightView {
  return tonightForDay({
    options: [],
    logEntries: [],
    dayEntries: [],
    rejections: [],
    selectedDay: SUNDAY,
    today: SUNDAY,
    dayNote: null,
    ...input,
  });
}

/** The suppressed rows' Option ids carrying `suppression`, in view order. */
function suppressedIds(
  result: TonightView,
  suppression: SuppressedRow["suppression"],
): string[] {
  return result.suppressed
    .filter((entry) => entry.suppression === suppression)
    .map((entry) => entry.row.option.id);
}

describe("tonightForDay", () => {
  it("is decided when the day's only Log entry is of an Option since Archived", () => {
    // "gone" is not in the active Catalog, so no decided-block row renders.
    const result = view({
      options: [option("a", "Alpha")],
      dayEntries: [dayEntry("e1", "gone")],
    });

    expect(result.tonightsDinner).toEqual([]);
    expect(result.day.decided).toBe(true);
  });

  it("is undecided on a day with no Log entry", () => {
    expect(view({ options: [option("a", "Alpha")] }).day.decided).toBe(false);
  });

  it("lists closed rows alphabetically, not in rank order", () => {
    const closedSundays = { closedDays: [0] };
    const result = view({
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
    });
    expect(result.picker).toEqual([]);
    expect(suppressedIds(result, "closed")).toEqual(["a", "b", "c"]);
  });

  it("puts a Restaurant both closed and rejected for the Selected day in neither the picker nor closed", () => {
    const options = [
      option("a", "Alpha", { closedDays: [0] }), // closed Sundays
      option("b", "Beta"),
    ];
    const result = view({
      options,
      rejections: [rejection("a")],
    });
    expect(result.picker.map((r) => r.option.id)).not.toContain("a");
    expect(suppressedIds(result, "closed")).not.toContain("a");
    // Beta is neither closed nor rejected, so it stays on the picker.
    expect(result.picker.map((r) => r.option.id)).toEqual(["b"]);
    expect(suppressedIds(result, "closed")).toEqual([]);
    // …but tagged rejected, so the typeahead reads it as rejected (issue 02).
    expect(suppressedIds(result, "rejected")).toEqual(["a"]);
  });

  it("lists rejected rows in the Rejections' order, not rank order", () => {
    const result = view({
      options: [
        option("c", "Charlie"),
        option("a", "Alpha"),
        option("b", "Beta"),
      ],
      // Rank order is Charlie, Beta, Alpha; the Rejections come newest first.
      logEntries: [
        logEntry("c", "2026-04-01"),
        logEntry("b", "2026-05-01"),
        logEntry("a", "2026-05-16"),
      ],
      rejections: [rejection("b"), rejection("a"), rejection("c")],
    });
    expect(result.picker).toEqual([]);
    expect(suppressedIds(result, "rejected")).toEqual(["b", "a", "c"]);
  });

  it("tags an Option Picked for the day picked, not rejected, even with a lingering Rejection", () => {
    const result = view({
      options: [option("a", "Alpha")],
      logEntries: [logEntry("a", SUNDAY)],
      dayEntries: [dayEntry("e1", "a")],
      rejections: [rejection("a")],
    });
    expect(result.tonightsDinner.map((d) => d.row.option.id)).toEqual(["a"]);
    expect(suppressedIds(result, "picked")).toEqual(["a"]);
    expect(suppressedIds(result, "rejected")).toEqual([]);
  });

  it("gives the decided block's row pre-Pick recency, not the Selected day's own entry", () => {
    const options = [option("a", "Alpha")];
    const result = view({
      options,
      // The only Log entry for "a" is dated the Selected day itself — the Pick
      // that puts it in the decided block.
      logEntries: [logEntry("a", SUNDAY)],
      dayEntries: [dayEntry("e1", "a")],
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
    const result = view({
      options,
      logEntries: [logEntry("a", SUNDAY)],
      dayEntries: [dayEntry("e1", "a")],
    });
    const betaRow = result.picker.find((r) => r.option.id === "b");
    expect(betaRow).toBeDefined();
    const spicyTag = betaRow!.tags.find((t) => t.tag === "spicy");
    expect(spicyTag?.days).toBe(0);
  });

  it("keeps an Option Picked for the day off the picker", () => {
    const options = [option("a", "Alpha"), option("b", "Beta")];
    const result = view({
      options,
      logEntries: [logEntry("a", SUNDAY)],
      dayEntries: [dayEntry("e1", "a")],
    });
    expect(result.picker.map((r) => r.option.id)).toEqual(["b"]);
    expect(result.tonightsDinner.map((d) => d.row.option.id)).toEqual(["a"]);
  });

  it("marks allFiltered true when Rejections empty a non-empty picker", () => {
    const options = [option("a", "Alpha")];
    const result = view({
      options,
      rejections: [rejection("a")],
    });
    expect(result.picker).toEqual([]);
    expect(result.allFiltered).toBe(true);
  });

  it("marks allFiltered true when Closed days empty a non-empty picker", () => {
    const options = [option("a", "Alpha", { closedDays: [0] })];
    const result = view({
      options,
    });
    expect(result.picker).toEqual([]);
    expect(result.allFiltered).toBe(true);
  });

  it("marks allFiltered false for a genuinely empty Catalog", () => {
    const result = view({
      options: [],
    });
    expect(result.picker).toEqual([]);
    expect(result.allFiltered).toBe(false);
  });

  it("marks allFiltered false when the picker still has rows left", () => {
    const options = [option("a", "Alpha"), option("b", "Beta")];
    const result = view({
      options,
      rejections: [rejection("a")],
    });
    expect(result.picker.map((r) => r.option.id)).toEqual(["b"]);
    expect(result.allFiltered).toBe(false);
  });

  it("carries the Rejection's id and reason on a rejected row", () => {
    const result = view({
      options: [option("a", "Alpha"), option("b", "Beta")],
      rejections: [rejection("a", "Too heavy")],
    });

    expect(result.suppressed).toEqual([
      {
        suppression: "rejected",
        row: expect.objectContaining({ option: expect.objectContaining({ id: "a" }) }),
        rejection: { id: "r-a", reason: "Too heavy" },
      },
    ]);
  });

  it("tags every suppressed row: Picked, then Rejected, then Closed", () => {
    const result = view({
      options: [
        option("a", "Alpha"),
        option("b", "Beta", { closedDays: [0] }),
        option("c", "Charlie"),
        option("d", "Delta"),
      ],
      logEntries: [logEntry("c", SUNDAY)],
      dayEntries: [dayEntry("e1", "c")],
      rejections: [rejection("a")],
    });

    expect(
      result.suppressed.map((entry) => [entry.suppression, entry.row.option.id]),
    ).toEqual([
      ["picked", "c"],
      ["rejected", "a"],
      ["closed", "b"],
    ]);
    expect(result.picker.map((r) => r.option.id)).toEqual(["d"]);
  });

  it("names today Tonight and writes to it with no date", () => {
    expect(view().day).toEqual({
      date: SUNDAY,
      today: SUNDAY,
      isToday: true,
      heading: "Tonight",
      label: "tonight",
      writeDate: undefined,
      decided: false,
    });
  });

  it("names a past day by its weekday and writes to that date", () => {
    expect(view({ today: "2026-05-19" }).day).toEqual({
      date: SUNDAY,
      today: "2026-05-19",
      isToday: false,
      heading: "Sunday",
      label: "Sunday",
      writeDate: SUNDAY,
      decided: false,
    });
  });

  it("names a future day by its weekday and writes to that date", () => {
    expect(view({ today: "2026-05-15" }).day).toMatchObject({
      isToday: false,
      heading: "Sunday",
      label: "Sunday",
      writeDate: SUNDAY,
    });
  });

  it("carries the day's Day note", () => {
    expect(view({ dayNote: "Guests over" }).dayNote).toBe("Guests over");
  });
});
