"use server";

import { eq } from "drizzle-orm";
import { db } from "../db";
import { dayNotes } from "../db/schema";
import { authedAction } from "../lib/authed-action";
import { type ActionResult, trimToNull } from "../lib/action-result";
import { revalidateDinnerViews } from "./revalidate";

/**
 * Set the **Day note** for a calendar date (PRD: Day notes) — the one write
 * behind the Day note line on both Tonight and the Log, so the control behaves
 * identically wherever it is placed (ADR-0007).
 *
 * The text is trimmed the way a Log entry's Note is (`trimToNull`). Non-empty
 * text upserts on the unique `noted_on`, so saving over a date's note replaces
 * it. Empty or whitespace-only text deletes that date's row — clearing is the
 * delete control, and an absent Day note is an absent row, never `""`.
 */
export const setDayNote = authedAction(
  async (notedOn: string, text: string): Promise<ActionResult> => {
    const note = trimToNull(text);
    if (note === null) {
      await db.delete(dayNotes).where(eq(dayNotes.notedOn, notedOn));
    } else {
      await db
        .insert(dayNotes)
        .values({ notedOn, note })
        .onConflictDoUpdate({ target: dayNotes.notedOn, set: { note } });
    }
    revalidateDinnerViews();
    return { ok: true };
  },
);
