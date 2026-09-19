import { describe, expect, it } from "vitest";
import { isClosedOn } from "./closed-days";

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
