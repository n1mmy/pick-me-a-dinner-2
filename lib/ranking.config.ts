/**
 * Tuning constants for the Tonight ranking engine (plan §7). Kept in one file
 * so the weights and thresholds can be tuned by feel without touching the
 * ranking logic itself.
 *
 * ## Why the Score is `affinity × readiness`, not recency alone
 *
 * The original Score was pure anti-repeat — `recency + tag-recency`, additive.
 * That model has no notion of preference, so it mathematically *rewards
 * avoidance*: an Option the Household dislikes gets eaten rarely → its
 * days-since climbs → its Score rises → it pins to the top of Tonight. Nobody
 * Picks it, so it never leaves. The result was that the same infrequent,
 * not-very-liked Options sat on top every day (the cap flattened them into an
 * identical max Score, so even the order never changed).
 *
 * The fix introduces **affinity** — a recency-weighted eat-*frequency*, the
 * Household's revealed preference, derived from the Log with no new schema —
 * and multiplies: `Score = affinity × readiness`. Affinity *gates* the
 * anti-repeat boost, so a low-affinity dish can't ride staleness to the top.
 * Multiplicative (not additive) is deliberate: only a product lets low affinity
 * cancel high readiness. Anything that reverts this to an additive recency-only
 * Score reintroduces the avoidance death-spiral — don't.
 *
 * Roads deliberately *not* taken (so they aren't silently relitigated):
 *   - No explicit ratings — affinity is inferred from eat-frequency, no schema.
 *   - Rejections stay day-scoped (they drop an Option for the night and feed AI
 *     search) — they do **not** permanently lower affinity.
 *   - The CAP below is kept: readiness saturates at "overdue" and affinity does
 *     the differentiating, which is what cured the flattening.
 */

/** Days; the readiness ceiling, and the substitute for "never eaten". */
export const CAP = 60;

/** A Tag at or past this per-Tag recency counts as Overdue (drives the chip). */
export const OVERDUE_THRESHOLD = 14;

/**
 * Readiness blend: how much per-Tag (cuisine) recency counts toward an Option's
 * readiness, versus its own per-Option recency. 0 = per-Option recency only;
 * 0.35 lets "had this cuisine recently" damp a dish without overruling its own
 * staleness. Keeps cuisine-rotation (the old `variety` term) alive inside the
 * readiness factor.
 */
export const READINESS_TAG_WEIGHT = 0.35;

/**
 * Affinity decay half-life, in days: an eat this many days ago counts half as
 * much as one today toward affinity. A soft decay (not a hard window) tracks
 * *current* taste while keeping enough signal density for a sparse personal Log
 * (~tens of Options, low hundreds of entries). Larger = more historical, more
 * stable; smaller = more responsive, noisier.
 */
export const AFFINITY_HALF_LIFE = 45;

/**
 * Affinity blend: how much per-Tag (cuisine) frequency counts toward an Option's
 * affinity, versus its own eat-frequency. Its main job is cold-start — a
 * never-eaten dish inherits its cuisine's affinity instead of a flat default,
 * so a new Pasta in a Pasta-loving Household surfaces and a new dish in a cuisine
 * the Household avoids does not.
 */
export const AFFINITY_TAG_WEIGHT = 0.4;

/**
 * The affinity for an Option with no eat-frequency signal at all — never eaten,
 * and none of its Tags ever used (or it has no Tags). Normalized affinity is
 * centered near 1.0 = catalog-average, so a neutral 1.0 gives a genuinely-new
 * Option a fair, mid-pack shot rather than pinning it to the top (the old
 * never-eaten = CAP behavior) or burying it at zero.
 */
export const NEUTRAL_AFFINITY = 1.0;
