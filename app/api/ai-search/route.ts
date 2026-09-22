import {
  AI_SEARCH_UNAVAILABLE,
  createAiSearchClient,
} from "../../../lib/ai-search";
import { parseSelectedDay, today } from "../../../lib/local-day";
import { snapshotForDay } from "../../../lib/snapshot-source";

/**
 * Run an AI search over Tonight for the **Selected day** (ADR-0009): build the
 * model snapshot from the active Catalog and the full Log — past entries and
 * future-dated ones (Planned dinners) alike — call `lib/ai-search`, and return
 * the validated ordered result. An empty query is a valid trigger.
 *
 * A **Route Handler**, not a Server Action, and deliberately so: every Server
 * Action call — however it's invoked, a `<form action>` or a plain awaited
 * function — is serialized through Next's one client-side action queue
 * (`callServer` → `dispatchAppRouterAction`, `next/dist/client/app-call-server.js`);
 * a second action dispatched while one is already in flight is queued behind
 * it, not sent. AI search runs 50–90s, so as a Server Action it silently
 * blocked every Pick (a Server Action of its own) for that whole span —
 * Cancel didn't help, since Cancel only stopped the *client* from waiting on
 * the result, it never touched the queue. A plain `fetch` to a Route Handler
 * sits outside that queue entirely, so Pick can dispatch the instant it's
 * clicked no matter what AI search is doing.
 *
 * Unlike a Server Action, this route needs no `authedAction`-style guard of
 * its own: `middleware.ts` already redirects an unauthenticated request away
 * from every path but `/login` and `/api/ready`, and (unlike a Server Action,
 * which always POSTs to whatever page is current, `/login` included —
 * `lib/require-session.ts`) this route has no path the gate exempts. Review
 * fix F1's concern — an anonymous caller reaching the billed Anthropic API —
 * is closed by the same middleware every other page already relies on.
 *
 * The Log fed to the snapshot comes from `getFullLogForSnapshot`, not from
 * `getTonightData` (whose `logEntries` are filtered to non-future for the
 * deterministic ranking): the AI snapshot sees the Household's near future
 * (ADR-0008), and that includes entries dated after the Selected day too —
 * picking for Friday should not blind the model to Sunday's already-planned
 * pizza.
 */
export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json(AI_SEARCH_UNAVAILABLE);

  // The body crosses an untyped network boundary — unlike a Server Action's
  // call signature, nothing here is checked by the compiler, so it is
  // validated defensively rather than trusted.
  const body = (await request.json().catch(() => null)) as {
    query?: unknown;
    selectedDay?: unknown;
  } | null;
  const query = typeof body?.query === "string" ? body.query : "";
  const selectedDay =
    typeof body?.selectedDay === "string" ? body.selectedDay : undefined;

  // Validated to a real SQL date server-side; an invalid or missing value
  // falls back to today (past or future Selected days are both honoured).
  const asOf = parseSelectedDay(selectedDay, today());

  const { snapshot, idByIndex } = await snapshotForDay({ asOf, query });

  // `buildSnapshot` has already dropped Selected-day-rejected Options from
  // the snapshot's candidate `options`; `idByIndex` covers only those
  // candidates, so a rejected Option cannot be resurfaced as a result either
  // — it stays absent from AI search for the Selected day (PRD: Rejections
  // on Tonight).
  const result = await createAiSearchClient(apiKey).search(
    snapshot,
    idByIndex,
  );
  return Response.json(result);
}
