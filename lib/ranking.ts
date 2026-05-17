/**
 * The Tonight ranking engine (plan §7, ADR-0003) — a deep, pure module with no
 * DB or React dependency. It maps the active Catalog, each Option's Tags, the
 * non-future Log entries and "today" to the Tonight list: Options ranked
 * descending by Score, each with an Explanation chip and per-Tag recency.
 *
 * All dates arrive as integer epoch-days (see `local-day.ts`); this module does
 * pure integer arithmetic. Future Log entries (Planned dinners) are excluded by
 * `lastEaten` / `lastTagUse`, so a caller may pass them in harmlessly.
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
   * True when the Option has no non-future Log entry. `recencyDays` caps at
   * `CAP`, so a never-eaten Option and one last eaten 60+ days ago both read
   * `CAP` — this flag lets the Recency chip show "new" instead of "60d+".
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
  /** True when the Option has no non-future Log entry — see `TonightRow`. */
  neverEaten: boolean;
};

/** Arithmetic mean of a non-empty list. */
function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Days from `day` to `today`, capped at `CAP`. A `null` `day` ("never eaten" /
 * "never used") returns `CAP` so it cannot dominate the ranking. A future `day`
 * — which `lastEaten` / `lastTagUse` already exclude — is guarded to 0 so it
 * can never push a Score negative.
 */
export function daysSince(day: number | null, today: number): number {
  if (day === null) return CAP;
  return Math.max(0, Math.min(CAP, today - day));
}

/**
 * Per-Option recency: the most-recent non-future `eatenOn` for `optionId`, or
 * `null` if the Option has no non-future Log entry. Planned dinners (a future
 * `eatenOn`) are excluded — planning Friday must not make Friday's dish look
 * recently eaten today.
 */
export function lastEaten(
  entries: LogEntry[],
  optionId: string,
  today: number,
): number | null {
  let latest: number | null = null;
  for (const entry of entries) {
    if (entry.optionId !== optionId) continue;
    if (entry.eatenOn > today) continue;
    if (latest === null || entry.eatenOn > latest) latest = entry.eatenOn;
  }
  return latest;
}

/**
 * Per-Tag recency: the most-recent non-future `eatenOn` across every Option
 * that currently carries `tag`, or `null` if no carrier has a non-future Log
 * entry. Future entries are excluded, exactly as for `lastEaten`.
 */
export function lastTagUse(
  entries: LogEntry[],
  // Only `id` and `tags` are read, so any Option-shaped value works — the AI
  // search snapshot passes its own `SnapshotOption`, which has no url/phone.
  options: { id: string; tags: string[] }[],
  tag: string,
  today: number,
): number | null {
  const carriers = new Set(
    options.filter((option) => option.tags.includes(tag)).map((o) => o.id),
  );
  let latest: number | null = null;
  for (const entry of entries) {
    if (!carriers.has(entry.optionId)) continue;
    if (entry.eatenOn > today) continue;
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
 * Rank the active Catalog into the Tonight list: descending by Score, with an
 * alphabetical tie-break that also gives the cold-start fallback for free —
 * with no non-future Log history every Score ties, so the list is alphabetical.
 */
export function rankTonight(
  options: RankOption[],
  entries: LogEntry[],
  today: number,
): TonightRow[] {
  const rows = options.map((option): TonightRow => {
    const lastEatenDay = lastEaten(entries, option.id, today);
    const antiRepeat = daysSince(lastEatenDay, today);

    const tags: TagRecency[] = option.tags.map((tag) => {
      const days = daysSince(lastTagUse(entries, options, tag, today), today);
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
 * Rank one Option in isolation for its detail page (PRD: Option detail page).
 * `activeOptions` is the active Catalog — the per-Tag recency carriers, exactly
 * as `rankTonight` reads them — and `entries` the non-future Log entries that
 * feed recency. For an Archived `target` (one not in `activeOptions`) pass its
 * own Log entries in `entries` too, so per-Option recency is still computed
 * from the Option's own history regardless of Active/Archived state.
 *
 * The Score is returned only when `target` is in `activeOptions`: an Archived
 * Option is excluded from the ranking, so its `score` is `null`. Per-Option and
 * per-Tag recency are returned either way — they are factual recency data, not
 * a Score. For an active Option every field equals that Option's `rankTonight`
 * row over the same inputs, since the recency internals are the very same.
 */
export function rankOption(
  target: RankOption,
  activeOptions: RankOption[],
  entries: LogEntry[],
  today: number,
): OptionRanking {
  const lastEatenDay = lastEaten(entries, target.id, today);
  const antiRepeat = daysSince(lastEatenDay, today);

  const tags: TagRecency[] = target.tags.map((tag) => {
    const days = daysSince(
      lastTagUse(entries, activeOptions, tag, today),
      today,
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
