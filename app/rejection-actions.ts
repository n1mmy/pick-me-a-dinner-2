"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { rejections } from "../db/schema";
import { authedAction } from "../lib/authed-action";
import { type ActionResult, trimToNull } from "../lib/action-result";
import { isValidSqlDate, todaySqlDate } from "../lib/local-day";
import { pgErrorMessage } from "../lib/pg-error";

/**
 * Every write to the `rejections` table lives in this one module — the
 * by-hand `createRejection` / `updateRejection` / `deleteRejection` and the
 * live-Tonight `rejectOption` alike. Keeping them together is the point: the
 * `(option_id, rejected_on)` collision (`23505`, ADR-0008's unique
 * constraint) is handled in exactly one place, so a copy of the insert can
 * never drift out of sync and skip it again.
 */

/**
 * Revalidate every screen a Rejection write changes: Tonight's suppression (a
 * Rejection dated today drops its Option from the picker), the Log (which now
 * renders that date's Rejections), and the Option detail page's Rejections
 * section — a Rejection edited or deleted from the detail page must refresh in
 * place there too (PRD: Dated Rejections — Option detail page parity). Every
 * Rejection write goes through here, so the three screens never disagree.
 */
function revalidateRejectionViews(): void {
  revalidatePath("/");
  revalidatePath("/log");
  revalidatePath("/catalog/[id]", "page");
}

/**
 * Translate an *expected* Postgres driver error from a Rejection write into an
 * inline message: a `(option_id, rejected_on)` `23505` collision is the same
 * Option already rejected for that date, and a malformed or stale Option id
 * (`22P02` / `23503`) is an Option that no longer exists. Anything else
 * rethrows, surfacing as a 500.
 */
function rejectionWriteError(error: unknown): { ok: false; error: string } {
  return pgErrorMessage(error, {
    duplicate: "Already rejected for that date",
    missingOption: "That option is no longer available",
  });
}

/**
 * The shared insert behind every "create a Rejection" path — the by-hand
 * `createRejection` and the live-Tonight `rejectOption` both run through here,
 * so both inherit the `23505` collision handling. Inserts a `rejections` row
 * for `optionId` dated `rejectedOn`, storing an empty or whitespace-only
 * reason as `null`, then revalidates the three Rejection views. A driver error
 * is mapped to an inline message; the date is assumed already validated by the
 * caller.
 */
async function recordRejection(
  optionId: string,
  rejectedOn: string,
  reason: string,
): Promise<ActionResult> {
  try {
    await db
      .insert(rejections)
      .values({ optionId, rejectedOn, reason: trimToNull(reason) });
  } catch (error) {
    return rejectionWriteError(error);
  }
  revalidateRejectionViews();
  return { ok: true };
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
 * the shared-password session check is not optional. Thin by design — it
 * validates the date and delegates the write to `recordRejection`.
 */
export const createRejection = authedAction(
  async (
    optionId: string,
    rejectedOn: string,
    reason: string,
  ): Promise<ActionResult> => {
    if (!isValidSqlDate(rejectedOn)) {
      return { ok: false, error: "Pick a valid date" };
    }
    return recordRejection(optionId, rejectedOn, reason);
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
  ): Promise<ActionResult> => {
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
 * (ADR-0006: a deleted Rejection never teaches the model anything). This is
 * also the action behind Tonight's "Bring back" affordance: bringing back a
 * Rejection the Household made today is the same row delete, so there is one
 * shared action rather than a duplicate. Thin by design, mirroring
 * `deleteLogEntry`.
 */
export const deleteRejection = authedAction(
  async (id: string): Promise<void> => {
    await db.delete(rejections).where(eq(rejections.id, id));
    revalidateRejectionViews();
  },
);

/**
 * Reject an Option for tonight's decision (PRD: Rejections on Tonight) — the
 * live-Tonight Reject affordance, also wired into the Option detail page's
 * controls. It is just "create a Rejection dated today": the Household's
 * calendar day in `APP_TZ` is computed here and the write delegates to the
 * shared `recordRejection` core, so the today-dated insert inherits the
 * `23505` collision handling. Tapping Reject when a today-dated Rejection for
 * the Option already exists (or a double-tap race) therefore returns an inline
 * `{ ok: false }` "Already rejected for that date" instead of an uncaught 500.
 *
 * `authedAction`-wrapped: a Server Action is reachable by id from any route, so
 * the shared-password session check is not optional. A Rejection is not a Log
 * entry and carries no Score weight; suppression is a presentation filter the
 * Tonight page applies, never a ranking change (ADR-0003, ADR-0006).
 */
export const rejectOption = authedAction(
  async (optionId: string, reason: string): Promise<ActionResult> => {
    const today = todaySqlDate(new Date(), process.env.APP_TZ ?? "UTC");
    return recordRejection(optionId, today, reason);
  },
);
