import type { AiSearchResult } from "../lib/ai-search";

/**
 * The client-side call behind Tonight's AI search — a plain `fetch` to
 * `app/api/ai-search/route.ts`, not a Server Action. See that route's doc
 * comment for why: every Server Action shares Next's one client-side action
 * queue, so a Pick fired while an AI search was in flight silently queued
 * behind it — even after Cancel, since Cancel only stops the client from
 * waiting on the result. A plain fetch sits outside that queue, so Pick's own
 * Server Action can still dispatch immediately. A network failure (not a
 * modeled "unavailable" from the route itself) collapses to the same typed
 * `{ ok: false }` every other AI search failure mode already does.
 */
export async function aiSearchAction(
  query: string,
  selectedDay?: string,
): Promise<AiSearchResult> {
  try {
    const response = await fetch("/api/ai-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, selectedDay }),
    });
    if (!response.ok) return { ok: false };
    return (await response.json()) as AiSearchResult;
  } catch {
    return { ok: false };
  }
}
