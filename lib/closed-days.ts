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
 *
 * Tonight and AI search share this predicate but not its consequence: Tonight
 * keeps a closed Restaurant visible, in the Closed disclosure, with full
 * controls; AI search's candidate set drops closed Restaurants entirely. Only
 * `isClosedOn` is shared — each caller decides what "closed" means for its
 * own list.
 */
import type { TonightRow } from "./ranking";
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

/**
 * Split `rows` into what stays on the picker and what is closed on
 * `selectedDaySql` (PRD: Closed days, ADR-0010) — the closed-day half of
 * Tonight's picker filtering (`lib/tonight-day.ts` applies the Rejection
 * filter first, so a row both closed and rejected never reaches here).
 * `closedDays` lives on the Catalog's `TonightOption`, not on the
 * `RankOption` a `TonightRow` carries, so `options` supplies it, keyed by id.
 *
 * `closed` comes back alphabetical by name, matching the Closed disclosure's
 * own ordering (DESIGN.md "Closed disclosure": "the list is alphabetical, not
 * ranked"); `visible` keeps the caller's order — the ranking.
 */
export function partitionClosedRows(
  rows: TonightRow[],
  options: { id: string; closedDays: number[] }[],
  selectedDaySql: string,
): { visible: TonightRow[]; closed: TonightRow[] } {
  const closedDaysById = new Map(
    options.map((option) => [option.id, option.closedDays]),
  );
  const visible: TonightRow[] = [];
  const closed: TonightRow[] = [];

  for (const row of rows) {
    const shut = isClosedOn(
      closedDaysById.get(row.option.id) ?? [],
      selectedDaySql,
    );
    (shut ? closed : visible).push(row);
  }

  closed.sort((a, b) => a.option.name.localeCompare(b.option.name));
  return { visible, closed };
}
