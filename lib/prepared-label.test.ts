import { describe, expect, it } from "vitest";
import { preparedLabel } from "./prepared-label";

const LA = "America/Los_Angeles";

describe("preparedLabel", () => {
  it("gives only the time for a note prepared today, apart from its prefix", () => {
    // 21:14 UTC is 2:14pm in Los Angeles.
    expect(preparedLabel(new Date("2026-10-22T21:14:00Z"), "2026-10-22", LA)).toEqual({
      prefix: "Prepared",
      time: "2:14pm",
    });
  });

  it("names the weekday for a note prepared before today", () => {
    // 04:40 UTC on Tuesday the 20th is 9:40pm on Monday the 19th in Los Angeles.
    expect(preparedLabel(new Date("2026-10-20T04:40:00Z"), "2026-10-22", LA)).toEqual({
      prefix: "Prepared Mon",
      time: "9:40pm",
    });
  });

  it("reads today in the Household's time zone, not UTC's", () => {
    // 03:30 UTC on Friday the 23rd is still 8:30pm Thursday in Los Angeles.
    expect(preparedLabel(new Date("2026-10-23T03:30:00Z"), "2026-10-22", LA)).toEqual({
      prefix: "Prepared",
      time: "8:30pm",
    });
  });
});
