import { getTonightData } from "../db/queries";
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
  const { options, logEntries, todayEntries } = await getTonightData(today);

  const todayEpochDay = epochDayFromSqlDate(today);
  const entries = logEntries.map((entry) => ({
    optionId: entry.optionId,
    eatenOn: epochDayFromSqlDate(entry.eatenOn),
  }));

  const rows = rankTonight(options, entries, todayEpochDay);
  // Tonight's mode is decided server-side: today's Log entries split the ranked
  // list into Tonight's dinner (decided mode) and the still-pickable picker.
  const { tonightsDinner, picker } = splitTonight(rows, todayEntries);

  // AI search appears only when `ANTHROPIC_API_KEY` is configured; without it
  // Tonight is exactly v1.
  return (
    <TonightScreen
      tonightsDinner={tonightsDinner}
      pickerRows={picker}
      searchEnabled={aiSearchEnabled()}
    />
  );
}
