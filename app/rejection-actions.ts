"use server";

import { authedAction } from "../lib/authed-action";
import type { ActionResult } from "../lib/action-result";
import {
  addRejection,
  editRejection,
  type RejectionOutcome,
  removeRejection,
} from "../lib/day-decisions";
import { isValidSqlDate, parseSelectedDay, today } from "../lib/local-day";
import { pgErrorMessage } from "../lib/pg-error";
import { revalidateDinnerViews } from "./revalidate";

/**
 * The Rejection actions — the by-hand `createRejection` / `updateRejection` /
 * `deleteRejection` and the live-Tonight `rejectOption`. The writes, and the
 * **Day decision** rule they keep (`CONTEXT.md`: a Pick wins), live in
 * `lib/day-decisions.ts`; these actions add the session check, date parsing,
 * the inline messages, and revalidation.
 */

/**
 * Run a Rejection write and report it inline: a Rejection of an Option already
 * Picked that date is refused, a `(option_id, rejected_on)` `23505` collision
 * is the same Option already rejected for that date, and a malformed or stale
 * Option id (`22P02` / `23503`) is an Option that no longer exists. Any other
 * driver error rethrows, surfacing as a 500.
 */
async function saveRejection(
  write: () => Promise<RejectionOutcome>,
): Promise<ActionResult> {
  let outcome: RejectionOutcome;
  try {
    outcome = await write();
  } catch (error) {
    return pgErrorMessage(error, {
      duplicate: "Already rejected for that date",
      missingOption: "That option is no longer available",
    });
  }
  if (outcome === "already-picked") {
    return {
      ok: false,
      error: "Already picked for that date — remove the Pick first",
    };
  }
  revalidateDinnerViews();
  return { ok: true };
}

/**
 * Create a dated Rejection (PRD: Dated Rejections — adding a dated Rejection)
 * for a deliberately chosen date — a past date backfills a Rejection never
 * recorded live, today's date records one from the Log, a future date is a
 * Planned rejection that suppresses its Option from Tonight when that day
 * arrives. An empty or whitespace-only reason is stored as `null`; an invalid
 * date is rejected inline.
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
    return saveRejection(() => addRejection({ optionId, rejectedOn, reason }));
  },
);

/**
 * Edit a Rejection in place: change its Option, its date, or its reason (PRD:
 * Dated Rejections — editing and deleting Rejections). Same validation and
 * messages as `createRejection` — a change that collides with an existing
 * `(option_id, rejected_on)` row is rejected inline, never silently merged
 * into the other Rejection.
 */
export const updateRejection = authedAction(
  async (
    id: string,
    values: { optionId: string; rejectedOn: string; reason: string },
  ): Promise<ActionResult> => {
    if (!isValidSqlDate(values.rejectedOn)) {
      return { ok: false, error: "Pick a valid date" };
    }
    return saveRejection(() => editRejection(id, values));
  },
);

/**
 * Delete a Rejection by id (PRD: Dated Rejections — editing and deleting
 * Rejections). The row is removed entirely — so it stops feeding AI search
 * (ADR-0006: a deleted Rejection never teaches the model anything). This is
 * also the action behind Tonight's "Bring back" affordance: bringing back a
 * Rejection the Household made today is the same row delete, so there is one
 * shared action rather than a duplicate. Returns an `ActionResult` so a
 * write failure (e.g. a double-tap race against an already-deleted row) is
 * reported inline rather than silently swallowed, mirroring `deleteLogEntry`.
 */
export const deleteRejection = authedAction(
  async (id: string): Promise<ActionResult> => {
    try {
      await removeRejection(id);
    } catch {
      return { ok: false, error: "Couldn't delete that — try again" };
    }
    revalidateDinnerViews();
    return { ok: true };
  },
);

/**
 * Reject an Option for the Selected day's decision (PRD: Rejections on
 * Tonight) — the live-Tonight Reject affordance, also wired into the Option
 * detail page's controls. It is "create a Rejection dated on the Selected
 * day": the date is the Tonight screen's **Selected day** (ADR-0009, amended),
 * defaulting to today and any SQL date the Household stepped to, past or
 * future. Same messages as `createRejection`.
 *
 * Callers that have no Selected day to pass — the Option detail page — call
 * this without `selectedDay` and reject for today. The value is validated
 * defensively to a real SQL date; any valid date is honoured (past or future,
 * ADR-0009 amended), a malformed/missing one falls back to today.
 *
 * A Rejection is not a Log entry and carries no Score weight; suppression is a
 * presentation filter the Tonight page applies, never a ranking change
 * (ADR-0003, ADR-0006).
 */
export const rejectOption = authedAction(
  async (
    optionId: string,
    reason: string,
    selectedDay?: string,
  ): Promise<ActionResult> => {
    const rejectedOn = parseSelectedDay(selectedDay, today());
    return saveRejection(() => addRejection({ optionId, rejectedOn, reason }));
  },
);
