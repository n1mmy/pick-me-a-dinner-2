/**
 * Day suppressions — the pure per-day rules behind "is this Option choosable
 * on this day?" (PRD: Rejections on Tonight, PRD: Closed days, ADR-0006,
 * ADR-0010). No I/O and no ranking: it is handed the active Catalog, the
 * day's Picks and Rejections, and the day, and answers which Options are off
 * and why.
 *
 * Its two callers — `tonightForDay` (`lib/tonight-day.ts`) and AI search's
 * `buildSnapshot` (`lib/ai-search.ts`) — share this answer so the Tonight
 * picker and the AI candidate set can never disagree about which Options are
 * off for the day. They share the answer but not its consequence: Tonight
 * keeps a Closed Restaurant visible, in the Closed disclosure, with full
 * controls; AI search drops every suppressed Option from its candidates
 * alike. It is a leaf module on purpose, so AI search reaches these rules
 * without depending on the Tonight ranking.
 *
 * Every rule is uniform across past, present, and future days (ADR-0008's
 * "suppression stays purely date-driven"): a weekday match is a weekday match
 * regardless of which calendar date it falls on, so there is no
 * today-or-later branch here to carry forever.
 */
import { weekdayFromSqlDate } from "./local-day";

/**
 * Whether a Restaurant carrying `closedDays` is closed on `selectedDaySql`.
 * An empty `closedDays` — the Restaurant carries none, or the Option is a Home
 * meal, which never has any — never suppresses: "no days recorded" reads as
 * open all week, not "closed every day" (ADR-0010). Otherwise it is a plain
 * membership test against the Selected day's weekday, via the single
 * `weekdayFromSqlDate` derivation every other closed-day call site uses, so
 * the "which day is this" number can't drift between them.
 */
export function isClosedOn(
  closedDays: number[],
  selectedDaySql: string,
): boolean {
  if (closedDays.length === 0) return false;
  return closedDays.includes(weekdayFromSqlDate(selectedDaySql));
}

/** Why an Option is off for a day — see `suppressionsOn`. */
export type Suppression = "picked" | "rejected" | "closed";

/**
 * Every Option suppressed on `day`, keyed by id, with the reason. The rules
 * are checked in precedence order — Picked, then Rejected, then Closed — and
 * an Option carries only the first that applies, so an Option both closed and
 * rejected for the day is `"rejected"`, never `"closed"`. An Option absent
 * from the map is choosable on `day`; so is any Picked or Rejected id not in
 * `options`, which this reports nothing about.
 *
 * `tonightForDay` drops every suppressed row from the picker and keeps the
 * `"closed"` ones aside for the Closed disclosure; AI search drops every
 * suppressed Option from its candidates. A new per-day rule added here reaches
 * both.
 */
export function suppressionsOn({
  options,
  pickedOptionIds,
  rejectedOptionIds,
  day,
}: {
  options: { id: string; closedDays: number[] }[];
  /** Option ids with a Log entry dated `day`. */
  pickedOptionIds: Iterable<string>;
  /** Option ids carrying a Rejection dated `day`. */
  rejectedOptionIds: Iterable<string>;
  /** The day, as a SQL `date` string. */
  day: string;
}): Map<string, Suppression> {
  const picked = new Set(pickedOptionIds);
  const rejected = new Set(rejectedOptionIds);
  const suppressions = new Map<string, Suppression>();
  for (const { id, closedDays } of options) {
    if (picked.has(id)) suppressions.set(id, "picked");
    else if (rejected.has(id)) suppressions.set(id, "rejected");
    else if (isClosedOn(closedDays, day)) suppressions.set(id, "closed");
  }
  return suppressions;
}
