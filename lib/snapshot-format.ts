/**
 * Snapshot formatting shared by the AI search snapshot (`lib/ai-search`) and
 * the Rejections block (`lib/rejections`). Both turn Household-authored data
 * into the model-input JSON, so both wrap free text in the prompt-injection
 * delimiters and format dates with their weekday (ADR-0005). The two helpers
 * live here so neither module has to import the other for them.
 */

/** The XML-style delimiters wrapping Household-authored free text. */
export const HOUSEHOLD_TEXT_OPEN = "<household-text>";
export const HOUSEHOLD_TEXT_CLOSE = "</household-text>";

/**
 * Wrap Household-authored free text in an XML-style delimiter so the model
 * reads it as data, never as instructions — the prompt-injection guard. The
 * Catalog, Log, and Rejection reasons are full of free text the Household
 * typed; none of it may be able to steer the model.
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

/** Delimit a nullable note — `null` stays `null`, there is nothing to wrap. */
export function delimitNullable(text: string | null): string | null {
  return text === null ? null : delimit(text);
}

/** Weekday names, indexed by `Date.prototype.getUTCDay()` (0 = Sunday). */
const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Format a SQL date (`"YYYY-MM-DD"`) as `"YYYY-MM-DD (Weekday)"` so day-of-week
 * patterns are visible to the model — a bare date hides whether a dinner fell
 * on a Friday. The weekday is read by anchoring the date at UTC midnight purely
 * to count, exactly as `local-day.ts` does; a SQL date carries no zone, so this
 * is exact and timezone-independent.
 */
export function formatDateWithWeekday(sqlDate: string): string {
  const [year, month, day] = sqlDate.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${sqlDate} (${weekday})`;
}
