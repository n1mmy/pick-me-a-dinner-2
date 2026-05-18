import { getTodayRejections, getTonightData } from "../db/queries";
import { aiSearchEnabled } from "../lib/ai-search";
import { epochDayFromSqlDate, todaySqlDate } from "../lib/local-day";
import { rankTonight } from "../lib/ranking";
import { splitTonight } from "../lib/tonights-dinner";
import { TonightScreen } from "./tonight-screen";

/**
 * Tonight depends on the Household's current calendar day and on every Log
 * write, so it must never be prerendered — "today" would freeze at build time.
 */
export const dynamic = "force-dynamic";

export default async function TonightPage() {
  // "Today" is the Household's calendar day in APP_TZ — not the server's UTC
  // day — so all recency is measured from the household's perspective.
  const today = todaySqlDate(new Date(), process.env.APP_TZ ?? "UTC");
  const [{ options, logEntries, todayEntries }, todayRejections] =
    await Promise.all([getTonightData(today), getTodayRejections(today)]);

  const todayEpochDay = epochDayFromSqlDate(today);
  const entries = logEntries.map((entry) => ({
    optionId: entry.optionId,
    eatenOn: epochDayFromSqlDate(entry.eatenOn),
  }));

  const rows = rankTonight(options, entries, todayEpochDay);
  // The decided block shows each Picked Option's recency as it stood *before*
  // tonight — "5d", not "0d" — and its Tag chips keep that pre-Pick context
  // (PRD: Tonight — decided mode). So rank the Catalog a second time over the
  // Log with today's entries dropped, and feed those rows to the decided side.
  const entriesBeforeToday = entries.filter(
    (entry) => entry.eatenOn < todayEpochDay,
  );
  const decidedRows = rankTonight(options, entriesBeforeToday, todayEpochDay);
  // Tonight's mode is decided server-side: today's Log entries split the ranked
  // list into Tonight's dinner (decided mode) and the still-pickable picker.
  const { tonightsDinner, picker } = splitTonight(
    rows,
    todayEntries,
    decidedRows,
  );

  // Suppression (PRD: Rejections on Tonight) — Options rejected today drop out
  // of the deterministic picker. This is a presentation filter only: it is
  // applied after `rankTonight`, so the Score and the ranking are untouched
  // (ADR-0003, ADR-0006). `allRejected` distinguishes a list emptied by
  // Rejections from a genuinely empty Catalog, so the screen shows honest copy.
  // The same `todayRejections` result also feeds the "Rejected tonight"
  // disclosure, where each entry can be brought back.
  const rejectedToday = new Set(todayRejections.map((r) => r.optionId));
  const visiblePicker = picker.filter(
    (row) => !rejectedToday.has(row.option.id),
  );
  const allRejected = picker.length > 0 && visiblePicker.length === 0;

  // AI search appears only when `ANTHROPIC_API_KEY` is configured; without it
  // Tonight is exactly v1.
  return (
    <TonightScreen
      tonightsDinner={tonightsDinner}
      pickerRows={visiblePicker}
      rejectedTonight={todayRejections}
      allRejected={allRejected}
      searchEnabled={aiSearchEnabled()}
    />
  );
}
