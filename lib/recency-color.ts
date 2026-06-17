/**
 * The Tonight recency heatmap (DESIGN.md "Color" — "Two color channels"). Maps
 * a recency in days to a point on the continuous green->red scale: a recently
 * eaten Option/Tag (0 days) reads green, a long-overdue one reads red, and the
 * scale fades through a muted tan midpoint.
 *
 * The scale saturates at `RECENCY_COLOR_CAP` days — deliberately shorter than
 * the score's `CAP`, so the color reaches its red end well before the "60d+"
 * chip label does; past the color cap the tint no longer changes.
 *
 * The three anchor colors live only as CSS custom properties (`--color-recency-*`
 * in `app/globals.css`); this module emits `color-mix()` expressions over those
 * variables, so it never carries a hex literal and the light/dark themes both
 * resolve correctly at render time.
 */

/** Days at which the heatmap reaches its red (overdue) end; beyond this the tint is flat. */
export const RECENCY_COLOR_CAP = 30;

/** Clamp `value` into the inclusive `[min, max]` range. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * The core green→red gradient, parameterized by `t` ∈ [0,1] as a CSS
 * `color-mix()` string: `0` is the green (`recency-recent`) end, `0.5` the tan
 * midpoint, `1` the red (`recency-overdue`) end. Both the Recency and the
 * Affinity chip map their own value onto this `t`, so the two chips share one
 * scale and "good" reads green on both.
 */
function heatmapColor(t: number): string {
  const clamped = clamp(t, 0, 1);
  if (clamped <= 0.5) {
    const mid = (clamped / 0.5) * 100;
    return `color-mix(in srgb, var(--color-recency-recent), var(--color-recency-mid) ${mid}%)`;
  }
  const overdue = ((clamped - 0.5) / 0.5) * 100;
  return `color-mix(in srgb, var(--color-recency-mid), var(--color-recency-overdue) ${overdue}%)`;
}

/**
 * The heatmap color for a recency of `days` (0..`RECENCY_COLOR_CAP`): green when
 * recently eaten, red when long overdue, fading through tan. Caps at
 * `RECENCY_COLOR_CAP` days.
 */
export function recencyColor(days: number): string {
  return heatmapColor(clamp(days, 0, RECENCY_COLOR_CAP) / RECENCY_COLOR_CAP);
}

/**
 * The affinity value that reaches the green end of the heatmap — the "very
 * frequent" extreme. Average affinity (~1.0) lands at the tan midpoint and 0 at
 * the red end, so a favorite reads green and an avoided dish red.
 */
export const AFFINITY_COLOR_FULL = 2;

/**
 * The heatmap color for an `affinity` (the normalized eat-frequency factor):
 * frequent → green, rare → red, ~average → tan. The mapping is *inverted* from
 * recency — there a low day-count is green — so that the "good" end is green on
 * both chips: fresh and frequent both read green.
 */
export function affinityColor(affinity: number): string {
  return heatmapColor(
    1 - clamp(affinity, 0, AFFINITY_COLOR_FULL) / AFFINITY_COLOR_FULL,
  );
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

/**
 * The Affinity chip background for an `affinity`: the affinity heatmap color at
 * the *fainter* opacity the Tag chips use, not the Recency chip's stronger fill.
 * That weight difference is what tells the two heatmap chips apart — recency
 * reads louder, affinity quieter — rather than an easily-missed hairline.
 */
export function affinityChipBg(affinity: number): string {
  return `color-mix(in srgb, ${affinityColor(affinity)}, transparent 86%)`;
}
