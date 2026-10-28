"use server";

import { authedAction } from "../../lib/authed-action";
import {
  addPick,
  editLogEntry,
  removeLogEntry,
} from "../../lib/day-decisions";
import { isValidSqlDate, parseSelectedDay, today } from "../../lib/local-day";
import type { ActionResult } from "../../lib/action-result";
import { pgErrorMessage } from "../../lib/pg-error";
import { revalidateDinnerViews } from "../revalidate";

/**
 * The writes, and the **Day decision** rule they keep, live in
 * `lib/day-decisions.ts`; these actions add the session check, date parsing,
 * the inline messages, and revalidation.
 */

/**
 * Pick tonight: log the Option for the Selected day — `pick = log`. An
 * accidental double-tap is a harmless no-op. Picking a *different* Option the
 * same evening is a separate row — a multi-Option Dinner. A same-date
 * Rejection of the Option is removed (`CONTEXT.md`: **Day decision**).
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
    const eatenOn = parseSelectedDay(selectedDay, today());
    try {
      await addPick({ optionId, eatenOn, repeat: "ignore" });
    } catch {
      return { ok: false, error: "Couldn't log that — try again" };
    }
    revalidateDinnerViews();
    return { ok: true };
  },
);

/**
 * Log an Option for a deliberately chosen date — a past date backfills a
 * forgotten dinner, a future date plans one (a Planned dinner, excluded from the
 * Tonight ranking until its date arrives). Unlike the one-tap `pickTonight`, a
 * date the Option is already logged for is a real mistake here — the user typed
 * it — so the `(option_id, eaten_on)` collision is reported inline rather than
 * silently swallowed, and any Rejection is left in place.
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
      await addPick({ optionId, eatenOn, note, repeat: "refuse" });
    } catch (error) {
      return pgErrorMessage(error, {
        duplicate: "Already logged for that date",
        missingOption: "That option is no longer available",
      });
    }
    revalidateDinnerViews();
    return { ok: true };
  },
);

/**
 * Edit a Log entry in place: change its Option, its date, or its note. A change
 * that collides with an existing `(option_id, eaten_on)` row is rejected with
 * an inline error — never silently merged into the other entry. Moving it onto
 * a Rejected (Option, date) removes that Rejection.
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
      await editLogEntry(id, values);
    } catch (error) {
      return pgErrorMessage(error, {
        duplicate: "Already logged for that date",
        missingOption: "That option is no longer available",
      });
    }
    revalidateDinnerViews();
    return { ok: true };
  },
);

/**
 * Delete a Log entry — a plan that didn't happen, or a pick not actually
 * eaten. Returns an `ActionResult` so a write failure (e.g. a double-tap race
 * against an already-deleted entry) is reported, never silently swallowed —
 * notably Tonight's decided-row "Remove" control, which surfaces
 * `{ ok: false }` inline the way the other delete affordances already do.
 */
export const deleteLogEntry = authedAction(
  async (id: string): Promise<ActionResult> => {
    try {
      await removeLogEntry(id);
    } catch {
      return { ok: false, error: "Couldn't remove that — try again" };
    }
    revalidateDinnerViews();
    return { ok: true };
  },
);
