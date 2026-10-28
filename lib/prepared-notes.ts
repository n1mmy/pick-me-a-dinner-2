/**
 * **Prepared notes** (ADR-0011): the one module that knows whether a date's
 * note is current, out of date, or frozen. Two entry points — the sweep, which
 * keeps each eligible date's note current by regenerating it whenever its
 * input changes, and Tonight's read of a date's note. The sweep coordinates
 * with the other replica only through the per-date claim on its row.
 */

import { createHash } from "node:crypto";
import { and, eq, notExists, sql } from "drizzle-orm";
import { db } from "../db";
import { getDecidedDates, getPreparedNote } from "../db/queries";
import { dinnerLog, preparedNotes } from "../db/schema";
import type { AiRankingRow } from "./ai-search";
import { shiftSqlDate, todaySqlDate } from "./local-day";
import {
  localModel,
  PREPARED_PROMPT_VERSION,
  type PreparedNote,
  type PreparedNoteClient,
  REQUEST_TIMEOUT_MS,
} from "./prepared-note";
import { type ModelSnapshot, snapshotForDay } from "./snapshot";

/** How far ahead notes are written: today through today+6. */
const DAYS_AHEAD = 6;

/**
 * The dates the sweep writes notes for, today first: today through six days
 * ahead in `timeZone`, minus every decided date. A date's note **freezes**
 * once it is decided or has passed — skipping it is all freezing takes, and
 * removing the Pick makes it eligible again. Past dates never appear.
 */
async function eligibleDays(now: Date, timeZone: string): Promise<string[]> {
  const today = todaySqlDate(now, timeZone);
  const window = Array.from({ length: DAYS_AHEAD + 1 }, (_, offset) =>
    shiftSqlDate(today, offset),
  );
  const decided = new Set(await getDecidedDates(today, window[DAYS_AHEAD]));
  return window.filter((day) => !decided.has(day));
}

/**
 * The fingerprint of everything a note is built from: the date's AI snapshot,
 * the model, and the prompt version. A stored note whose hash differs is
 * stale. Any Pick, Rejection, Day note, Note, or Catalog edit reaches the
 * snapshot, so this one comparison is the only change detection there is.
 */
function inputHash(snapshot: ModelSnapshot, model: string): string {
  // One JSON array, so no two different inputs can concatenate to the same text.
  return createHash("sha256")
    .update(JSON.stringify([PREPARED_PROMPT_VERSION, model, snapshot]))
    .digest("hex");
}

/**
 * How long a claim holds a date: the client's timeout plus five minutes, so a
 * replica that is still generating never loses the date to the other.
 */
export const CLAIM_LEASE_MS = REQUEST_TIMEOUT_MS + 5 * 60_000;

// A constant number, so the raw interval carries no outside text.
const CLAIM_LEASE = sql.raw(`now() + interval '${CLAIM_LEASE_MS} milliseconds'`);

/** A won claim, carrying the hash of the note already stored, if any. */
export type Claim = { inputHash: string | null };

/**
 * Take the per-date claim in one statement: insert the row with a lease, or
 * renew an existing row's lease only if it has none or it has run out. `null`
 * means another replica holds the date — skip it. Exported for the tests that
 * stand in for the other replica; the sweep is its only production caller.
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
 * claim — but only while the date is still undecided: a Pick that landed
 * during the generation has frozen the note already stored, and the claim is
 * released either way. Only the latest version is kept.
 */
async function storeNote(
  date: string,
  {
    note,
    inputHash,
    model,
  }: { note: PreparedNote; inputHash: string; model: string },
): Promise<void> {
  const stored = await db
    .update(preparedNotes)
    .set({
      brief: note.brief,
      ranking: note.ranking,
      inputHash,
      model,
      preparedAt: sql`now()`,
      claimedUntil: null,
    })
    .where(
      and(
        eq(preparedNotes.preparedFor, date),
        notExists(
          db
            .select({ one: sql`1` })
            .from(dinnerLog)
            .where(eq(dinnerLog.eatenOn, date)),
        ),
      ),
    )
    .returning({ preparedFor: preparedNotes.preparedFor });
  if (stored.length === 0) await releaseClaim(date);
}

/**
 * Clear the date's claim and nothing else, after a failed or skipped
 * generation: the last good note stays.
 */
async function releaseClaim(date: string): Promise<void> {
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
}: {
  now: Date;
  timeZone: string;
  client: PreparedNoteClient;
}): Promise<void> {
  const model = localModel();
  for (const day of await eligibleDays(now, timeZone)) {
    // The eligible dates were read once, and a generation takes minutes: a
    // Pick landing meanwhile has frozen this date, so don't generate a note
    // the store would only refuse.
    if ((await getDecidedDates(day, day)).length > 0) continue;
    const built = await snapshotForDay({ asOf: day, query: "" });
    // Nothing to rank (an empty Catalog, or every Option Closed or Rejected):
    // the model's empty ranking is always refused, so the date would be
    // regenerated every sweep.
    if (built.idByIndex.size === 0) continue;
    const hash = inputHash(built.snapshot, model);
    if ((await getPreparedNote(day))?.inputHash === hash) continue;

    const claim = await claimDay(day);
    if (claim === null) continue;
    // The other replica may have written this exact note between the read
    // above and the claim.
    if (claim.inputHash === hash) {
      await releaseClaim(day);
      continue;
    }

    const result = await client.prepare(built);
    if (result.ok) {
      await storeNote(day, { note: result.note, inputHash: hash, model });
    } else {
      // No retry: the next pass tries again, and the last good note stays.
      await releaseClaim(day);
    }
  }
}

/**
 * Where a stored note stands: `current` matches the date's input, `out-of-date`
 * doesn't and the sweep will rewrite it, `frozen` is a record the sweep no
 * longer touches.
 */
export type PreparedNoteStatus = "current" | "out-of-date" | "frozen";

/** The Prepared note as Tonight shows it. */
export type TonightPreparedNote = {
  brief: string;
  ranking: AiRankingRow[];
  preparedAt: Date;
  status: PreparedNoteStatus;
};

/**
 * Tonight's read of `day`'s note, or `null` when none has been written.
 * `today` is the Household's calendar day. Out of date is the sweep's own
 * staleness test — the date's current snapshot hashed against the hash the
 * note was built from — so the marker shows exactly while the sweep would
 * rewrite the note. A frozen note is a record rather than advice: never out of
 * date, and its snapshot (one full-Log read) is never built.
 */
export async function preparedNoteFor({
  day,
  today,
}: {
  day: string;
  today: string;
}): Promise<TonightPreparedNote | null> {
  const stored = await getPreparedNote(day);
  if (stored === null) return null;
  const note = {
    brief: stored.brief,
    ranking: stored.ranking,
    preparedAt: stored.preparedAt,
  };
  if (day < today || (await getDecidedDates(day, day)).length > 0) {
    return { ...note, status: "frozen" };
  }
  const { snapshot } = await snapshotForDay({ asOf: day, query: "" });
  return {
    ...note,
    status:
      inputHash(snapshot, localModel()) === stored.inputHash
        ? "current"
        : "out-of-date",
  };
}
