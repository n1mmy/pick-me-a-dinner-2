import { getTodayRejections, getTonightData } from "../db/queries";
import { aiSearchEnabled } from "../lib/ai-search";
import {
  epochDayFromSqlDate,
  parseSelectedDay,
  today,
} from "../lib/local-day";
import { rankTonight } from "../lib/ranking";
import { splitTonight } from "../lib/tonights-dinner";
import { TonightScreen } from "./tonight-screen";

/**
 * Tonight depends on the Household's current calendar day and on every Log
 * write, so it must never be prerendered — "today" would freeze at build time.
 */
export const dynamic = "force-dynamic";

/**
 * The Tonight page (ADR-0009): ranks for the **Selected day** anchored from
 * `?day=`. With no `?day=` — or any malformed / past value — the Selected day
 * is today and the screen is exactly v1; with a future SQL date it is that
 * date and the whole screen rotates around it: the deterministic ranked list,
 * the decided **Dinner** block, the live Reject control, and AI search all
 * read the Selected day from the screen and from the URL respectively.
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
  const [{ options, logEntries, todayEntries }, anchorRejections] =
    await Promise.all([
      getTonightData(selectedDay),
      getTodayRejections(selectedDay),
    ]);

  const anchorEpochDay = epochDayFromSqlDate(selectedDay);
  const entries = logEntries.map((entry) => ({
    optionId: entry.optionId,
    eatenOn: epochDayFromSqlDate(entry.eatenOn),
  }));

  const rows = rankTonight(options, entries, anchorEpochDay);
  // The decided block shows each Picked Option's recency as it stood *before*
  // the Selected day — "5d", not "0d" — and its Tag chips keep that pre-Pick
  // context (PRD: Tonight — decided mode). So rank the Catalog a second time
  // over the Log with the Selected day's entries dropped, and feed those rows
  // to the decided side.
  const entriesBeforeAnchor = entries.filter(
    (entry) => entry.eatenOn < anchorEpochDay,
  );
  const decidedRows = rankTonight(options, entriesBeforeAnchor, anchorEpochDay);
  // Tonight's mode is decided server-side: the Selected day's Log entries
  // split the ranked list into the day's Dinner (decided mode) and the
  // still-pickable picker.
  const { tonightsDinner, picker } = splitTonight(
    rows,
    todayEntries,
    decidedRows,
  );

  // Suppression (PRD: Rejections on Tonight) — Options rejected on the
  // Selected day drop out of the deterministic picker. This is a presentation
  // filter only: it is applied after `rankTonight`, so the Score and the
  // ranking are untouched (ADR-0003, ADR-0006). `allRejected` distinguishes a
  // list emptied by Rejections from a genuinely empty Catalog, so the screen
  // shows honest copy. The same `anchorRejections` result also feeds the
  // "Rejected for [day]" disclosure, where each entry can be brought back.
  const rejectedForAnchor = new Set(anchorRejections.map((r) => r.optionId));
  const visiblePicker = picker.filter(
    (row) => !rejectedForAnchor.has(row.option.id),
  );
  const allRejected = picker.length > 0 && visiblePicker.length === 0;

  // AI search appears only when `ANTHROPIC_API_KEY` is configured; without it
  // Tonight is exactly v1.
  return (
    <TonightScreen
      tonightsDinner={tonightsDinner}
      pickerRows={visiblePicker}
      rejectedTonight={anchorRejections}
      allRejected={allRejected}
      searchEnabled={aiSearchEnabled()}
      selectedDay={selectedDay}
      todaySql={todaySql}
    />
  );
}
