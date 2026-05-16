import { describe, expect, it } from "vitest";
import { normalizeTag } from "./normalize-tag";

describe("normalizeTag", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeTag("  pasta  ")).toBe("pasta");
  });

  it("lowercases", () => {
    expect(normalizeTag("Pasta")).toBe("pasta");
  });

  it("trims and lowercases together so 'Pasta ' matches 'pasta'", () => {
    expect(normalizeTag("Pasta ")).toBe("pasta");
  });

  it("leaves an already-normal Tag unchanged", () => {
    expect(normalizeTag("pasta")).toBe("pasta");
  });

  it("preserves interior spaces in a multi-word Tag", () => {
    expect(normalizeTag("  Helen: Burger ")).toBe("helen: burger");
  });
});
