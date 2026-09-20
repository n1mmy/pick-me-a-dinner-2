/**
 * The Picker's view model (plan §9) — a pure module with no DB or React
 * dependency, so it is directly unit-testable. `pickerView` is the seam: it
 * takes the ranked Tonight list plus the active filter state and produces
 * everything the Picker renders — the filtered rows, each Option's true
 * rank, the typeahead's candidates, the chip row's Tags, and the hint line.
 *
 * The filter itself is the AND of a kind segment (All / Home / Restaurant)
 * and a set of tri-state Tag chips: a row shows only if it satisfies the
 * kind segment AND carries every "include" Tag AND carries none of the
 * "exclude" Tags.
 */
import type { OptionChoice } from "../db/queries";
import type { TonightRow } from "./ranking";

/** A tag filter chip's state. Cycles off → include → exclude → off. */
export type ChipState = "off" | "include" | "exclude";

/** The kind segment's selection: All, Home meals only, or Restaurants only. */
export type KindFilter = "all" | "home" | "restaurant";

/** A map from Tag name to its chip state; an absent Tag is treated as "off". */
export type TagFilters = Record<string, ChipState>;

/** The tri-state cycle for a tag filter chip: off → include → exclude → off. */
export function cycleChipState(state: ChipState): ChipState {
  if (state === "off") return "include";
  if (state === "include") return "exclude";
  return "off";
}

/** The chip's state restated for its accessible name ("pasta, included"). */
export function chipStateLabel(state: ChipState): string {
  if (state === "include") return "included";
  if (state === "exclude") return "excluded";
  return "not filtered";
}

/**
 * Split the tag filters into the alphabetically-sorted lists of "include" and
 * "exclude" Tags, dropping any left at "off". Sorting keeps the hint and the
 * filter predicate deterministic regardless of tap order.
 */
function partition(tagFilters: TagFilters): {
  include: string[];
  exclude: string[];
} {
  const include: string[] = [];
  const exclude: string[] = [];
  for (const tag of Object.keys(tagFilters).sort((a, b) =>
    a.localeCompare(b),
  )) {
    if (tagFilters[tag] === "include") include.push(tag);
    else if (tagFilters[tag] === "exclude") exclude.push(tag);
  }
  return { include, exclude };
}

/**
 * The Tonight filter predicate: a row shows only if it satisfies the kind
 * segment AND carries every "include" Tag AND carries none of the "exclude"
 * Tags. The kind segment and all tag filters AND together.
 */
function filterTonightRows(
  rows: TonightRow[],
  kind: KindFilter,
  tagFilters: TagFilters,
): TonightRow[] {
  const { include, exclude } = partition(tagFilters);
  return rows.filter((row) => {
    if (kind !== "all" && row.option.kind !== kind) return false;
    const optionTags = row.option.tags;
    if (!include.every((tag) => optionTags.includes(tag))) return false;
    if (exclude.some((tag) => optionTags.includes(tag))) return false;
    return true;
  });
}

/** Every distinct Tag carried by the ranked rows, case-insensitively sorted. */
function distinctTags(rows: TonightRow[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    for (const tag of row.option.tags) seen.add(tag);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

/**
 * The active filter restated in words for the hint line under the chips —
 * e.g. "Showing Home meals with pasta, without fish".
 */
function filterHint(kind: KindFilter, tagFilters: TagFilters): string {
  const { include, exclude } = partition(tagFilters);
  const noun =
    kind === "home"
      ? "Home meals"
      : kind === "restaurant"
        ? "Restaurants"
        : "all Options";
  const clauses: string[] = [];
  if (include.length > 0) clauses.push(`with ${include.join(", ")}`);
  if (exclude.length > 0) clauses.push(`without ${exclude.join(", ")}`);
  return clauses.length > 0
    ? `Showing ${noun} ${clauses.join(", ")}`
    : `Showing ${noun}`;
}

/**
 * The Picker's view model: everything the Picker renders, derived from the
 * ranked (unfiltered) rows and the active filter state.
 *
 * `rankOf` and `choices` are built from the unfiltered `rows` so a filtered
 * row keeps its true rank (#4, #7, ...) rather than being renumbered, and the
 * typeahead's candidates mirror the picker's suppression exactly — a
 * typeahead pick can never hit an already-Picked or Selected-day-rejected
 * Option.
 */
export function pickerView(
  rows: TonightRow[],
  kind: KindFilter,
  tagFilters: TagFilters,
): {
  visible: TonightRow[];
  rankOf: Map<string, number>;
  choices: OptionChoice[];
  tags: string[];
  hint: string;
} {
  return {
    visible: filterTonightRows(rows, kind, tagFilters),
    rankOf: new Map(rows.map((row, index) => [row.option.id, index + 1])),
    choices: rows
      .map((row) => ({
        id: row.option.id,
        name: row.option.name,
        kind: row.option.kind,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    tags: distinctTags(rows),
    hint: filterHint(kind, tagFilters),
  };
}
