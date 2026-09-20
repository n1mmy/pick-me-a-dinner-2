import { describe, expect, it } from "vitest";
import { affinityChipBg, recencyChipBg, recencyChipBgStrong } from "./recency-color";

/**
 * The core green->tan->red heatmap strings the chip helpers wrap in an
 * opacity `color-mix()`. `recencyColor` / `affinityColor` — and the
 * `RECENCY_COLOR_CAP` (30) / `AFFINITY_COLOR_FULL` (2) constants they're built
 * from — are all module-private (only the three chip functions are the
 * public interface), so the heatmap rules — cap, midpoint, interpolation,
 * clamping — are asserted here through them, with the cap/full values
 * inlined as literals.
 */
const RECENCY_COLOR_CAP = 30;
const AFFINITY_COLOR_FULL = 2;
const GREEN_END =
  "color-mix(in srgb, var(--color-recency-recent), var(--color-recency-mid) 0%)";
const MID =
  "color-mix(in srgb, var(--color-recency-recent), var(--color-recency-mid) 100%)";
const RED_END =
  "color-mix(in srgb, var(--color-recency-mid), var(--color-recency-overdue) 100%)";
const LOWER_INTERPOLATED =
  "color-mix(in srgb, var(--color-recency-recent), var(--color-recency-mid) 50%)";
const UPPER_INTERPOLATED =
  "color-mix(in srgb, var(--color-recency-mid), var(--color-recency-overdue) 50%)";

/** `recencyChipBg` / `affinityChipBg`'s fainter opacity wrap. */
function faint(color: string): string {
  return `color-mix(in srgb, ${color}, transparent 86%)`;
}

describe("recencyChipBg (recency heatmap: green -> tan -> red)", () => {
  it("returns pure recency-recent at 0 days (just eaten — green end)", () => {
    expect(recencyChipBg(0)).toBe(faint(GREEN_END));
  });

  it("returns pure recency-mid at the midpoint", () => {
    expect(recencyChipBg(RECENCY_COLOR_CAP / 2)).toBe(faint(MID));
  });

  it("returns pure recency-overdue at the color cap (long overdue — red end)", () => {
    expect(recencyChipBg(RECENCY_COLOR_CAP)).toBe(faint(RED_END));
  });

  it("interpolates within the lower (recent->mid) segment", () => {
    expect(recencyChipBg(RECENCY_COLOR_CAP / 4)).toBe(faint(LOWER_INTERPOLATED));
  });

  it("interpolates within the upper (mid->overdue) segment", () => {
    expect(recencyChipBg((RECENCY_COLOR_CAP * 3) / 4)).toBe(
      faint(UPPER_INTERPOLATED),
    );
  });

  it("clamps days beyond the color cap to the red (overdue) end", () => {
    expect(recencyChipBg(RECENCY_COLOR_CAP + 100)).toBe(
      recencyChipBg(RECENCY_COLOR_CAP),
    );
  });

  it("clamps a negative recency to the green (recent) end", () => {
    expect(recencyChipBg(-5)).toBe(recencyChipBg(0));
  });
});

describe("affinityChipBg (affinity heatmap, inverted: frequent -> green)", () => {
  // Affinity shares the recency heatmap but maps it *inverted*, so "good" is
  // green on both chips: frequent → green, rare → red, ~average → tan.
  it("paints a very frequent Option the green (recent) end", () => {
    expect(affinityChipBg(AFFINITY_COLOR_FULL)).toBe(recencyChipBg(0));
  });

  it("paints a never/rarely eaten Option the red (overdue) end", () => {
    expect(affinityChipBg(0)).toBe(recencyChipBg(RECENCY_COLOR_CAP));
  });

  it("paints an average-affinity (1.0) Option the tan midpoint", () => {
    expect(affinityChipBg(1)).toBe(recencyChipBg(RECENCY_COLOR_CAP / 2));
  });

  it("clamps affinity beyond the green-end value", () => {
    expect(affinityChipBg(AFFINITY_COLOR_FULL + 5)).toBe(
      affinityChipBg(AFFINITY_COLOR_FULL),
    );
  });
});

describe("recencyChipBgStrong", () => {
  it("wraps the heatmap color at a stronger opacity than recencyChipBg", () => {
    expect(recencyChipBgStrong(0)).toBe(
      `color-mix(in srgb, ${GREEN_END}, transparent 62%)`,
    );
  });
});
