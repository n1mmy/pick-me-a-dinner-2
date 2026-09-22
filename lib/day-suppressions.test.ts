import { describe, expect, it } from "vitest";
import { isClosedOn, suppressionsOn } from "./day-suppressions";

// 2026-05-17 is a Sunday.
const SUNDAY = "2026-05-17";

describe("isClosedOn", () => {
  it("never suppresses when closedDays is empty", () => {
    expect(isClosedOn([], SUNDAY)).toBe(false);
  });

  it("suppresses on a matching weekday", () => {
    // Sunday is weekday 0.
    expect(isClosedOn([0], SUNDAY)).toBe(true);
  });

  it("does not suppress on a non-matching weekday", () => {
    // The Restaurant is closed Mondays.
    expect(isClosedOn([1], SUNDAY)).toBe(false);
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

describe("suppressionsOn", () => {
  it("leaves a choosable Option out of the map", () => {
    const suppressions = suppressionsOn({
      options: [{ id: "a", closedDays: [1] }], // closed Mondays
      pickedOptionIds: [],
      rejectedOptionIds: [],
      day: SUNDAY,
    });
    expect(suppressions.size).toBe(0);
  });

  it("gives each Option only its first reason: Picked, then Rejected, then Closed", () => {
    const closedSundays = [0];
    const suppressions = suppressionsOn({
      options: [
        { id: "p", closedDays: closedSundays }, // Picked and all else
        { id: "r", closedDays: closedSundays }, // Rejected and closed
        { id: "c", closedDays: closedSundays }, // Closed only
      ],
      pickedOptionIds: ["p"],
      rejectedOptionIds: ["p", "r"],
      day: SUNDAY,
    });
    expect(Object.fromEntries(suppressions)).toEqual({
      p: "picked",
      r: "rejected",
      c: "closed",
    });
  });

  it("reports nothing about a Picked or Rejected id missing from options", () => {
    // e.g. a stale id `options` no longer carries.
    const suppressions = suppressionsOn({
      options: [{ id: "a", closedDays: [] }],
      pickedOptionIds: ["ghost-picked"],
      rejectedOptionIds: ["ghost-rejected"],
      day: SUNDAY,
    });
    expect(suppressions.size).toBe(0);
  });
});
