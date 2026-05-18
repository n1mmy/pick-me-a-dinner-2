/**
 * Dinner grouping — a pure module, no React or DB dependency.
 *
 * A Log arrives as a flat, newest-`eaten_on`-first list of Log entries. This
 * module turns it into the shape both the Log screen and the Option detail
 * page's History section render: the realized history split from the Planned
 * dinners (`eaten_on` after today), each grouped by date into Dinners, plus the
 * "Today / Tomorrow / Yesterday / Fri, May 16" date label for a Dinner header.
 *
 * It was lifted out of `app/log/log-screen.tsx` so the detail page reuses the
 * split, the grouping, and the label rather than duplicating them — and so the
 * Log screen's grouping behavior is pinned by `dinner-grouping.test.ts` before
 * the refactor onto this module.
 *
 * `groupByDay` extends that further (PRD: Dated Rejections on the Log): it
 * groups Log entries *and* Rejections by date together, so the Log screen can
 * render each date's Dinner alongside that date's Rejections — a date with only
 * Rejections still forms a record.
 */

/** A Dinner: one calendar date carrying one or more Log entries. */
export type Dinner<T extends { eatenOn: string }> = {
  /** The `eaten_on` SQL date (`"YYYY-MM-DD"`) shared by every entry. */
  date: string;
  entries: T[];
};

/**
 * Group already-date-sorted entries into Dinners, preserving the input order:
 * consecutive entries sharing an `eaten_on` collapse into one Dinner, and the
 * Dinners come out in the order their dates first appear.
 */
export function groupByDate<T extends { eatenOn: string }>(
  entries: T[],
): Dinner<T>[] {
  const dinners: Dinner<T>[] = [];
  for (const entry of entries) {
    const last = dinners[dinners.length - 1];
    if (last && last.date === entry.eatenOn) {
      last.entries.push(entry);
    } else {
      dinners.push({ date: entry.eatenOn, entries: [entry] });
    }
  }
  return dinners;
}

/**
 * Split a newest-`eaten_on`-first Log into its **Planned dinners** (`eaten_on`
 * strictly after `today`) and its realized history (`eaten_on` today or
 * earlier), each grouped into Dinners. The split is exact at the today
 * boundary — an entry dated today is realized, an entry dated tomorrow is
 * Planned. Realized Dinners stay newest-first; `planned` is returned
 * soonest-first so the nearest plan reads at the top of its group.
 */
export function splitDinners<T extends { eatenOn: string }>(
  entries: T[],
  today: string,
): { planned: Dinner<T>[]; realized: Dinner<T>[] } {
  return {
    planned: groupByDate(entries.filter((e) => e.eatenOn > today)).reverse(),
    realized: groupByDate(entries.filter((e) => e.eatenOn <= today)),
  };
}

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
