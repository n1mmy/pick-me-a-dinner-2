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
import type { Suppression } from "./day-suppressions";
import type { TonightRow } from "./ranking";

/**
 * One typeahead candidate: an `OptionChoice` plus why it is off Tonight's
 * ranked list, if at all (issue 02). `"none"` is not a `Suppression` — the
 * suppressed/unsuppressed split lives one level up from `day-suppressions`'
 * map, which only ever carries a reason, never "none".
 */
export type TonightChoice = OptionChoice & { suppression: Suppression | "none" };

/**
 * Whether Tonight's typeahead dropdown should append its trailing `Add
 * "<query>"…` row (issue 03): the trimmed query is non-empty and no
 * candidate — every active Option, whatever its suppression (issue 02's
 * widened `choices`) — has that exact name, case-insensitive. An Option that
 * matches exactly (any case, any suppression) already has a row to pick, so
 * the Add row would just offer a confusing duplicate.
 */
export function showAddRow(choices: TonightChoice[], query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return false;
  return !choices.some((choice) => choice.name.toLowerCase() === needle);
}

function toChoice(row: TonightRow, suppression: Suppression | "none"): TonightChoice {
  return {
    id: row.option.id,
    name: row.option.name,
    kind: row.option.kind,
    suppression,
  };
}

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
 * `rankOf` is built from the unfiltered `rows` so a filtered row keeps its
 * true rank (#4, #7, ...) rather than being renumbered. `choices` widens past
 * `rows` to every active Option (issue 02): the picker rows plus whatever the
 * caller passes in `suppressed` — the Options Closed, Rejected, or Picked for
 * the Selected day — each carrying why it is off the list, so the typeahead
 * can show and still let the Household reach an Option the ranked list is
 * currently hiding, rather than reporting it has no match.
 */
export function pickerView(
  rows: TonightRow[],
  kind: KindFilter,
  tagFilters: TagFilters,
  suppressed: {
    closed: TonightRow[];
    rejected: TonightRow[];
    picked: TonightRow[];
  } = { closed: [], rejected: [], picked: [] },
): {
  visible: TonightRow[];
  rankOf: Map<string, number>;
  choices: TonightChoice[];
  tags: string[];
  hint: string;
} {
  return {
    visible: filterTonightRows(rows, kind, tagFilters),
    rankOf: new Map(rows.map((row, index) => [row.option.id, index + 1])),
    choices: [
      ...rows.map((row) => toChoice(row, "none")),
      ...suppressed.closed.map((row) => toChoice(row, "closed")),
      ...suppressed.rejected.map((row) => toChoice(row, "rejected")),
      ...suppressed.picked.map((row) => toChoice(row, "picked")),
    ].sort((a, b) => a.name.localeCompare(b.name)),
    tags: distinctTags(rows),
    hint: filterHint(kind, tagFilters),
  };
}
