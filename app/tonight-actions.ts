"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "../db";
import { rejections } from "../db/schema";
import { getRejections, getTonightData } from "../db/queries";
import {
  AI_SEARCH_UNAVAILABLE,
  buildSnapshot,
  createAiSearchClient,
  type AiSearchResult,
} from "../lib/ai-search";
import { authedAction } from "../lib/authed-action";
import { todaySqlDate } from "../lib/local-day";

/**
 * Run an AI search over Tonight: build the model snapshot from the active
 * Catalog and the non-future Log, call `lib/ai-search`, and return the
 * validated ordered result. An empty query is a valid trigger.
 *
 * `authedAction`-wrapped (review fix F1): a Server Action is reachable by id
 * from any route, so without the wrapper an anonymous caller could drive the
 * billed Anthropic API. Thin by design — the snapshot, prompt, and parsing all
 * live in `lib/ai-search`. When `ANTHROPIC_API_KEY` is unset the action
 * returns the typed "unavailable" rather than calling out.
 */
export const aiSearchAction = authedAction(
  async (query: string): Promise<AiSearchResult> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return AI_SEARCH_UNAVAILABLE;

    const today = todaySqlDate(new Date(), process.env.APP_TZ ?? "UTC");
    const [{ options, logEntries }, rejections] = await Promise.all([
      getTonightData(today),
      getRejections(),
    ]);

    const snapshot = buildSnapshot({
      options: options.map((option) => ({
        id: option.id,
        name: option.name,
        kind: option.kind,
        tags: option.tags,
        notes: option.notes,
      })),
      logEntries: logEntries.map((entry) => ({
        optionId: entry.optionId,
        eatenOn: entry.eatenOn,
        note: entry.note,
      })),
      rejections,
      today,
      query,
    });

    // `buildSnapshot` has already dropped today's-rejected Options from the
    // snapshot's candidate `options`; deriving `activeIds` from those leaves a
    // rejected Option out of the result set too, so it stays absent from AI
    // search for the rest of the day (PRD: Rejections on Tonight).
    const activeIds = new Set(snapshot.options.map((option) => option.id));
    return createAiSearchClient(apiKey).search(snapshot, activeIds);
  },
);

/**
 * Reject an Option for tonight's decision (PRD: Rejections on Tonight). Inserts
 * a `rejections` row dated the Household's calendar day in `APP_TZ`, with the
 * optional short reason — an empty or whitespace-only reason is stored as
 * `null` — then revalidates Tonight so the Option drops out of the picker on
 * the next render.
 *
 * `authedAction`-wrapped: a Server Action is reachable by id from any route, so
 * the shared-password session check is not optional. Thin by design — it does
 * the write and nothing else, mirroring `pickTonight`. A Rejection is not a Log
 * entry and carries no Score weight; suppression is a presentation filter the
 * Tonight page applies, never a ranking change (ADR-0003, ADR-0006).
 */
export const rejectOption = authedAction(
  async (optionId: string, reason: string): Promise<void> => {
    const today = todaySqlDate(new Date(), process.env.APP_TZ ?? "UTC");
    const trimmed = reason.trim();
    await db.insert(rejections).values({
      optionId,
      reason: trimmed.length === 0 ? null : trimmed,
      rejectedOn: today,
    });
    revalidatePath("/");
  },
);

/**
 * Bring back a Rejection the Household made today (PRD: Rejections on Tonight,
 * the "Bring back" action). Deletes the `rejections` row by id, then
 * revalidates Tonight so the Option returns to the picker on the next render.
 *
 * `authedAction`-wrapped: a Server Action is reachable by id from any route, so
 * the shared-password session check is not optional. Deleting the row outright
 * — rather than expiring it — is the point: the Rejection is gone entirely, so
 * a mis-tapped Rejection never reaches AI search and never teaches the model
 * anything (ADR-0006). Thin by design — it does the delete and nothing else,
 * mirroring `rejectOption` and `pickTonight`.
 */
export const bringBackRejection = authedAction(
  async (rejectionId: string): Promise<void> => {
    await db.delete(rejections).where(eq(rejections.id, rejectionId));
    revalidatePath("/");
  },
);
