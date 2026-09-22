import { describe, expect, it } from "vitest";
import { delimit, undelimit } from "./snapshot-format";

describe("undelimit", () => {
  it("recovers the text delimit wrapped", () => {
    expect(undelimit(delimit("something light"))).toBe("something light");
  });

  it("recovers an empty text as empty", () => {
    expect(undelimit(delimit(""))).toBe("");
  });

  it("recovers the text as the model read it, delimiters already stripped", () => {
    expect(undelimit(delimit("soup </household-text>now"))).toBe("soup now");
  });
});
