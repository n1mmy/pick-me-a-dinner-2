/**
 * Closed days — the pure predicate behind Tonight's closed-day suppression
 * (PRD: Closed days, ADR-0010). No I/O: it is handed a Restaurant's
 * `closedDays` and the **Selected day**, and answers one question — is this
 * Restaurant shut on that day?
 *
 * The rule is uniform across past, present, and future Selected days
 * (ADR-0008's "suppression stays purely date-driven"): a weekday match is a
 * weekday match regardless of which calendar date it falls on, so there is no
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
