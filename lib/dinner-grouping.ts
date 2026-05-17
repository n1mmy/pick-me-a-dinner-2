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

/** A Dinner's date header — "Today" / "Tomorrow" / "Yesterday", else "Fri, May 16". */
export function formatDinnerDate(sqlDate: string, today: string): string {
  const diff = Math.round((dateMs(sqlDate) - dateMs(today)) / DAY_MS);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(dateMs(sqlDate)));
}
