"use server";

import {
  getFullLogForSnapshot,
  getRejections,
  getTonightData,
} from "../db/queries";
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
 * Catalog and the full Log — past entries and future-dated ones (Planned
 * dinners) alike — call `lib/ai-search`, and return the validated ordered
 * result. An empty query is a valid trigger.
 *
 * The Log fed to the snapshot comes from `getFullLogForSnapshot`, not from
 * `getTonightData` (whose `logEntries` are filtered to non-future for the
 * deterministic ranking): the AI snapshot sees the Household's near future
 * (ADR-0008). `getTonightData` is still read for the active Catalog `options`.
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
    const [{ options }, logEntries, rejections] = await Promise.all([
      getTonightData(today),
      getFullLogForSnapshot(),
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
