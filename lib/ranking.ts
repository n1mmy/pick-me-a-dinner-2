/**
 * The Tonight ranking engine (plan §7, ADR-0003) — a deep, pure module with no
 * DB or React dependency. It maps the active Catalog, each Option's Tags, the
 * Log entries (any date) and a single **anchor day** to the Tonight list:
 * Options ranked descending by Score, each with an Explanation chip and per-Tag
 * recency.
 *
 * ## The Score: `affinity × readiness`
 *
 * Each Option's Score is the product of two factors (see `ranking.config.ts`
 * for the full rationale and the roads not taken):
 *
 *   - **readiness** — the anti-repeat / variety term: how overdue the Option is,
 *     a blend of its own per-Option recency and its per-Tag (cuisine) recency,
 *     each capped at `CAP` days. High when the Household hasn't had this dish (or
 *     its cuisine) in a while.
 *   - **affinity** — the Household's revealed preference: a recency-weighted
 *     eat-*frequency*, blended from the Option's own eats and its cuisine's eats,
 *     then normalized so ~1.0 is catalog-average. High for dishes eaten often
 *     lately, low for ones eaten rarely.
 *
 * Multiplying lets low affinity *gate* the readiness boost, so a disliked dish
 * can't ride staleness to the top — the failure the pure-recency Score had.
 *
 * ## Anchor day
 *
 * The anchor day defaults to today on the standard Tonight render, but the
 * caller may pass any other day — the **Selected day** the Household stepped
 * to (ADR-0009). The math is the same either way: Log entries dated after the
 * anchor are excluded by `lastEaten` / `lastTagUse` (and by the affinity
 * decay), so a caller may pass them in harmlessly, and recency is
 * `anchor - lastEaten`. Planning a future Selected day's dinner therefore
 * re-anchors the ranking to that day; Planned dinners between today and the
 * Selected day count toward that day's recency.
 *
 * All dates arrive as integer epoch-days (see `local-day.ts`); recency is pure
 * integer arithmetic, while affinity uses the decay curve from the config.
 */
import {
  AFFINITY_HALF_LIFE,
  AFFINITY_TAG_WEIGHT,
  CAP,
  NEUTRAL_AFFINITY,
  OVERDUE_THRESHOLD,
  READINESS_TAG_WEIGHT,
} from "./ranking.config";

/**
 * An active Catalog Option, with the names of the Tags attached to it. `url`
 * and `phone` are carried purely for the consumer — the ranking math ignores
 * them, exactly as it ignores `kind` — so the decided view (PRD: Tonight —
 * decided mode) can render the Menu / Call / Recipe action buttons from a
 * `TonightRow` without a second lookup. `phone` is always `null` for a Home
 * meal.
 */
export type RankOption = {
  id: string;
  name: string;
  kind: "home" | "restaurant";
  tags: string[];
  /** Menu / delivery / recipe link; `null` when none is on file. */
  url: string | null;
  /** Restaurant phone; always `null` for a Home meal. */
  phone: string | null;
};

/** A Log entry reduced to what the ranking needs: which Option, eaten when. */
export type LogEntry = {
  optionId: string;
  /** `eaten_on` as an epoch-day in `APP_TZ` (see `local-day.ts`). */
  eatenOn: number;
};

/** One Tag on a Tonight row, with its per-Tag recency in days. */
export type TagRecency = {
  tag: string;
  /** Per-Tag recency, in days, capped at `CAP`. */
  days: number;
  /** True once the Tag has crossed `OVERDUE_THRESHOLD`. */
  overdue: boolean;
};

/** One row of the Tonight list. */
export type TonightRow = {
  option: RankOption;
  /** The Score: `affinity × readiness`. Drives the descending sort. */
  score: number;
  /**
   * The revealed-preference factor: recency-weighted eat-frequency, blended
   * per-Option and per-cuisine, normalized so ~1.0 is catalog-average (see
   * `computeAffinities`). Surfaced on the row so it can be shown alongside
   * readiness while the Score is tuned.
   */
  affinity: number;
  /**
   * The anti-repeat / variety factor: a blend of per-Option recency and per-Tag
   * recency in days (so it shares `recencyDays`' capped-day unit). Surfaced for
   * the same tuning reason.
   */
  readiness: number;
  tags: TagRecency[];
  /**
   * Per-Option recency in days, capped at `CAP`. Drives the Recency chip's text
   * and heatmap fill; it is also the per-Option half of `readiness`.
   */
  recencyDays: number;
  /**
   * True when the Option has no Log entry dated on or before the anchor day.
   * `recencyDays` caps at `CAP`, so a never-eaten Option and one last eaten 60+
   * days ago both read `CAP` — this flag lets the Recency chip show "new"
   * instead of "60d+".
   */
  neverEaten: boolean;
};

