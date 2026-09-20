/**
 * Dinner grouping — a pure module, no React or DB dependency.
 *
 * A Log arrives as a flat, newest-`eaten_on`-first list of Log entries.
 * `groupByDay` turns it, together with the Rejection list, into the shape the
 * Log screen renders (PRD: Dated Rejections on the Log): Log entries *and*
 * Rejections grouped by date together, split into Upcoming (`eaten_on` /
 * `rejected_on` after today) and History — so a date with only Rejections
 * still forms a record. `formatDinnerDate` renders that date as a
 * "Today / Tomorrow / Yesterday / Fri, May 16" header label.
 */

const DAY_MS = 86_400_000;

/** UTC-anchored ms for a `YYYY-MM-DD` — date arithmetic without a zone skew. */
function dateMs(sqlDate: string): number {
  return Date.UTC(
    Number(sqlDate.slice(0, 4)),
    Number(sqlDate.slice(5, 7)) - 1,
    Number(sqlDate.slice(8, 10)),
  );
}

/**
 * A Dinner's date header — "Today" / "Tomorrow" / "Yesterday", else the
 * "Fri, May 16" form, with a "· N days ago" suffix on past dates (a future
 * date stays plain).
 */
export function formatDinnerDate(sqlDate: string, today: string): string {
  const diff = Math.round((dateMs(sqlDate) - dateMs(today)) / DAY_MS);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  const label = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(dateMs(sqlDate)));
  return diff < 0 ? `${label} · ${-diff} days ago` : label;
}

/**
 * A DayRecord: one calendar date carrying that date's Dinner — its Log entries
 * — and that date's Rejections. A date with only Rejections (no Dinner) still
 * forms a record, so a Rejection-only night is never invisible (PRD: Dated
 * Rejections on the Log).
 */
export type DayRecord<E extends { eatenOn: string }, R extends { rejectedOn: string }> = {
  /** The SQL date (`"YYYY-MM-DD"`) shared by every entry and Rejection here. */
  date: string;
  /** The date's Log entries — the Dinner — in the caller's input order. */
  entries: E[];
  /** The date's Rejections, in the caller's input order. */
  rejections: R[];
};

/**
 * Group a newest-first Log and the Rejection list into per-date DayRecords,
 * split into Upcoming (`date > today`) and History (`date <= today`). Log
 * entries and Rejections sharing a date land in one record; a date with only
 * Rejections still forms a record. The split is exact at the today boundary —
 * a record dated today is History, a record dated tomorrow is Upcoming.
 * Upcoming is returned soonest-first so the nearest plan reads at the top;
 * History stays newest-first.
 *
 * Pure — no React, no DB. The caller hands over the entries and Rejections it
 * has already loaded; this module only reads `eatenOn` / `rejectedOn`.
 */
export function groupByDay<
  E extends { eatenOn: string },
  R extends { rejectedOn: string },
>(
  entries: E[],
  rejections: R[],
  today: string,
): { upcoming: DayRecord<E, R>[]; history: DayRecord<E, R>[] } {
  const byDate = new Map<string, DayRecord<E, R>>();

  // `record` reads an existing DayRecord for a date or creates an empty one,
  // so an entry and a Rejection on the same date converge on one record.
  const record = (date: string): DayRecord<E, R> => {
    let found = byDate.get(date);
    if (!found) {
      found = { date, entries: [], rejections: [] };
      byDate.set(date, found);
    }
    return found;
  };

  for (const entry of entries) record(entry.eatenOn).entries.push(entry);
  for (const rejection of rejections) {
    record(rejection.rejectedOn).rejections.push(rejection);
  }

  const all = [...byDate.values()];
  return {
    // Upcoming soonest-first: the nearest plan at the top of its strip.
    upcoming: all
      .filter((r) => r.date > today)
      .sort((a, b) => a.date.localeCompare(b.date)),
    // History newest-first: the screen reads newest-first.
    history: all
      .filter((r) => r.date <= today)
      .sort((a, b) => b.date.localeCompare(a.date)),
  };
}
