/**
 * The label over a **Prepared note** brief (DESIGN.md, "Prepared brief"):
 * when the note was written, in the Household's time zone.
 */
import { todaySqlDate, weekdayName } from "./local-day";

/** "2:14pm" — `preparedAt`'s wall-clock time in `timeZone`. */
function clockTime(preparedAt: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(preparedAt);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("hour")}:${part("minute")}${part("dayPeriod").toLowerCase()}`;
}

/**
 * "Prepared 2:14pm" for a note written today, "Prepared Mon 9:40pm" for one
 * written earlier — a bare time would read as today's. The day is taken in
 * `timeZone`, the Household's, not the server's.
 */
export function preparedLabel(
  preparedAt: Date,
  todaySql: string,
  timeZone: string,
): string {
  const time = clockTime(preparedAt, timeZone);
  const preparedOn = todaySqlDate(preparedAt, timeZone);
  if (preparedOn === todaySql) return `Prepared ${time}`;
  return `Prepared ${weekdayName(preparedOn).slice(0, 3)} ${time}`;
}
