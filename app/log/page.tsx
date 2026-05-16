import { getLog, getOptionChoices } from "../../db/queries";
import { todaySqlDate } from "../../lib/local-day";
import { LogScreen } from "./log-screen";

/**
 * The Log reads and writes the DB on every visit and splits entries against
 * the Household's current calendar day — never prerender it.
 */
export const dynamic = "force-dynamic";

export default async function LogPage() {
  const today = todaySqlDate(new Date(), process.env.APP_TZ ?? "UTC");
  const [entries, optionChoices] = await Promise.all([
    getLog(),
    getOptionChoices(),
  ]);
  return (
    <LogScreen entries={entries} optionChoices={optionChoices} today={today} />
  );
}
