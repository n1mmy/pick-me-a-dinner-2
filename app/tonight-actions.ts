"use server";

import {
  AI_SEARCH_UNAVAILABLE,
  createAiSearchClient,
  type AiSearchResult,
} from "../lib/ai-search";
import { authedAction } from "../lib/authed-action";
import { parseSelectedDay, today } from "../lib/local-day";
import { snapshotForDay } from "../lib/snapshot-source";

/**
 * Run an AI search over Tonight for the **Selected day** (ADR-0009): build the
 * model snapshot from the active Catalog and the full Log — past entries and
 * future-dated ones (Planned dinners) alike — call `lib/ai-search`, and return
 * the validated ordered result. An empty query is a valid trigger.
 *
 * The Selected day defaults to today on the standard render and may be any
 * date the Household stepped to, past or future (ADR-0009, amended). It is
 * validated to a real SQL date server-side; an invalid or missing value falls
 * back to today.
 *
 * The Log fed to the snapshot comes from `getFullLogForSnapshot`, not from
 * `getTonightData` (whose `logEntries` are filtered to non-future for the
 * deterministic ranking): the AI snapshot sees the Household's near future
 * (ADR-0008), and that includes entries dated after the Selected day too —
 * picking for Friday should not blind the model to Sunday's already-planned
 * pizza.
 *
 * `authedAction`-wrapped (review fix F1): a Server Action is reachable by id
 * from any route, so without the wrapper an anonymous caller could drive the
 * billed Anthropic API. Thin by design — the snapshot, prompt, and parsing all
 * live in `lib/ai-search`. When `ANTHROPIC_API_KEY` is unset the action
 * returns the typed "unavailable" rather than calling out.
 */
export const aiSearchAction = authedAction(
  async (query: string, selectedDay?: string): Promise<AiSearchResult> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return AI_SEARCH_UNAVAILABLE;

    // Validate the Selected day defensively: a Server Action is reachable from
    // any caller, so a hand-edited request could carry a malformed date. Any
    // real SQL date is honoured (past or future); only a malformed/missing
    // value falls back to today.
    const asOf = parseSelectedDay(selectedDay, today());

    const { snapshot, idByIndex } = await snapshotForDay({ asOf, query });

    // `buildSnapshot` has already dropped Selected-day-rejected Options from
    // the snapshot's candidate `options`; `idByIndex` covers only those
    // candidates, so a rejected Option cannot be resurfaced as a result either
    // — it stays absent from AI search for the Selected day (PRD: Rejections
    // on Tonight).
    return createAiSearchClient(apiKey).search(snapshot, idByIndex);
  },
);
