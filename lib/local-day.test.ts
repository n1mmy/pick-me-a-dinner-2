import { describe, expect, it } from "vitest";
import {
  epochDayFromSqlDate,
  isValidSqlDate,
  parseSelectedDay,
  shiftSqlDate,
  todayEpochDay,
  todaySqlDate,
} from "./local-day";

describe("isValidSqlDate", () => {
  it("accepts a well-formed real calendar date", () => {
    expect(isValidSqlDate("2026-05-16")).toBe(true);
    expect(isValidSqlDate("2024-02-29")).toBe(true);
  });

  it("rejects an empty string — a cleared date input", () => {
    expect(isValidSqlDate("")).toBe(false);
  });

  it("rejects a malformed shape", () => {
    expect(isValidSqlDate("2026-5-1")).toBe(false);
    expect(isValidSqlDate("16/05/2026")).toBe(false);
    expect(isValidSqlDate("not-a-date")).toBe(false);
  });

  it("rejects a right-shaped but impossible day", () => {
    expect(isValidSqlDate("2026-02-30")).toBe(false);
    expect(isValidSqlDate("2026-13-01")).toBe(false);
    expect(isValidSqlDate("2025-02-29")).toBe(false);
  });
});

describe("epochDayFromSqlDate", () => {
  it("anchors the Unix epoch at day 0", () => {
    expect(epochDayFromSqlDate("1970-01-01")).toBe(0);
    expect(epochDayFromSqlDate("1970-01-02")).toBe(1);
  });

  it("counts consecutive calendar dates as exactly one day apart", () => {
    expect(
      epochDayFromSqlDate("2026-05-16") - epochDayFromSqlDate("2026-05-15"),
    ).toBe(1);
  });

  it("counts a DST-transition date pair as exactly one day apart", () => {
    // 2026-03-08 is the 23-hour spring-forward day in America/Los_Angeles.
    expect(
      epochDayFromSqlDate("2026-03-09") - epochDayFromSqlDate("2026-03-08"),
    ).toBe(1);
  });
});

describe("todayEpochDay across a DST boundary", () => {
  const LA = "America/Los_Angeles";

  it("reads the local calendar day, not the UTC day, around local midnight", () => {
    // LA is on PDT (UTC-7) after the 2026-03-08 spring-forward.
    // 2026-03-09T06:59:00Z = 2026-03-08 23:59 local — still March 8.
    const beforeMidnight = todayEpochDay(
      new Date("2026-03-09T06:59:00Z"),
      LA,
    );
    // 2026-03-09T07:01:00Z = 2026-03-09 00:01 local — now March 9.
    const afterMidnight = todayEpochDay(new Date("2026-03-09T07:01:00Z"), LA);

    expect(beforeMidnight).toBe(epochDayFromSqlDate("2026-03-08"));
    expect(afterMidnight).toBe(epochDayFromSqlDate("2026-03-09"));
    // Two instants two minutes apart, yet exactly one epoch-day apart.
    expect(afterMidnight - beforeMidnight).toBe(1);
  });

  it("counts the 23-hour spring-forward day as exactly one day", () => {
    // Noon local on either side of the DST transition.
    const dstDay = todayEpochDay(new Date("2026-03-08T20:00:00Z"), LA);
    const dayAfter = todayEpochDay(new Date("2026-03-09T19:00:00Z"), LA);
    expect(dayAfter - dstDay).toBe(1);
  });

  it("resolves the calendar day in the given zone, not the server's", () => {
    // 2026-05-16T05:00:00Z is still May 15 in Los Angeles (UTC-7).
    expect(todaySqlDate(new Date("2026-05-16T05:00:00Z"), LA)).toBe(
      "2026-05-15",
    );
    expect(todaySqlDate(new Date("2026-05-16T05:00:00Z"), "UTC")).toBe(
      "2026-05-16",
    );
  });
});

describe("parseSelectedDay", () => {
  const TODAY = "2026-05-20";

  it("returns today when the raw value is missing", () => {
    expect(parseSelectedDay(undefined, TODAY)).toBe(TODAY);
  });

  it("returns today when the raw value is empty", () => {
    expect(parseSelectedDay("", TODAY)).toBe(TODAY);
  });

  it("returns today when the raw value is not a string (array, number)", () => {
    expect(parseSelectedDay(["2026-05-22"], TODAY)).toBe(TODAY);
    expect(parseSelectedDay(20260522, TODAY)).toBe(TODAY);
  });

  it("returns today when the raw value is malformed", () => {
    expect(parseSelectedDay("not-a-date", TODAY)).toBe(TODAY);
    expect(parseSelectedDay("2026-13-01", TODAY)).toBe(TODAY);
    expect(parseSelectedDay("2026-02-30", TODAY)).toBe(TODAY);
  });

  it("returns today for a valid date in the past — past is off-limits", () => {
    expect(parseSelectedDay("2026-05-19", TODAY)).toBe(TODAY);
    expect(parseSelectedDay("2025-12-31", TODAY)).toBe(TODAY);
  });

  it("returns today for the exact today date", () => {
    expect(parseSelectedDay(TODAY, TODAY)).toBe(TODAY);
  });

  it("returns the date for a valid future Selected day", () => {
    expect(parseSelectedDay("2026-05-22", TODAY)).toBe("2026-05-22");
    expect(parseSelectedDay("2027-01-01", TODAY)).toBe("2027-01-01");
  });
});

describe("shiftSqlDate", () => {
  it("steps forward by one day", () => {
    expect(shiftSqlDate("2026-05-20", 1)).toBe("2026-05-21");
  });

  it("steps back by one day", () => {
    expect(shiftSqlDate("2026-05-20", -1)).toBe("2026-05-19");
  });

  it("wraps the last day of a month to the first of the next", () => {
    expect(shiftSqlDate("2026-05-31", 1)).toBe("2026-06-01");
    expect(shiftSqlDate("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("handles a leap-year February correctly", () => {
    expect(shiftSqlDate("2024-02-29", 1)).toBe("2024-03-01");
    expect(shiftSqlDate("2024-03-01", -1)).toBe("2024-02-29");
  });

  it("a +1 then -1 round-trip returns the same date", () => {
    expect(shiftSqlDate(shiftSqlDate("2026-03-08", 1), -1)).toBe("2026-03-08");
  });
});
