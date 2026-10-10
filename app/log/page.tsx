import {
  getDayNotes,
  getLog,
  getLogRejections,
  getOptionChoices,
} from "../../db/queries";
import { today } from "../../lib/local-day";
import { LogScreen } from "./log-screen";

/**
 * The Log reads and writes the DB on every visit and splits entries against
 * the Household's current calendar day — never prerender it.
 */
export const dynamic = "force-dynamic";

export default async function LogPage() {
  const todaySql = today();
  const [entries, rejections, dayNotes, optionChoices] = await Promise.all([
    getLog(),
    getLogRejections(),
    getDayNotes(),
    getOptionChoices(),
  ]);
  return (
    <LogScreen
      entries={entries}
      rejections={rejections}
      dayNotes={dayNotes}
      optionChoices={optionChoices}
      today={todaySql}
    />
  );
}