/**
 * The single-Option ranking view for the Option detail page — the same
 * Score / affinity / readiness / per-Option recency / Tag fields a `TonightRow`
 * carries, computed for one Option. For an active Option it equals that Option's
 * `rankTonight` row over the same inputs, so the detail page and Tonight never
 * disagree; for an Archived Option `score` and `affinity` are `null` — it takes
 * no part in the ranking — while the factual recency fields are still computed.
 */
export type OptionRanking = {
  /** The Score, or `null` for an Archived Option (excluded from ranking). */
  score: number | null;
  /** The affinity factor, or `null` for an Archived Option. */
  affinity: number | null;
  /** The readiness factor (always computed — it needs no catalog context). */
  readiness: number;
  tags: TagRecency[];
  /** Per-Option recency in days, capped at `CAP`. */
  recencyDays: number;
  /** True when the Option has no Log entry dated on or before the anchor day. */
  neverEaten: boolean;
};

/** Arithmetic mean of a non-empty list. */
function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Mean of `values`, but never below a positive floor of 1: an empty list or an
 * all-zero one (a cold-start catalog) yields 1, so it is safe as a normalization
 * denominator. A zero numerator over this 1 is still 0, which the neutral-affinity
 * floor then catches.
 */
function positiveMean(values: number[]): number {
  if (values.length === 0) return 1;
  const m = mean(values);
  return m > 0 ? m : 1;
}

/**
 * Days from `day` to the `asOf` anchor day, capped at `CAP`. A `null` `day`
 * ("never eaten" / "never used") returns `CAP` so it cannot dominate the
 * ranking. A `day` after `asOf` — which `lastEaten` / `lastTagUse` already
 * exclude — is guarded to 0 so it can never push a value negative.
 */
export function daysSince(day: number | null, asOf: number): number {
  if (day === null) return CAP;
  return Math.max(0, Math.min(CAP, asOf - day));
}

/**
 * Per-Option recency: the most-recent `eatenOn` for `optionId` dated on or
 * before the `asOf` anchor day, or `null` if the Option has no such Log entry.
 * Entries dated after the anchor are excluded — a Planned dinner after the
 * Selected day must not make its dish look recently eaten *for* the Selected
 * day.
 */
export function lastEaten(
  entries: LogEntry[],
  optionId: string,
  asOf: number,
): number | null {
  let latest: number | null = null;
  for (const entry of entries) {
    if (entry.optionId !== optionId) continue;
    if (entry.eatenOn > asOf) continue;
    if (latest === null || entry.eatenOn > latest) latest = entry.eatenOn;
  }
  return latest;
}

/**
 * Per-Tag recency: the most-recent `eatenOn` across every Option that carries
 * `tag`, dated on or before the `asOf` anchor day, or `null` if no carrier has
 * such a Log entry. Entries dated after the anchor are excluded, exactly as
 * for `lastEaten`.
 */
export function lastTagUse(
  entries: LogEntry[],
  // Only `id` and `tags` are read, so any Option-shaped value works — the AI
  // search snapshot passes its own `SnapshotOption`, which has no url/phone.
  options: { id: string; tags: string[] }[],
  tag: string,
  asOf: number,
): number | null {
  const carriers = new Set(
    options.filter((option) => option.tags.includes(tag)).map((o) => o.id),
  );
  let latest: number | null = null;
  for (const entry of entries) {
    if (!carriers.has(entry.optionId)) continue;
    if (entry.eatenOn > asOf) continue;
    if (latest === null || entry.eatenOn > latest) latest = entry.eatenOn;
  }
  return latest;
}

/**
 * The decay weight of an eat `age` days before the anchor: `0.5 ^ (age /
 * AFFINITY_HALF_LIFE)`. 1.0 for an eat today, halving every half-life. Recency-
 * weighting eat-counts this way is what makes affinity track *current* taste.
 */
function decayWeight(age: number): number {
  return 2 ** (-age / AFFINITY_HALF_LIFE);
}

/**
 * The recency-weighted eat-count for `optionId` on or before `asOf`: the sum of
 * `decayWeight` over the Option's own non-future Log entries. The raw per-Option
 * affinity signal, before normalization.
 */
export function decayedEatCount(
  entries: LogEntry[],
  optionId: string,
  asOf: number,
): number {
  let total = 0;
  for (const entry of entries) {
    if (entry.optionId !== optionId) continue;
    if (entry.eatenOn > asOf) continue;
    total += decayWeight(asOf - entry.eatenOn);
  }
  return total;
}

/**
 * The recency-weighted eat-count for a whole cuisine: the sum of `decayWeight`
 * over every non-future Log entry of any Option carrying `tag`. The raw
 * per-cuisine affinity signal — how much the Household has been into this
 * cuisine lately — before normalization.
 */
