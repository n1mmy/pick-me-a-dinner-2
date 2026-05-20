/**
 * The Tonight ranking engine (plan §7, ADR-0003) — a deep, pure module with no
 * DB or React dependency. It maps the active Catalog, each Option's Tags, the
 * Log entries (any date) and a single **anchor day** to the Tonight list:
 * Options ranked descending by Score, each with an Explanation chip and per-Tag
 * recency.
 *
 * The anchor day defaults to today on the standard Tonight render, but the
 * caller may pass any other day — the **Selected day** the Household stepped
 * to (ADR-0009). The math is the same either way: Log entries dated after the
 * anchor are excluded by `lastEaten` / `lastTagUse`, so a caller may pass them
 * in harmlessly, and recency is `anchor - lastEaten`. Planning a future Selected
 * day's dinner therefore re-anchors the ranking to that day; Planned dinners
 * between today and the Selected day count toward that day's recency.
 *
 * All dates arrive as integer epoch-days (see `local-day.ts`); this module does
 * pure integer arithmetic.
 */
import { CAP, OVERDUE_THRESHOLD, W_OPTION, W_TAG } from "./ranking.config";

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
  score: number;
  tags: TagRecency[];
  /**
   * Per-Option recency in days, capped at `CAP` (the `anti_repeat` term). Drives
   * the Recency chip's text and heatmap fill; the ranking math itself reads it
   * via `optionScore`, not this field.
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
 * Score / per-Option recency / Tag fields a `TonightRow` carries, computed for
 * one Option in isolation. For an active Option it equals that Option's
 * `rankTonight` row over the same inputs, so the detail page and Tonight never
 * disagree; for an Archived Option `score` is `null` — it takes no part in the
 * ranking — while the factual recency fields are still computed.
 */
export type OptionRanking = {
  /** The Score, or `null` for an Archived Option (excluded from ranking). */
  score: number | null;
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
 * Days from `day` to the `asOf` anchor day, capped at `CAP`. A `null` `day`
 * ("never eaten" / "never used") returns `CAP` so it cannot dominate the
 * ranking. A `day` after `asOf` — which `lastEaten` / `lastTagUse` already
 * exclude — is guarded to 0 so it can never push a Score negative.
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
 * The Score for one Option: `W_OPTION·anti_repeat + W_TAG·variety`. `variety`
 * is the mean of the Tag recencies for a tagged Option, and mirrors
 * `anti_repeat` for a tagless one so both terms stay on the same capped-day
 * unit.
 */
export function optionScore(antiRepeat: number, tagDays: number[]): number {
  const variety = tagDays.length === 0 ? antiRepeat : mean(tagDays);
  return W_OPTION * antiRepeat + W_TAG * variety;
}

/**
 * Rank the active Catalog into the Tonight list for the `asOf` anchor day:
 * descending by Score, with an alphabetical tie-break that also gives the
 * cold-start fallback for free — with no Log history on or before the anchor
 * every Score ties, so the list is alphabetical. When the anchor is today,
 * this is the standard Tonight render; when it is the Selected day, it is the
 * day-shifted view (ADR-0009).
 */
export function rankTonight(
  options: RankOption[],
  entries: LogEntry[],
  asOf: number,
): TonightRow[] {
  const rows = options.map((option): TonightRow => {
    const lastEatenDay = lastEaten(entries, option.id, asOf);
    const antiRepeat = daysSince(lastEatenDay, asOf);

    const tags: TagRecency[] = option.tags.map((tag) => {
      const days = daysSince(lastTagUse(entries, options, tag, asOf), asOf);
      return { tag, days, overdue: days >= OVERDUE_THRESHOLD };
    });

    const tagDays = tags.map((entry) => entry.days);
    return {
      option,
      score: optionScore(antiRepeat, tagDays),
      tags,
      recencyDays: antiRepeat,
      neverEaten: lastEatenDay === null,
    };
  });

  return rows.sort(
    (a, b) =>
      b.score - a.score || a.option.name.localeCompare(b.option.name),
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
  /** The active Catalog — the per-Tag Recency carriers, as `rankTonight` reads them. */
  activeOptions: RankOption[];
  /** The active Catalog's Log entries dated on or before `asOf` (per-Tag recency draws on these). */
  activeLog: LogEntry[];
  /** The `target` Option's own Log entries (per-Option recency always draws on these). */
  targetLog: LogEntry[];
  /** The anchor day, as an epoch-day (see `local-day.ts`). */
  asOf: number;
};

/**
 * Rank one Option in isolation for its detail page (PRD: Option detail page).
 *
 * Per-Option **Recency** always derives from `targetLog` — the `target`
 * Option's own Log history — so an Archived Option still gets factual recency
 * from its own past. Per-Tag recency derives from `activeLog` over
 * `activeOptions`, exactly as `rankTonight` reads it. The **Score** is `null`
 * unless `target` is among `activeOptions`: an Archived Option is excluded from
 * the ranking, though its factual recency fields are still computed.
 *
 * For an active Option the result is unchanged from a `rankTonight` row over
 * the same inputs — its own entries are present in `activeLog` either way, and
 * `targetLog` is just its own history — so the detail page and Tonight never
 * disagree. The caller passes the active Catalog and its Log straight through;
 * the Archived case is handled here, not in the page.
 */
export function rankOption({
  target,
  activeOptions,
  activeLog,
  targetLog,
  asOf,
}: RankOptionInput): OptionRanking {
  const lastEatenDay = lastEaten(targetLog, target.id, asOf);
  const antiRepeat = daysSince(lastEatenDay, asOf);

  const tags: TagRecency[] = target.tags.map((tag) => {
    const days = daysSince(
      lastTagUse(activeLog, activeOptions, tag, asOf),
      asOf,
    );
    return { tag, days, overdue: days >= OVERDUE_THRESHOLD };
  });

  const active = activeOptions.some((option) => option.id === target.id);
  return {
    score: active ? optionScore(antiRepeat, tags.map((t) => t.days)) : null,
    tags,
    recencyDays: antiRepeat,
    neverEaten: lastEatenDay === null,
  };
}
