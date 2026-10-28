import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { dinnerLog, rejections } from "../db/schema";
import { trimToNull } from "./action-result";

/**
 * Every write to `dinner_log` and `rejections` — Picks, Log entry edits, and
 * Rejections — so the **Day decision** rule (`CONTEXT.md`) holds in one place:
 * an Option has a Pick or a Rejection on a date, never both, and a Pick wins.
 *
 * - A Pick removes the same Option's Rejection on that date, whether it is a
 *   new Pick or a Log entry edited onto that (Option, date).
 * - A Rejection of an Option already Picked on that date is refused
 *   (`"already-picked"`), whether it is new or edited onto that date.
 *
 * Each write runs in its own transaction. Postgres errors — a duplicate
 * `(option_id, date)`, a stale Option id — throw, for the caller to translate
 * (`lib/pg-error.ts`); a throw leaves both tables as they were.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** A Pick supersedes that date's Rejection of the same Option. */
async function deleteRejectionOf(
  tx: Tx,
  optionId: string,
  date: string,
): Promise<void> {
  await tx
    .delete(rejections)
    .where(and(eq(rejections.optionId, optionId), eq(rejections.rejectedOn, date)));
}

/**
 * Pick an Option for a date. `repeat` says what an Option already Picked that
 * date means: `"ignore"` for a one-tap Pick (a double-tap is a no-op, and a
 * lingering Rejection is still cleared), `"refuse"` for a typed date (the
 * duplicate throws, and nothing changes).
 */
export async function addPick({
  optionId,
  eatenOn,
  note = "",
  repeat,
}: {
  optionId: string;
  eatenOn: string;
  note?: string;
  repeat: "ignore" | "refuse";
}): Promise<void> {
  await db.transaction(async (tx) => {
    const insert = tx
      .insert(dinnerLog)
      .values({ optionId, eatenOn, note: trimToNull(note) });
    await (repeat === "ignore" ? insert.onConflictDoNothing() : insert);
    await deleteRejectionOf(tx, optionId, eatenOn);
  });
}

/** Change a Log entry's Option, date, or note. An id that no longer exists is a no-op. */
export async function editLogEntry(
  id: string,
  values: { optionId: string; eatenOn: string; note: string },
): Promise<void> {
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(dinnerLog)
      .set({
        optionId: values.optionId,
        eatenOn: values.eatenOn,
        note: trimToNull(values.note),
      })
      .where(eq(dinnerLog.id, id))
      .returning({ id: dinnerLog.id });
    if (updated.length > 0) {
      await deleteRejectionOf(tx, values.optionId, values.eatenOn);
    }
  });
}

export async function removeLogEntry(id: string): Promise<void> {
  await db.delete(dinnerLog).where(eq(dinnerLog.id, id));
}

export type RejectionOutcome = "saved" | "already-picked";

async function isPicked(tx: Tx, optionId: string, date: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: dinnerLog.id })
    .from(dinnerLog)
    .where(and(eq(dinnerLog.optionId, optionId), eq(dinnerLog.eatenOn, date)))
    .limit(1);
  return row !== undefined;
}

/** Reject an Option for a date, unless it is already Picked that date. */
export async function addRejection({
  optionId,
  rejectedOn,
  reason,
}: {
  optionId: string;
  rejectedOn: string;
  reason: string;
}): Promise<RejectionOutcome> {
  return db.transaction(async (tx) => {
    if (await isPicked(tx, optionId, rejectedOn)) return "already-picked";
    await tx
      .insert(rejections)
      .values({ optionId, rejectedOn, reason: trimToNull(reason) });
    return "saved";
  });
}

/**
 * Change a Rejection's Option, date, or reason, unless that would put it on a
 * date the Option is Picked. An id that no longer exists is a no-op.
 */
export async function editRejection(
  id: string,
  values: { optionId: string; rejectedOn: string; reason: string },
): Promise<RejectionOutcome> {
  return db.transaction(async (tx) => {
    if (await isPicked(tx, values.optionId, values.rejectedOn)) {
      return "already-picked";
    }
    await tx
      .update(rejections)
      .set({
        optionId: values.optionId,
        rejectedOn: values.rejectedOn,
        reason: trimToNull(values.reason),
      })
      .where(eq(rejections.id, id));
    return "saved";
  });
}

export async function removeRejection(id: string): Promise<void> {
  await db.delete(rejections).where(eq(rejections.id, id));
}