export function decayedTagCount(
  entries: LogEntry[],
  options: { id: string; tags: string[] }[],
  tag: string,
  asOf: number,
): number {
  const carriers = new Set(
    options.filter((option) => option.tags.includes(tag)).map((o) => o.id),
  );
  let total = 0;
  for (const entry of entries) {
    if (!carriers.has(entry.optionId)) continue;
    if (entry.eatenOn > asOf) continue;
    total += decayWeight(asOf - entry.eatenOn);
  }
  return total;
}

/**
 * The affinity for every Option in the catalog, keyed by Option id.
 *
 * Affinity is *relative* — an Option's recency-weighted eat-frequency against
 * the catalog average — which is what lets a rarely-eaten dish score *below*
 * average (and so get suppressed) rather than merely un-boosted. Computing it
 * needs the whole catalog, so it is a single catalog-wide pass the per-row loop
 * then reads from.
 *
 * For each Option:
 *   - `optAff` = its own decayed eat-count over the catalog-mean eat-count.
 *   - `catAff` = its cuisine's decayed eat-count over the catalog-mean cuisine
 *     count (mean across the Option's Tags).
 *   - blended `AFFINITY_TAG_WEIGHT` of the way from `optAff` to `catAff`.
 *
 * The blend is where cold-start lives: a never-eaten Option has `optAff = 0`,
 * so its affinity comes entirely from its cuisine — a new Pasta inherits the
 * Household's Pasta affinity. An Option with *no* signal at all — never eaten,
 * and no Tag ever used (or no Tags) — falls back to `NEUTRAL_AFFINITY` so it
 * gets a fair, mid-pack shot instead of a zero.
 */
function computeAffinities(
  options: RankOption[],
  entries: LogEntry[],
  asOf: number,
): Map<string, number> {
  const tagCountCache = new Map<string, number>();
  const tagCount = (tag: string): number => {
    let cached = tagCountCache.get(tag);
    if (cached === undefined) {
      cached = decayedTagCount(entries, options, tag, asOf);
      tagCountCache.set(tag, cached);
    }
    return cached;
  };

  const optFreq = new Map<string, number>();
  const catFreq = new Map<string, number>();
  for (const option of options) {
    const own = decayedEatCount(entries, option.id, asOf);
    optFreq.set(option.id, own);
    // A tagless Option has no cuisine signal; mirror its own count so it still
    // normalizes against the per-Option baseline and never reads as 0/0.
    catFreq.set(
      option.id,
      option.tags.length === 0 ? own : mean(option.tags.map(tagCount)),
    );
  }

  const optBaseline = positiveMean([...optFreq.values()]);
  const catBaseline = positiveMean(
    options
      .filter((option) => option.tags.length > 0)
      .map((option) => catFreq.get(option.id)!),
  );

  const affinities = new Map<string, number>();
  for (const option of options) {
    const own = optFreq.get(option.id)!;
    const cuisine = catFreq.get(option.id)!;
    if (option.tags.length === 0) {
      affinities.set(option.id, own === 0 ? NEUTRAL_AFFINITY : own / optBaseline);
      continue;
    }
    if (own === 0 && cuisine === 0) {
      affinities.set(option.id, NEUTRAL_AFFINITY);
      continue;
    }
    const optAff = own / optBaseline;
    const catAff = cuisine / catBaseline;
    affinities.set(
      option.id,
      (1 - AFFINITY_TAG_WEIGHT) * optAff + AFFINITY_TAG_WEIGHT * catAff,
    );
  }
  return affinities;
}

/**
 * The readiness factor: a blend of per-Option recency (`antiRepeat`) and the
 * mean per-Tag recency (`variety`), both already capped at `CAP`. A tagless
 * Option mirrors its own recency as variety so the two terms stay on the same
 * capped-day unit. `READINESS_TAG_WEIGHT` sets how much cuisine-rotation pulls
 * against the Option's own staleness.
 */
function readinessOf(antiRepeat: number, tagDays: number[]): number {
  const variety = tagDays.length === 0 ? antiRepeat : mean(tagDays);
  return (1 - READINESS_TAG_WEIGHT) * antiRepeat + READINESS_TAG_WEIGHT * variety;
}

/**
 * The per-row recency fields for `rankTonight`, where one Log feeds both the
 * per-Option and per-Tag recency. (`rankOption` computes its own, because the
 * detail page draws per-Option recency from the target's Log and per-Tag recency
 * from the active Catalog's Log — two different sources.)
 */
