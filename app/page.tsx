import {
  getAllTags,
  getArchivedOptions,
  getTodayRejections,
  getTonightData,
} from "../db/queries";
import { aiSearchEnabled } from "../lib/ai-search";
import { appTimeZone, parseSelectedDay, today } from "../lib/local-day";
import { placesEnabled } from "../lib/places";
import { preparedLabel } from "../lib/prepared-label";
import { preparedNoteFor } from "../lib/prepared-notes";
import { tonightForDay } from "../lib/tonight-day";
import { TonightScreen } from "./tonight-screen";

/**
 * Tonight depends on the Household's current calendar day and on every Log
 * write, so it must never be prerendered — "today" would freeze at build time.
 */
export const dynamic = "force-dynamic";

/**
 * The Tonight page (ADR-0009, amended): ranks for the **Selected day** anchored
 * from `?day=`. With no `?day=` — or any malformed value — the Selected day is
 * today and the screen is exactly v1; with any valid SQL date, past or future,
 * it is that date and the whole screen rotates around it: the deterministic
 * ranked list, the decided **Dinner** block, the live Reject control, and AI
 * search all read the Selected day from the screen and from the URL
 * respectively. A future day plans ahead; a past day edits that night.
 */
export default async function TonightPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string | string[] }>;
}) {
  const { day: rawDay } = await searchParams;
  // "Today" is the Household's calendar day in APP_TZ — not the server's UTC
  // day — so all recency stays in the household's perspective.
  const todaySql = today();
  // The Selected day is parsed at the page boundary so every downstream call
  // works with a validated SQL date — past / malformed / missing → today.
  const selectedDay = parseSelectedDay(rawDay, todaySql);
  const [
    { options, logEntries, todayEntries, dayNote },
    anchorRejections,
    allTags,
    archivedOptions,
  ] = await Promise.all([
    getTonightData(selectedDay),
    getTodayRejections(selectedDay),
    getAllTags(),
    getArchivedOptions(),
  ]);

  // Every Selected-day suppression rule — Picked, Rejected, Closed — the Last
  // note reduction, and the day's names compose inside `tonightForDay`; the
  // page only owns its queries and hands the view to the screen.
  const view = tonightForDay({
    options,
    logEntries,
    dayEntries: todayEntries,
    rejections: anchorRejections,
    selectedDay,
    today: todaySql,
    dayNote,
  });

  // The Selected day's Prepared note (ADR-0011). The `LOCAL_AI_*` variables
  // control generation only: a stored note shows whether or not the local
  // model is configured now. With no note yet, Tonight is as before.
  const stored = await preparedNoteFor({ day: selectedDay, today: todaySql });
  const preparedNote = stored && {
    brief: stored.brief,
    ranking: stored.ranking,
    label: preparedLabel(stored.preparedAt, todaySql, appTimeZone()),
    outOfDate: stored.status === "out-of-date",
  };

  // AI search appears only when `ANTHROPIC_API_KEY` is configured; without it
  // Tonight is exactly v1.
  return (
    <TonightScreen
      view={view}
      searchEnabled={aiSearchEnabled()}
      preparedNote={preparedNote}
      quickAddSources={{
        allTags,
        placesEnabled: placesEnabled(),
        archivedOptions,
      }}
    />
  );
}
