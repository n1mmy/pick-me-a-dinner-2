"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { dinnerLog } from "../../db/schema";
import { todaySqlDate } from "../../lib/local-day";

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

/**
 * A second row for the same `(option_id, eaten_on)` violates the table's UNIQUE
 * constraint, which Postgres reports as SQLSTATE 23505.
 */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
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
 */
export async function pickTonight(optionId: string): Promise<void> {
  await db
    .insert(dinnerLog)
    .values({ optionId, eatenOn: today() })
    .onConflictDoNothing();
  revalidateLogViews();
}

/**
 * Log an Option for an arbitrary date — a past date backfills a forgotten
 * dinner, a future date plans one (a Planned dinner, excluded from the Tonight
 * ranking until its date arrives). Like `pickTonight`, a repeat of an existing
 * `(option_id, eaten_on)` is a no-op.
 */
export async function logForDate(
  optionId: string,
  eatenOn: string,
): Promise<void> {
  await db
    .insert(dinnerLog)
    .values({ optionId, eatenOn })
    .onConflictDoNothing();
  revalidateLogViews();
}

/**
 * Edit a Log entry in place: change its Option, its date, or its note. A change
 * that collides with an existing `(option_id, eaten_on)` row is rejected with
 * an inline error — never silently merged into the other entry.
 */
export async function updateLogEntry(
  id: string,
  values: { optionId: string; eatenOn: string; note: string },
): Promise<LogActionResult> {
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
    if (isUniqueViolation(error)) {
      return { ok: false, error: "Already logged for that date" };
    }
    throw error;
  }
  revalidateLogViews();
  return { ok: true };
}

/** Delete a Log entry — a plan that didn't happen, or a pick not actually eaten. */
export async function deleteLogEntry(id: string): Promise<void> {
  await db.delete(dinnerLog).where(eq(dinnerLog.id, id));
  revalidateLogViews();
}
