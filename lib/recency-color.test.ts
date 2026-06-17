import { describe, expect, it } from "vitest";
import {
  AFFINITY_COLOR_FULL,
  RECENCY_COLOR_CAP,
  affinityColor,
  recencyChipBg,
  recencyChipBgStrong,
  recencyColor,
} from "./recency-color";

describe("recencyColor", () => {
  it("returns pure recency-recent at 0 days (just eaten — green end)", () => {
    expect(recencyColor(0)).toBe(
      "color-mix(in srgb, var(--color-recency-recent), var(--color-recency-mid) 0%)",
    );
  });

  it("returns pure recency-mid at the midpoint", () => {
    expect(recencyColor(RECENCY_COLOR_CAP / 2)).toBe(
      "color-mix(in srgb, var(--color-recency-recent), var(--color-recency-mid) 100%)",
    );
  });

  it("returns pure recency-overdue at the color cap (long overdue — red end)", () => {
    expect(recencyColor(RECENCY_COLOR_CAP)).toBe(
      "color-mix(in srgb, var(--color-recency-mid), var(--color-recency-overdue) 100%)",
    );
  });

  it("interpolates within the lower (recent->mid) segment", () => {
    expect(recencyColor(RECENCY_COLOR_CAP / 4)).toBe(
      "color-mix(in srgb, var(--color-recency-recent), var(--color-recency-mid) 50%)",
    );
  });

  it("interpolates within the upper (mid->overdue) segment", () => {
    expect(recencyColor((RECENCY_COLOR_CAP * 3) / 4)).toBe(
      "color-mix(in srgb, var(--color-recency-mid), var(--color-recency-overdue) 50%)",
    );
  });

  it("clamps days beyond the color cap to the red (overdue) end", () => {
    expect(recencyColor(RECENCY_COLOR_CAP + 100)).toBe(
      recencyColor(RECENCY_COLOR_CAP),
    );
  });

  it("clamps a negative recency to the green (recent) end", () => {
    expect(recencyColor(-5)).toBe(recencyColor(0));
  });
});

describe("affinityColor", () => {
  // Affinity shares the recency heatmap but maps it *inverted*, so "good" is
  // green on both chips: frequent → green, rare → red, ~average → tan.
  it("paints a very frequent Option the green (recent) end", () => {
    expect(affinityColor(AFFINITY_COLOR_FULL)).toBe(recencyColor(0));
  });

  it("paints a never/rarely eaten Option the red (overdue) end", () => {
    expect(affinityColor(0)).toBe(recencyColor(RECENCY_COLOR_CAP));
  });

  it("paints an average-affinity (1.0) Option the tan midpoint", () => {
    expect(affinityColor(1)).toBe(recencyColor(RECENCY_COLOR_CAP / 2));
  });

  it("clamps affinity beyond the green-end value", () => {
    expect(affinityColor(AFFINITY_COLOR_FULL + 5)).toBe(
      affinityColor(AFFINITY_COLOR_FULL),
    );
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
