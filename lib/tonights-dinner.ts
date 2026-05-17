/**
 * Tonight's-dinner module — a deep, pure split of the Tonight screen into its
 * two modes (PRD: Tonight — decided mode). No DB, no React: given the ranked
 * Tonight rows and today's Log entries it decides what has been Picked and what
 * is still pickable.
 *
 * The Tonight screen keys its mode off the result: an empty `tonightsDinner` is
 * picker mode, a non-empty one is decided mode. Because the input is only
 * *today's* Log entries, a new calendar day naturally empties `tonightsDinner`
 * and the screen falls back to picker mode with no extra day-boundary logic.
 */
import type { TonightRow } from "./ranking";

/**
 * A `dinner_log` row dated today, narrowed to what the decided view needs.
 * `createdAt` gives the pick order; `id` is the handle the decided row's
 * "Remove" deletes (issue 03).
 */
export type TodayLogEntry = {
  id: string;
  optionId: string;
  /** Row creation time — the Pick's wall-clock instant. */
  createdAt: Date;
};

/** One Option in Tonight's dinner: its Tonight row plus its Log entry id. */
export type TonightsDinnerEntry = {
  /** The today Log entry's id — the handle "Remove" deletes (issue 03). */
  entryId: string;
  row: TonightRow;
};

/** The Tonight screen split into its decided block and its picker list. */
export type SplitTonight = {
  /** The Picked Options, in pick order — oldest `createdAt` first. */
  tonightsDinner: TonightsDinnerEntry[];
  /** The ranked rows with every already-Picked Option removed. */
  picker: TonightRow[];
};

/**
 * Split the Tonight screen given the ranked rows and today's Log entries.
 *
 * `tonightsDinner` is the Picked Options ordered by pick order, oldest first,
 * so a multi-Option Dinner reads as how the evening came together and never
 * reshuffles when another Option is added. `picker` is the ranked rows minus
 * every Picked Option, so the picker only ever offers what is not yet Picked.
 *
 * A today Log entry whose Option is not in the ranked set — e.g. the Option was
 * Archived after it was Picked — has no row to render; it is skipped without
 * error rather than crashing the screen.
 */
export function splitTonight(
  rankedRows: TonightRow[],
  todayEntries: TodayLogEntry[],
): SplitTonight {
  const rowByOptionId = new Map(
    rankedRows.map((row) => [row.option.id, row]),
  );

  const ordered = [...todayEntries].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );

  const tonightsDinner: TonightsDinnerEntry[] = [];
  const pickedOptionIds = new Set<string>();
  for (const entry of ordered) {
    const row = rowByOptionId.get(entry.optionId);
    if (!row) continue;
    pickedOptionIds.add(entry.optionId);
    tonightsDinner.push({ entryId: entry.id, row });
  }

  const picker = rankedRows.filter(
    (row) => !pickedOptionIds.has(row.option.id),
  );

  return { tonightsDinner, picker };
}
