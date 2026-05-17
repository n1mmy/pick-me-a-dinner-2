"use server";

import { getTonightData } from "../db/queries";
import {
  AI_SEARCH_UNAVAILABLE,
  buildSnapshot,
  createAiSearchClient,
  type AiSearchResult,
} from "../lib/ai-search";
import { authedAction } from "../lib/authed-action";
import { epochDayFromSqlDate, todaySqlDate } from "../lib/local-day";

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
    const { options, logEntries } = await getTonightData(today);
    const todayEpochDay = epochDayFromSqlDate(today);

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
        eatenOn: epochDayFromSqlDate(entry.eatenOn),
        note: entry.note,
      })),
      today: todayEpochDay,
      query,
    });

    const activeIds = new Set(options.map((option) => option.id));
    return createAiSearchClient(apiKey).search(snapshot, activeIds);
  },
);
