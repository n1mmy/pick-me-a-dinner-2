/**
 * Local-day module — a deep, pure conversion from a SQL `date` (or a "now"
 * instant) to an integer **epoch-day** in the Household's timezone (`APP_TZ`).
 *
 * All recency arithmetic in the ranking engine subtracts epoch-days, so every
 * date must pass through here first. The point is correctness across a DST
 * boundary: the calendar day is read with `Intl` in the target zone, then days
 * are counted on a UTC anchor — never by fixed-offset millisecond arithmetic
 * that a 23- or 25-hour day would skew.
 */

const MS_PER_DAY = 86_400_000;

/**
 * Epoch-day of a SQL `date` string (`"YYYY-MM-DD"`) — the count of whole days
 * since 1970-01-01. A SQL `date` carries no time or zone, so this is exact and
 * timezone-independent: it anchors the date at UTC midnight purely to count.
 */
export function epochDayFromSqlDate(sqlDate: string): number {
  const [year, month, day] = sqlDate.split("-").map(Number);
  return Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

/**
 * Whether `value` is a well-formed SQL `date` — `"YYYY-MM-DD"` shape *and* a
 * real calendar day. Server actions check this before a write so a cleared
 * `<input type="date">` (`""`) or a malformed string becomes an inline error
 * instead of an uncaught 500 (review fix F3). `2026-02-30` is rejected: it has
 * the right shape but `Date` rolls it over to March, so the round-trip differs.
 */
export function isValidSqlDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * The Household's calendar day for the instant `now`, as a `"YYYY-MM-DD"`
 * string read in `timeZone`. `en-CA` formats as ISO `YYYY-MM-DD`.
 */
export function todaySqlDate(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/**
 * Epoch-day of the Household's calendar day for the instant `now`, read in
 * `timeZone`. Correct across a DST boundary: the wall-clock date is taken in
 * the zone first, so an instant one minute either side of local midnight lands
 * on the right day even when that day is 23 or 25 hours long.
 */
export function todayEpochDay(now: Date, timeZone: string): number {
  return epochDayFromSqlDate(todaySqlDate(now, timeZone));
}

/**
 * The Household's calendar day *now*, as a `"YYYY-MM-DD"` string — the standard
 * binding of the pure `todaySqlDate` to the wall clock and the `APP_TZ`
 * timezone (falling back to `"UTC"` when it is unset). Every page and action
 * that needs "today" routes through here, so the `process.env.APP_TZ ?? "UTC"`
 * fallback lives in exactly one place.
 *
 * This is the module's one impure convenience — it reads the clock and the
 * environment. The conversions above stay pure and unit-testable.
 */
export function today(): string {
  return todaySqlDate(new Date(), process.env.APP_TZ ?? "UTC");
}

/**
 * Parse the Tonight screen's `?day=` URL parameter into a **Selected day** SQL
 * date, defaulting to today on anything that is not a valid future-or-today
 * SQL date (ADR-0009). The Selected day anchors the whole Tonight screen — the
 * deterministic ranked list, AI search, the decided block, and the live Reject
 * control all use this date. Past dates are off-limits and stay a Log-screen
 * backfill job, so a past `?day=` is clamped to today rather than honoured. A
 * SQL date is lexicographically ordered, so the `<` comparison is exact.
 */
export function parseSelectedDay(
  rawParam: unknown,
  todaySql: string,
): string {
  if (typeof rawParam !== "string") return todaySql;
  if (!isValidSqlDate(rawParam)) return todaySql;
  if (rawParam < todaySql) return todaySql;
  return rawParam;
}

/** Weekday names, indexed by `Date.prototype.getUTCDay()` (0 = Sunday). */
const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * The weekday of a SQL `date` string — `"Friday"`, `"Tuesday"`, etc. Used by
 * the Tonight screen's H1 to show the Selected day's name when it is not
 * today (ADR-0009). The date is anchored at UTC midnight purely to read the
 * weekday, so this is exact and timezone-independent.
 */
export function weekdayName(sqlDate: string): string {
  const [year, month, day] = sqlDate.split("-").map(Number);
  return WEEKDAY_NAMES[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

/**
 * Shift a SQL `date` string by `days` calendar days (negative steps back).
 * Uses the same UTC-midnight anchoring as `epochDayFromSqlDate`, so a 31st of
 * the month wraps to the next month cleanly and the result never reads a wrong
 * day across a DST boundary — a SQL date has no time or zone, so the
 * computation stays exact and timezone-independent.
 */
export function shiftSqlDate(sqlDate: string, days: number): string {
  const [year, month, day] = sqlDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  const yyyy = shifted.getUTCFullYear();
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
