import { describe, expect, it } from "vitest";
import { bradleyTerry } from "./pairwise-order";

describe("bradleyTerry", () => {
  it("orders a transitive tournament as the pairs say", () => {
    const strength = bradleyTerry([
      { a: "x", b: "y", p: 0.8 },
      { a: "y", b: "z", p: 0.8 },
      { a: "x", b: "z", p: 0.9 },
    ]);
    const order = [...strength].sort((a, b) => b[1] - a[1]).map(([item]) => item);
    expect(order).toEqual(["x", "y", "z"]);
  });

  it("reads a pair's probability from either side", () => {
    const a = bradleyTerry([{ a: "x", b: "y", p: 0.7 }]);
    const b = bradleyTerry([{ a: "y", b: "x", p: 0.3 }]);
    expect(a.get("x")).toBeCloseTo(b.get("x")!, 4);
    expect(a.get("x")!).toBeGreaterThan(a.get("y")!);
  });

  it("normalizes strengths to sum to 1", () => {
    const strength = bradleyTerry([
      { a: "x", b: "y", p: 0.5 },
      { a: "y", b: "z", p: 0.5 },
    ]);
    const total = [...strength.values()].reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(1, 6);
  });
});