function recencyFields(
  entries: LogEntry[],
  options: { id: string; tags: string[] }[],
  option: RankOption,
  asOf: number,
): {
  antiRepeat: number;
  tags: TagRecency[];
  readiness: number;
  recencyDays: number;
  neverEaten: boolean;
} {
  const lastEatenDay = lastEaten(entries, option.id, asOf);
  const antiRepeat = daysSince(lastEatenDay, asOf);
  const tags: TagRecency[] = option.tags.map((tag) => {
    const days = daysSince(lastTagUse(entries, options, tag, asOf), asOf);
    return { tag, days, overdue: days >= OVERDUE_THRESHOLD };
  });
  return {
    antiRepeat,
    tags,
    readiness: readinessOf(antiRepeat, tags.map((t) => t.days)),
    recencyDays: antiRepeat,
    neverEaten: lastEatenDay === null,
  };
}

/**
 * Rank the active Catalog into the Tonight list for the `asOf` anchor day:
 * descending by Score (`affinity × readiness`), with an alphabetical tie-break
 * that also gives the cold-start fallback for free — with no Log history every
 * Option's affinity is `NEUTRAL_AFFINITY` and every readiness is `CAP`, so every
 * Score ties and the list is alphabetical. When the anchor is today, this is the
 * standard Tonight render; when it is the Selected day, it is the day-shifted
 * view (ADR-0009).
 */
export function rankTonight(
  options: RankOption[],
  entries: LogEntry[],
  asOf: number,
): TonightRow[] {
  const affinities = computeAffinities(options, entries, asOf);

  const rows = options.map((option): TonightRow => {
    const { tags, readiness, recencyDays, neverEaten } = recencyFields(
      entries,
      options,
      option,
      asOf,
    );
    const affinity = affinities.get(option.id)!;
    return {
      option,
      score: affinity * readiness,
      affinity,
      readiness,
      tags,
      recencyDays,
      neverEaten,
    };
  });

  return rows.sort(
    (a, b) => b.score - a.score || a.option.name.localeCompare(b.option.name),
  );
}

/**
 * The input to `rankOption` — everything the single-Option ranking view needs,
 * with the Active/Archived distinction handled inside the module so no caller
 * has to pre-massage Log entries.
 */
export type RankOptionInput = {
  /** The Option being ranked. */
  target: RankOption;
  /** The active Catalog — the per-Tag Recency and affinity carriers, as `rankTonight` reads them. */
  activeOptions: RankOption[];
  /** The active Catalog's Log entries dated on or before `asOf`. */
  activeLog: LogEntry[];
  /** The `target` Option's own Log entries (per-Option recency always draws on these). */
  targetLog: LogEntry[];
  /** The anchor day, as an epoch-day (see `local-day.ts`). */
  asOf: number;
};

/**
 * Rank one Option in isolation for its detail page (PRD: Option detail page).
 *
 * Per-Option **Recency** and **readiness** always derive from `targetLog` — the
 * `target` Option's own Log history — so an Archived Option still gets factual
 * recency from its own past. Per-Tag recency derives from `activeLog` over
 * `activeOptions`, exactly as `rankTonight` reads it. The **Score** and
 * **affinity** are `null` unless `target` is among `activeOptions`: an Archived
 * Option is excluded from the ranking (and from the affinity normalization),
 * though its factual recency fields are still computed.
 *
 * For an active Option the result is unchanged from a `rankTonight` row over the
 * same inputs — its own entries are present in `activeLog` either way, and the
 * affinity is computed over the same catalog — so the detail page and Tonight
 * never disagree. The caller passes the active Catalog and its Log straight
 * through; the Archived case is handled here, not in the page.
 */
export function rankOption({
  target,
  activeOptions,
  activeLog,
  targetLog,
  asOf,
}: RankOptionInput): OptionRanking {
  // Per-Option recency from the target's own Log — so an Archived Option, absent
  // from `activeLog`, still gets factual recency from its own past.
  const lastEatenDay = lastEaten(targetLog, target.id, asOf);
  const antiRepeat = daysSince(lastEatenDay, asOf);

  // Per-Tag recency from the active Catalog's Log, exactly as `rankTonight` reads
  // it, so an active Option's readiness matches its Tonight row.
  const tags: TagRecency[] = target.tags.map((tag) => {
    const days = daysSince(lastTagUse(activeLog, activeOptions, tag, asOf), asOf);
    return { tag, days, overdue: days >= OVERDUE_THRESHOLD };
  });
  const readiness = readinessOf(antiRepeat, tags.map((t) => t.days));

  const active = activeOptions.some((option) => option.id === target.id);
  const affinity = active
    ? computeAffinities(activeOptions, activeLog, asOf).get(target.id)!
    : null;

  return {
    score: affinity === null ? null : affinity * readiness,
    affinity,
    readiness,
    tags,
    recencyDays: antiRepeat,
    neverEaten: lastEatenDay === null,
  };
}
