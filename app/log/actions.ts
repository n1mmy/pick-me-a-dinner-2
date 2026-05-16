"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { dinnerLog } from "../../db/schema";
import { authedAction } from "../../lib/authed-action";
import { isValidSqlDate, todaySqlDate } from "../../lib/local-day";
import { pgErrorCode } from "../../lib/pg-error";

/** A Log mutation either succeeds or carries a message to show inline. */
export type LogActionResult = { ok: true } | { ok: false; error: string };

/** Trim a free-text field, storing `null` rather than an empty string. */
function trimToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** The Household's calendar day in `APP_TZ` — the date a Pick is logged on. */
function today(): string {
  return todaySqlDate(new Date(), process.env.APP_TZ ?? "UTC");
}

/** Revalidate the two screens a Log write changes: Tonight's ranking and the Log. */
function revalidateLogViews(): void {
  revalidatePath("/");
  revalidatePath("/log");
}

/**
 * Pick tonight: log the Option for today — `pick = log`. The insert upserts on
 * `(option_id, eaten_on)` via `onConflictDoNothing`, so an accidental
 * double-tap is a harmless no-op. Picking a *different* Option the same evening
 * is a separate row — a multi-Option Dinner.
 *
 * Returns a `LogActionResult` so a write failure (e.g. the Option was deleted
 * out from under the row) is reported, never flashed as a false "Logged ✓" —
 * the optimistic success label depends on `ok` (review fix F4).
 */
export const pickTonight = authedAction(
  async (optionId: string): Promise<LogActionResult> => {
    try {
      await db
        .insert(dinnerLog)
        .values({ optionId, eatenOn: today() })
        .onConflictDoNothing();
    } catch {
      return { ok: false, error: "Couldn't log that — try again" };
    }
    revalidateLogViews();
    return { ok: true };
  },
);

/**
 * Log an Option for a deliberately chosen date — a past date backfills a
 * forgotten dinner, a future date plans one (a Planned dinner, excluded from the
 * Tonight ranking until its date arrives). Unlike the one-tap `pickTonight`, a
 * date the Option is already logged for is a real mistake here — the user typed
 * it — so the `(option_id, eaten_on)` collision is reported inline rather than
 * silently swallowed.
 */
export const logForDate = authedAction(
  async (
    optionId: string,
    eatenOn: string,
    note?: string,
  ): Promise<LogActionResult> => {
    if (!isValidSqlDate(eatenOn)) {
      return { ok: false, error: "Pick a valid date" };
    }
    try {
      await db
        .insert(dinnerLog)
        .values({ optionId, eatenOn, note: trimToNull(note ?? "") });
    } catch (error) {
      const code = pgErrorCode(error);
      if (code === "23505") {
        return { ok: false, error: "Already logged for that date" };
      }
      // 22P02 invalid uuid / 23503 FK violation — a malformed or stale Option.
      if (code === "22P02" || code === "23503") {
        return { ok: false, error: "That option is no longer available" };
      }
      throw error;
    }
    revalidateLogViews();
    return { ok: true };
  },
);

/**
 * Edit a Log entry in place: change its Option, its date, or its note. A change
 * that collides with an existing `(option_id, eaten_on)` row is rejected with
 * an inline error — never silently merged into the other entry.
 */
export const updateLogEntry = authedAction(
  async (
    id: string,
    values: { optionId: string; eatenOn: string; note: string },
  ): Promise<LogActionResult> => {
    if (!isValidSqlDate(values.eatenOn)) {
      return { ok: false, error: "Pick a valid date" };
    }
    try {
      await db
        .update(dinnerLog)
        .set({
          optionId: values.optionId,
          eatenOn: values.eatenOn,
          note: trimToNull(values.note),
        })
        .where(eq(dinnerLog.id, id));
    } catch (error) {
      const code = pgErrorCode(error);
      if (code === "23505") {
        return { ok: false, error: "Already logged for that date" };
      }
      // 22P02 invalid uuid / 23503 FK violation — a malformed or stale Option.
      if (code === "22P02" || code === "23503") {
        return { ok: false, error: "That option is no longer available" };
      }
      throw error;
    }
    revalidateLogViews();
    return { ok: true };
  },
);

/** Delete a Log entry — a plan that didn't happen, or a pick not actually eaten. */
export const deleteLogEntry = authedAction(async (id: string): Promise<void> => {
  await db.delete(dinnerLog).where(eq(dinnerLog.id, id));
  revalidateLogViews();
});
