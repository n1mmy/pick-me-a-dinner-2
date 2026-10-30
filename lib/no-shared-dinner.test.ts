import { describe, expect, it } from "vitest";
import { isNoSharedDinner } from "./no-shared-dinner";

describe("isNoSharedDinner", () => {
  it("matches the name whatever its case or padding", () => {
    expect(isNoSharedDinner("No Shared Dinner")).toBe(true);
    expect(isNoSharedDinner("  no shared DINNER ")).toBe(true);
  });

  it("matches no other name", () => {
    expect(isNoSharedDinner("No Shared Dinners")).toBe(false);
    expect(isNoSharedDinner("Shared Dinner")).toBe(false);
  });
});
