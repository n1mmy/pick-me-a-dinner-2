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

/** An active Catalog Option, with the names of the Tags attached to it. */
export type RankOption = {
  id: string;
  name: string;
  kind: "home" | "restaurant";
  tags: string[];
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
  explanation: string;
  tags: TagRecency[];
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
  options: RankOption[],
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
 * The Explanation chip text, derived deterministically from the Score terms.
 *
 * If the Option has Tags and the Tag term dominates (`W_TAG·variety >=
 * W_OPTION·anti_repeat`, ties included), the chip names the single Tag with the
 * largest recency. Otherwise it names the Option's own recency — and a tagless
 * Option always lands here, since the Tag branch needs at least one Tag. When
 * the Option has never been eaten the chip reads "Never eaten yet" rather than
 * a false "Last had 60 days ago".
 */
export function explanationChip(input: {
  tagDays: { tag: string; days: number }[];
  antiRepeat: number;
  lastEatenIsNull: boolean;
}): string {
  const { tagDays, antiRepeat, lastEatenIsNull } = input;
  const variety =
    tagDays.length === 0
      ? antiRepeat
      : mean(tagDays.map((entry) => entry.days));
  const tagBranch =
    tagDays.length > 0 && W_TAG * variety >= W_OPTION * antiRepeat;

  if (tagBranch) {
    const [top] = [...tagDays].sort(
      (a, b) => b.days - a.days || a.tag.localeCompare(b.tag),
    );
    return `No ${top.tag} in ${top.days} days`;
  }
  if (lastEatenIsNull) return "Never eaten yet";
  return `Last had ${antiRepeat} days ago`;
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
      explanation: explanationChip({
        tagDays: tags.map((entry) => ({ tag: entry.tag, days: entry.days })),
        antiRepeat,
        lastEatenIsNull: lastEatenDay === null,
      }),
      tags,
    };
  });

  return rows.sort(
    (a, b) =>
      b.score - a.score || a.option.name.localeCompare(b.option.name),
  );
}
