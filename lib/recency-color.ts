/**
 * The Tonight recency heatmap (DESIGN.md "Color" — "Two color channels"). Maps
 * a recency in days to a point on the continuous red->green scale: a recently
 * eaten Option/Tag (0 days) reads red, a long-overdue one (`CAP` days) reads
 * green, and the scale fades through a muted tan midpoint.
 *
 * The three anchor colors live only as CSS custom properties (`--color-recency-*`
 * in `app/globals.css`); this module emits `color-mix()` expressions over those
 * variables, so it never carries a hex literal and the light/dark themes both
 * resolve correctly at render time.
 */
import { CAP } from "./ranking.config";

/** Clamp `value` into the inclusive `[min, max]` range. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * The heatmap color for a recency of `days` (0..`CAP`), as a CSS `color-mix()`
 * string. Below the midpoint it interpolates `recency-recent`->`recency-mid`;
 * above it, `recency-mid`->`recency-overdue`.
 */
export function recencyColor(days: number): string {
  const t = clamp(days, 0, CAP) / CAP;
  if (t <= 0.5) {
    const mid = (t / 0.5) * 100;
    return `color-mix(in srgb, var(--color-recency-recent), var(--color-recency-mid) ${mid}%)`;
  }
  const overdue = ((t - 0.5) / 0.5) * 100;
  return `color-mix(in srgb, var(--color-recency-mid), var(--color-recency-overdue) ${overdue}%)`;
}

/**
 * The Tag chip background for a recency of `days`: the heatmap color at low
 * opacity, so the tint reads under `text-ink` without overpowering it. The
 * faint end of the two-tier chip scale — the louder Recency chip uses
 * `recencyChipBgStrong`.
 */
export function recencyChipBg(days: number): string {
  return `color-mix(in srgb, ${recencyColor(days)}, transparent 86%)`;
}

/**
 * The Recency chip background for a recency of `days`: the heatmap color at a
 * stronger opacity than `recencyChipBg`, so the single per-Option Recency chip
 * reads louder than the per-Tag chips beside it. Still translucent — never a
 * solid fill — so `text-ink` stays legible across the whole red→green heatmap
 * (the light tan midpoint would fail contrast under an opaque fill) in both
 * the light and dark themes.
 */
export function recencyChipBgStrong(days: number): string {
  return `color-mix(in srgb, ${recencyColor(days)}, transparent 62%)`;
}
