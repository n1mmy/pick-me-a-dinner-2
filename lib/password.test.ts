import { describe, expect, it } from "vitest";
import { passwordMatches } from "./password";

describe("passwordMatches", () => {
  it("accepts the exact password", () => {
    expect(passwordMatches("open-sesame", "open-sesame")).toBe(true);
  });

  it("rejects a wrong password of the same length", () => {
    expect(passwordMatches("open-sesami", "open-sesame")).toBe(false);
  });

  it("rejects a password of a different length", () => {
    expect(passwordMatches("open-sesame!", "open-sesame")).toBe(false);
    expect(passwordMatches("", "open-sesame")).toBe(false);
  });

  it("compares UTF-8 bytes, distinguishing accented characters", () => {
    expect(passwordMatches("café", "café")).toBe(true);
    expect(passwordMatches("cafe", "café")).toBe(false);
  });
});
