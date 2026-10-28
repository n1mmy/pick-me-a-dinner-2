import { describe, expect, it } from "vitest";
import type { ModelSnapshot } from "./ai-search";
import { PREPARED_PROMPT_VERSION } from "./prepared-note";
import { eligibleDays, inputHash } from "./prepared-notes-job";

const LA = "America/Los_Angeles";

/** A fresh snapshot each call, so equal inputs are never the same object. */
function snapshot(todayDayNote: string | null = null): ModelSnapshot {
  return {
    today: "2026-10-22 (Thursday)",
    query: "",
    options: [],
    log: [],
    rejections: { rejectedTonight: [], notTodayRejections: [] },
    dayNotes: [],
    todayDayNote,
  };
}

describe("eligibleDays", () => {
  it("is today through six days ahead in the Household's timezone, today first", () => {
    expect(eligibleDays(new Date("2026-10-22T19:00:00Z"), LA, [])).toEqual([
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
    ]);
  });

  it("starts from the local day, not the UTC one, late in the evening", () => {
    // 22:30 on Thursday the 22nd in Los Angeles is already Friday in UTC.
    const days = eligibleDays(new Date("2026-10-23T05:30:00Z"), LA, []);

    expect(days[0]).toBe("2026-10-22");
    expect(days[6]).toBe("2026-10-28");
  });

  it("rolls over the end of a month", () => {
    expect(eligibleDays(new Date("2026-10-29T19:00:00Z"), LA, [])).toEqual([
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
    ]);
  });

  it("leaves out the dates that already have a Log entry", () => {
    expect(
      eligibleDays(new Date("2026-10-22T19:00:00Z"), LA, [
        "2026-10-22",
        "2026-10-25",
        "2026-10-25",
        "2026-10-20",
        "2026-11-30",
      ]),
    ).toEqual(["2026-10-23", "2026-10-24", "2026-10-26", "2026-10-27", "2026-10-28"]);
  });
});

describe("inputHash", () => {
  it("is stable for the same snapshot and model", () => {
    expect(inputHash(snapshot(), "qwen")).toBe(inputHash(snapshot(), "qwen"));
  });

  it("changes when the snapshot changes", () => {
    expect(inputHash(snapshot("Guests over"), "qwen")).not.toBe(
      inputHash(snapshot(), "qwen"),
    );
  });

  it("changes when the model changes", () => {
    expect(inputHash(snapshot(), "qwen-next")).not.toBe(
      inputHash(snapshot(), "qwen"),
    );
  });

  it("changes when the prompt version changes, and defaults to the current one", () => {
    expect(inputHash(snapshot(), "qwen")).toBe(
      inputHash(snapshot(), "qwen", PREPARED_PROMPT_VERSION),
    );
    expect(inputHash(snapshot(), "qwen", "next-prompt")).not.toBe(
      inputHash(snapshot(), "qwen"),
    );
  });
});
