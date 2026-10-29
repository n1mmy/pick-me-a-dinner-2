/**
 * Snapshot formatting shared by the AI snapshot (`lib/snapshot`) and
 * the Rejections block (`lib/rejections`): dates with their weekday
 * (ADR-0005), and the prompt-injection delimiters the query is wrapped in.
 * The helpers live here so neither module has to import the other for them.
 */
import { WEEKDAY_NAMES, weekdayFromSqlDate } from "./local-day";

/** The XML-style delimiters wrapping Household-authored free text. */
export const HOUSEHOLD_TEXT_OPEN = "<household-text>";
export const HOUSEHOLD_TEXT_CLOSE = "</household-text>";

/**
 * Wrap Household-authored free text in an XML-style delimiter so the model
 * reads it as data, never as instructions — the prompt-injection guard for
 * the query, which AI search sends as a bare line after the snapshot JSON.
 * Text inside the JSON needs no wrapper: each value is already a quoted
 * string it cannot escape, and the system prompt names those fields as data;
 * a wrapper per name, Tag, and note cost ~4.6k tokens of a ~21k snapshot.
 *
 * The delimiter strings are stripped from the text itself before wrapping —
 * otherwise text containing a literal `</household-text>` would close the
 * envelope early and the rest would read as out-of-band instructions.
 */
export function delimit(text: string): string {
  const stripped = text
    .split(HOUSEHOLD_TEXT_OPEN)
    .join("")
    .split(HOUSEHOLD_TEXT_CLOSE)
    .join("");
  return `${HOUSEHOLD_TEXT_OPEN}${stripped}${HOUSEHOLD_TEXT_CLOSE}`;
}

/**
 * Recover the Household's text from a `delimit`ed field — the text after the
 * stripping `delimit` did, which is the text the model actually read.
 */
export function undelimit(delimited: string): string {
  return delimited.slice(
    HOUSEHOLD_TEXT_OPEN.length,
    delimited.length - HOUSEHOLD_TEXT_CLOSE.length,
  );
}

/**
 * Format a SQL date (`"YYYY-MM-DD"`) as `"YYYY-MM-DD (Weekday)"` so day-of-week
 * patterns are visible to the model — a bare date hides whether a dinner fell
 * on a Friday. The weekday number and name both come from `lib/local-day.ts`
 * — the one place a SQL date is turned into a weekday — so this can never
 * drift from the closed-days convention.
 */
export function formatDateWithWeekday(sqlDate: string): string {
  const weekday = WEEKDAY_NAMES[weekdayFromSqlDate(sqlDate)];
  return `${sqlDate} (${weekday})`;
}
