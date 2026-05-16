/**
 * Tuning constants for the Tonight ranking engine (plan §7). Kept in one file
 * so the weights and thresholds can be tuned by feel without touching the
 * ranking logic itself.
 */

/** Days; also the substitute value for "never eaten" so "never" can't dominate. */
export const CAP = 60;

/** Weight on per-Option recency (the anti-repeat term). */
export const W_OPTION = 1.0;

/** Weight on per-Tag recency (the variety term). */
export const W_TAG = 1.0;

/** A Tag at or past this per-Tag recency renders as Overdue (accent color). */
export const OVERDUE_THRESHOLD = 14;
