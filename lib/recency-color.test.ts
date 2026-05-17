import { describe, expect, it } from "vitest";
import { CAP } from "./ranking.config";
import {
  recencyChipBg,
  recencyChipBgStrong,
  recencyColor,
} from "./recency-color";

describe("recencyColor", () => {
  it("returns pure recency-recent at 0 days (just eaten)", () => {
    expect(recencyColor(0)).toBe(
      "color-mix(in srgb, var(--color-recency-recent), var(--color-recency-mid) 0%)",
    );
  });

  it("returns pure recency-mid at the midpoint", () => {
    expect(recencyColor(CAP / 2)).toBe(
      "color-mix(in srgb, var(--color-recency-recent), var(--color-recency-mid) 100%)",
    );
  });

  it("returns pure recency-overdue at CAP days (long overdue)", () => {
    expect(recencyColor(CAP)).toBe(
      "color-mix(in srgb, var(--color-recency-mid), var(--color-recency-overdue) 100%)",
    );
  });

  it("interpolates within the lower (recent->mid) segment", () => {
    expect(recencyColor(CAP / 4)).toBe(
      "color-mix(in srgb, var(--color-recency-recent), var(--color-recency-mid) 50%)",
    );
  });

  it("interpolates within the upper (mid->overdue) segment", () => {
    expect(recencyColor((CAP * 3) / 4)).toBe(
      "color-mix(in srgb, var(--color-recency-mid), var(--color-recency-overdue) 50%)",
    );
  });

  it("clamps days beyond CAP to the green end", () => {
    expect(recencyColor(CAP + 100)).toBe(recencyColor(CAP));
  });

  it("clamps a negative recency to the red (recent) end", () => {
    expect(recencyColor(-5)).toBe(recencyColor(0));
  });
});

describe("recencyChipBg", () => {
  it("wraps the heatmap color at low opacity", () => {
    expect(recencyChipBg(0)).toBe(
      `color-mix(in srgb, ${recencyColor(0)}, transparent 86%)`,
    );
  });
});

describe("recencyChipBgStrong", () => {
  it("wraps the heatmap color at a stronger opacity than recencyChipBg", () => {
    expect(recencyChipBgStrong(0)).toBe(
      `color-mix(in srgb, ${recencyColor(0)}, transparent 62%)`,
    );
  });
});
