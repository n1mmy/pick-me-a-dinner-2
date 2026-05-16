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
