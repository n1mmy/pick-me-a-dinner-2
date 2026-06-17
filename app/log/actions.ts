"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { dinnerLog } from "../../db/schema";
import { authedAction } from "../../lib/authed-action";
import { isValidSqlDate, today } from "../../lib/local-day";
import type { ActionResult } from "../../lib/action-result";
import { trimToNull } from "../../lib/action-result";
import { pgErrorMessage } from "../../lib/pg-error";

/**
 * Revalidate every screen a Log write changes: Tonight's ranking, the Log, and
 * the Option detail page's History section — a Log entry edited or deleted
 * from the detail page must refresh in place there too (PRD: Option detail
 * page — controls behave identically wherever invoked).
 */
function revalidateLogViews(): void {
  revalidatePath("/");
  revalidatePath("/log");
  revalidatePath("/catalog/[id]", "page");
}

/**
 * Pick tonight: log the Option for the Selected day — `pick = log`. The insert
 * upserts on `(option_id, eaten_on)` via `onConflictDoNothing`, so an
 * accidental double-tap is a harmless no-op. Picking a *different* Option the
 * same evening is a separate row — a multi-Option Dinner.
 *
 * `selectedDay` is the Tonight screen's **Selected day** (ADR-0009, amended),
 * defaulting to today on the standard render and any SQL date the Household
 * stepped to — future to plan ahead, past to backfill that night's dinner.
 * Callers that have no Selected day to pass (the Catalog and Log `PickButton`)
 * call this without it and pick for today; the Tonight rows pass the screen's
 * current Selected day. The value is validated to a real SQL date defensively —
 * a malformed or hand-edited request falls back to today.
 *
 * Returns an `ActionResult` so a write failure (e.g. the Option was deleted
 * out from under the row) is reported, never flashed as a false "Logged ✓" —
 * the optimistic success label depends on `ok` (review fix F4).
 */
export const pickTonight = authedAction(
  async (optionId: string, selectedDay?: string): Promise<ActionResult> => {
    const todaySql = today();
    const eatenOn =
      typeof selectedDay === "string" && isValidSqlDate(selectedDay)
        ? selectedDay
        : todaySql;
    try {
      await db
        .insert(dinnerLog)
        .values({ optionId, eatenOn })
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
  ): Promise<ActionResult> => {
    if (!isValidSqlDate(eatenOn)) {
      return { ok: false, error: "Pick a valid date" };
    }
    try {
      await db
        .insert(dinnerLog)
        .values({ optionId, eatenOn, note: trimToNull(note ?? "") });
    } catch (error) {
      return pgErrorMessage(error, {
        duplicate: "Already logged for that date",
        missingOption: "That option is no longer available",
      });
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
  ): Promise<ActionResult> => {
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
      return pgErrorMessage(error, {
        duplicate: "Already logged for that date",
        missingOption: "That option is no longer available",
      });
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
