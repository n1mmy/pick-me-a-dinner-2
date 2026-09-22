/**
 * The AI snapshot's read-and-map adapter (ADR-0008) — the one place the three
 * DB reads that feed `buildSnapshot` (`lib/ai-search.ts`) are made and mapped
 * into its input shape.
 *
 * Before this module existed, the assembly was written out three times —
 * `app/api/ai-search/route.ts` (production), `scripts/ai-search-eval.ts`, and
 * `scripts/model-comparison/show-prompt.mjs` — and the two scripts drifted:
 * they read `getTonightData(asOf).logEntries` (non-future only, the
 * deterministic ranking's Log) instead of `getFullLogForSnapshot()` (past
 * entries and Planned dinners alike), so the eval harness and `show-prompt`
 * measured and printed a snapshot production does not send. Concentrating the
 * assembly here means every caller gets the household's near future
 * (ADR-0008) by construction.
 *
 * `asOf` is required and validated by the caller — this module does not read
 * the clock, so a caller with its own notion of "today" (a Selected day, an
 * eval run) passes it explicitly rather than this module defaulting to one.
 */
import {
  getFullLogForSnapshot,
  getRejections,
  getTonightData,
} from "../db/queries";
import { buildSnapshot, type BuiltSnapshot } from "./ai-search";

/** What `snapshotForDay` produces: the built snapshot plus the display map. */
export type SnapshotSource = BuiltSnapshot & {
  /**
   * Maps each candidate Option's real UUID to its Household-facing name — the
   * eval harness and `show-prompt` use this to print a result row by name
   * instead of a raw UUID; production has no use for it (`aiSearchAction`
   * returns UUIDs to the screen, which already holds the names).
   */
  nameById: Map<string, string>;
};

/**
 * Build the AI snapshot for `asOf` — the anchor day (ADR-0009) — and `query`.
 * Owns the three reads `buildSnapshot` needs (the active Catalog and its
 * non-future Log via `getTonightData`, the full Log via
 * `getFullLogForSnapshot`, and `getRejections`), the `SnapshotOption` /
 * `SnapshotLogEntry` mapping, and the `buildSnapshot` call itself.
 *
 * The Log passed to `buildSnapshot` is the **full** Log
 * (`getFullLogForSnapshot`), not `getTonightData`'s non-future `logEntries` —
 * the AI snapshot sees the household's near future (ADR-0008); only the
 * Catalog comes from `getTonightData`.
 */
export async function snapshotForDay({
  asOf,
  query,
}: {
  asOf: string;
  query: string;
}): Promise<SnapshotSource> {
  const [{ options }, logEntries, rejections] = await Promise.all([
    getTonightData(asOf),
    getFullLogForSnapshot(),
    getRejections(),
  ]);

  const { snapshot, idByIndex } = buildSnapshot({
    options: options.map((option) => ({
      id: option.id,
      name: option.name,
      kind: option.kind,
      tags: option.tags,
      notes: option.notes,
      closedDays: option.closedDays,
    })),
    logEntries: logEntries.map((entry) => ({
      optionId: entry.optionId,
      eatenOn: entry.eatenOn,
      note: entry.note,
    })),
    rejections,
    asOf,
    query,
  });

  const nameById = new Map(options.map((option) => [option.id, option.name]));

  return { snapshot, idByIndex, nameById };
}
