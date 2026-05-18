"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { rejections } from "../../db/schema";
import { authedAction } from "../../lib/authed-action";
import { isValidSqlDate } from "../../lib/local-day";
import { pgErrorCode } from "../../lib/pg-error";

/** A Rejection mutation either succeeds or carries a message to show inline. */
export type RejectionActionResult = { ok: true } | { ok: false; error: string };

/** Trim a free-text field, storing `null` rather than an empty string. */
function trimToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Revalidate every screen a Rejection write changes: Tonight's suppression (a
 * Rejection dated today drops its Option from the picker), the Log (which now
 * renders that date's Rejections), and the Option detail page's Rejections
 * section — a Rejection edited or deleted from the detail page must refresh in
 * place there too (PRD: Dated Rejections — Option detail page parity).
 */
function revalidateRejectionViews(): void {
  revalidatePath("/");
  revalidatePath("/log");
  revalidatePath("/catalog/[id]", "page");
}

/** Map an expected Postgres driver error to its inline message, or rethrow. */
function rejectionWriteError(error: unknown): RejectionActionResult {
  const code = pgErrorCode(error);
  if (code === "23505") {
    return { ok: false, error: "Already rejected for that date" };
  }
  // 22P02 invalid uuid / 23503 FK violation — a malformed or stale Option.
  if (code === "22P02" || code === "23503") {
    return { ok: false, error: "That option is no longer available" };
  }
  throw error;
}

/**
 * Create a dated Rejection (PRD: Dated Rejections — adding a dated Rejection).
 * Inserts a `rejections` row for a deliberately chosen date — a past date
 * backfills a Rejection never recorded live, today's date records one from the
 * Log, a future date is a Planned rejection that suppresses its Option from
 * Tonight when that day arrives. An empty or whitespace-only reason is stored
 * as `null`; an invalid date is rejected inline. A `(option_id, rejected_on)`
 * collision (`23505`) is the same Option already rejected for that date, and a
 * malformed or stale Option id (`22P02` / `23503`) are both reported inline
 * rather than thrown — mirroring `logForDate`.
 *
 * `authedAction`-wrapped: a Server Action is reachable by id from any route, so
 * the shared-password session check is not optional. Thin by design — it does
 * the write and nothing else, consistent with `logForDate`.
 */
export const createRejection = authedAction(
  async (
    optionId: string,
    rejectedOn: string,
    reason: string,
  ): Promise<RejectionActionResult> => {
    if (!isValidSqlDate(rejectedOn)) {
      return { ok: false, error: "Pick a valid date" };
    }
    try {
      await db
        .insert(rejections)
        .values({ optionId, rejectedOn, reason: trimToNull(reason) });
    } catch (error) {
      return rejectionWriteError(error);
    }
    revalidateRejectionViews();
    return { ok: true };
  },
);

/**
 * Edit a Rejection in place: change its Option, its date, or its reason (PRD:
 * Dated Rejections — editing and deleting Rejections). Same validation and
 * collision handling as `createRejection` — a change that collides with an
 * existing `(option_id, rejected_on)` row is rejected with an inline error,
 * never silently merged into the other Rejection.
 */
export const updateRejection = authedAction(
  async (
    id: string,
    values: { optionId: string; rejectedOn: string; reason: string },
  ): Promise<RejectionActionResult> => {
    if (!isValidSqlDate(values.rejectedOn)) {
      return { ok: false, error: "Pick a valid date" };
    }
    try {
      await db
        .update(rejections)
        .set({
          optionId: values.optionId,
          rejectedOn: values.rejectedOn,
          reason: trimToNull(values.reason),
        })
        .where(eq(rejections.id, id));
    } catch (error) {
      return rejectionWriteError(error);
    }
    revalidateRejectionViews();
    return { ok: true };
  },
);

/**
 * Delete a Rejection by id (PRD: Dated Rejections — editing and deleting
 * Rejections). The row is removed entirely — so it stops feeding AI search
 * (ADR-0006: a deleted Rejection never teaches the model anything). Thin by
 * design, mirroring `deleteLogEntry`.
 */
export const deleteRejection = authedAction(
  async (id: string): Promise<void> => {
    await db.delete(rejections).where(eq(rejections.id, id));
    revalidateRejectionViews();
  },
);
