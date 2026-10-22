/**
 * Tonight's read of the Selected day's **Prepared note** (ADR-0011): the
 * stored note plus whether it is out of date — whether the date's input has
 * changed since the note was written.
 */
import { getPreparedNote } from "../db/queries";
import type { PreparedRankingRow } from "../db/schema";
import { inputHash } from "./prepared-notes-job";
import { snapshotForDay } from "./snapshot-source";

/** The Prepared note as Tonight shows it. */
export type TonightPreparedNote = {
  brief: string;
  ranking: PreparedRankingRow[];
  preparedAt: Date;
  outOfDate: boolean;
};

/**
 * The note for `day`, or `null` when none has been written. Out of date is
 * the sweep's own staleness test — the date's current snapshot, hashed with
 * `model`, against the hash the note was built from — so the marker shows
 * exactly while the sweep would rewrite the note. A `decided` date's note is
 * frozen, a record rather than advice, so it is never out of date and its
 * snapshot (one full-Log read) is never built.
 */
export async function tonightPreparedNote({
  day,
  decided,
  model,
}: {
  day: string;
  /** Whether `day` has a Log entry. */
  decided: boolean;
  model: string;
}): Promise<TonightPreparedNote | null> {
  const stored = await getPreparedNote(day);
  if (stored === null) return null;
  const note = {
    brief: stored.brief,
    ranking: stored.ranking,
    preparedAt: stored.preparedAt,
  };
  if (decided) return { ...note, outOfDate: false };
  const { snapshot } = await snapshotForDay({ asOf: day, query: "" });
  return { ...note, outOfDate: inputHash(snapshot, model) !== stored.inputHash };
}
