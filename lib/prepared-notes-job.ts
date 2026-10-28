/**
 * The Prepared notes sweep (ADR-0011): keeps each eligible date's Prepared
 * note current by regenerating it whenever its input changes, coordinating
 * with the other replica only through the per-date claim on its row.
 */

import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { getFullLogForSnapshot, getPreparedNote } from "../db/queries";
import { preparedNotes } from "../db/schema";
import type { ModelSnapshot } from "./ai-search";
import { shiftSqlDate, todaySqlDate } from "./local-day";
import {
  PREPARED_PROMPT_VERSION,
  type PreparedNote,
  type PreparedNoteClient,
} from "./prepared-note";
import { snapshotForDay } from "./snapshot-source";

/** How far ahead notes are written: today through today+6. */
const DAYS_AHEAD = 6;

/**
 * The dates the sweep writes notes for, today first: today through six days
 * ahead in `timeZone`, minus every date with a Log entry. Skipping a decided
 * date is what freezes its note; removing the Pick makes it eligible again.
 * Past dates never appear.
 */
export function eligibleDays(
  now: Date,
  timeZone: string,
  decidedDates: readonly string[],
): string[] {
  const today = todaySqlDate(now, timeZone);
  const decided = new Set(decidedDates);
  const days: string[] = [];
  for (let offset = 0; offset <= DAYS_AHEAD; offset++) {
    const day = shiftSqlDate(today, offset);
    if (!decided.has(day)) days.push(day);
  }
  return days;
}

/**
 * The fingerprint of everything a note is built from: the date's AI snapshot,
 * the model, and the prompt version. A stored note whose hash differs is
 * stale. Any Pick, Rejection, Day note, Note, or Catalog edit reaches the
 * snapshot, so this one comparison is the only change detection there is.
 * `promptVersion` is overridable only so a test can vary it.
 */
export function inputHash(
  snapshot: ModelSnapshot,
  model: string,
  promptVersion: string = PREPARED_PROMPT_VERSION,
): string {
  // One JSON array, so no two different inputs can concatenate to the same text.
  return createHash("sha256")
    .update(JSON.stringify([promptVersion, model, snapshot]))
    .digest("hex");
}

/**
 * How long a claim holds a date. Longer than the client's 40-minute timeout,
 * so a replica that is still generating never loses the date to the other.
 */
const CLAIM_LEASE = sql`now() + interval '45 minutes'`;

/** A won claim, carrying the hash of the note already stored, if any. */
export type Claim = { inputHash: string | null };

/**
 * Take the per-date claim in one statement: insert the row with a lease, or
 * renew an existing row's lease only if it has none or it has run out. `null`
 * means another replica holds the date — skip it.
 */
export async function claimDay(date: string): Promise<Claim | null> {
  const [row] = await db
    .insert(preparedNotes)
    .values({ preparedFor: date, claimedUntil: CLAIM_LEASE })
    .onConflictDoUpdate({
      target: preparedNotes.preparedFor,
      set: { claimedUntil: CLAIM_LEASE },
      setWhere: sql`${preparedNotes.claimedUntil} is null or ${preparedNotes.claimedUntil} < now()`,
    })
    .returning({ inputHash: preparedNotes.inputHash });
  return row ?? null;
}

/**
 * Write a freshly generated note over the date's previous one and clear the
 * claim. Only the latest version is kept.
 */
export async function storeNote(
  date: string,
  {
    note,
    inputHash,
    model,
  }: { note: PreparedNote; inputHash: string; model: string },
): Promise<void> {
  await db
    .update(preparedNotes)
    .set({
      brief: note.brief,
      ranking: note.ranking,
      inputHash,
      model,
      preparedAt: sql`now()`,
      claimedUntil: null,
    })
    .where(eq(preparedNotes.preparedFor, date));
}

/**
 * Clear the date's claim and nothing else, after a failed or skipped
 * generation: the last good note stays.
 */
export async function releaseClaim(date: string): Promise<void> {
  await db
    .update(preparedNotes)
    .set({ claimedUntil: null })
    .where(eq(preparedNotes.preparedFor, date));
}

/**
 * One pass over the eligible dates, one at a time, today first: build each
 * date's snapshot, claim it, generate, and store the note.
 */
export async function runSweep({
  now,
  timeZone,
  client,
  model,
}: {
  now: Date;
  timeZone: string;
  client: PreparedNoteClient;
  model: string;
}): Promise<void> {
  const decidedDates = (await getFullLogForSnapshot()).map(
    (entry) => entry.eatenOn,
  );
  for (const day of eligibleDays(now, timeZone, decidedDates)) {
    const { snapshot, idByIndex } = await snapshotForDay({ asOf: day, query: "" });
    const hash = inputHash(snapshot, model);
    if ((await getPreparedNote(day))?.inputHash === hash) continue;

    const claim = await claimDay(day);
    if (claim === null) continue;
    // The other replica may have written this exact note between the read
    // above and the claim.
    if (claim.inputHash === hash) {
      await releaseClaim(day);
      continue;
    }

    const result = await client.prepare(snapshot, idByIndex);
    if (result.ok) {
      await storeNote(day, { note: result.note, inputHash: hash, model });
    } else {
      // No retry: the next pass tries again, and the last good note stays.
      await releaseClaim(day);
    }
  }
}
