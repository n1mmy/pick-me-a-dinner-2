/**
 * Tonight-for-a-day module — the single answer to "is this Option choosable
 * on the Selected day?" No DB, no `today()`, no React: given the Selected
 * day's raw data, `tonightForDay` composes every suppression rule Tonight
 * applies and returns exactly what the screen renders.
 *
 * "Is this Option in the picker" has four answers, only one of which lives
 * here:
 *
 *   - **Archived** — stays in SQL (`getTonightData` only selects active
 *     Options). This module treats "every `options` row is active" as an
 *     input precondition, not a rule it re-checks.
 *   - Already **Picked** for the day — `splitTonight` (`./tonights-dinner`),
 *     called from step 4 below.
 *   - **Rejected** for the Selected day — step 5 below.
 *   - **Closed** on the Selected day — `partitionClosedRows`
 *     (`./closed-days`), called from step 6 below.
 *
 * The order of the last two is load-bearing and now lives in exactly one
 * place: Rejection is applied first, so an Option both closed and rejected
 * for the Selected day lands in the Rejected disclosure only — it is dropped
 * before `partitionClosedRows` ever sees it, so it can never also appear in
 * `closed`.
 *
 * The composition, in order:
 *
 *   1. epoch-day conversion of `logEntries` (`epochDayFromSqlDate`);
 *   2. `rankTonight` over the day's entries;
 *   3. `rankTonight` over the entries strictly before the day → `decidedRows`,
 *      so the decided block shows each Picked Option's pre-Pick recency
 *      rather than a meaningless "0d";
 *   4. `splitTonight` → `tonightsDinner` + `picker`;
 *   5. drop `rejectedOptionIds` from the picker;
 *   6. `partitionClosedRows` over what is left → `picker` + `closed`;
 *   7. `lastNotesByOption` for every row type;
 *   8. `allFiltered` — the picker had rows before steps 5–6 and none after,
 *      so the screen can tell "filtered empty" from "genuinely empty
 *      Catalog".
 *
 * This is a presentation composition only: it runs after `rankTonight`, so
 * the Score and the ranking stay untouched (ADR-0003, ADR-0006, ADR-0010).
 */
import { partitionClosedRows } from "./closed-days";
import {
  lastNotesByOption,
  type LastNote,
  type NotedLogEntry,
} from "./last-note";
import { epochDayFromSqlDate } from "./local-day";
import {
  rankTonight,
  type LogEntry,
  type RankOption,
  type TonightRow,
} from "./ranking";
import {
  splitTonight,
  type TodayLogEntry,
  type TonightsDinnerEntry,
} from "./tonights-dinner";

/**
 * An active Catalog Option as `tonightForDay` needs it: a `RankOption` plus
 * its `closedDays`. `db/queries.ts`'s `TonightOption` satisfies this
 * structurally — this module names its own input type instead of importing
 * the DB module, so it stays free of any DB dependency.
 */
export type TonightDayOption = RankOption & {
  /** `0`–`6`, `0` = Sunday (see `local-day.ts`); empty = open all week. */
  closedDays: number[];
};

/**
 * A Log entry as `tonightForDay` needs it — dated, attributed, possibly
 * noted, with `eaten_on` still a SQL `date` string (this module converts it
 * to an epoch-day itself, at step 1). `db/queries.ts`'s `NotedTonightLogRow`
 * satisfies this structurally.
 */
export type TonightDayLogEntry = {
  optionId: string;
  /** `eaten_on` as a SQL `date` string (`"YYYY-MM-DD"`). */
  eatenOn: string;
  /** Row creation time — the Pick's wall-clock instant. */
  createdAt: Date;
  /** The entry's free-text Note, or `null` when none is set. */
  note: string | null;
};

/** The input `tonightForDay` needs to compose the Selected day's Tonight screen. */
export type TonightForDayInput = {
  /** The active Catalog, carrying each Option's `closedDays`. */
  options: TonightDayOption[];
  /** The non-future-relative-to-the-day Log entries. */
  logEntries: TonightDayLogEntry[];
  /** The Selected day's own Log entries (`getTonightData`'s `todayEntries`). */
  dayEntries: TodayLogEntry[];
  /** Option ids carrying a Rejection dated the Selected day. */
  rejectedOptionIds: string[];
  /** The Selected day, as a SQL `date` string. */
  selectedDay: string;
};

/** Everything the Tonight screen renders for the Selected day. */
export type TonightForDay = {
  /** The Picked Options, in pick order. */
  tonightsDinner: TonightsDinnerEntry[];
  /** The ranked, still-pickable rows: Picked, Rejected, and Closed all removed. */
  picker: TonightRow[];
  /** The rows closed on the Selected day, alphabetical by name. */
  closed: TonightRow[];
  /** Each Option's Last note, keyed by Option id. */
  lastNotes: Map<string, LastNote>;
  /**
   * True when Rejections and/or Closed days emptied a non-empty picker —
   * distinct from a genuinely empty Catalog, so the screen can show honest
   * copy either way.
   */
  allFiltered: boolean;
};

/**
 * Compose Tonight's full Selected-day suppression: rank, split into decided
 * vs. picker, drop Rejections, partition Closed days, and reduce the Log to
 * Last notes — see the module doc for the order and why it is load-bearing.
 */
export function tonightForDay({
  options,
  logEntries,
  dayEntries,
  rejectedOptionIds,
  selectedDay,
}: TonightForDayInput): TonightForDay {
  const anchorEpochDay = epochDayFromSqlDate(selectedDay);

  // 1. epoch-day conversion.
  const entries: LogEntry[] = logEntries.map((entry) => ({
    optionId: entry.optionId,
    eatenOn: epochDayFromSqlDate(entry.eatenOn),
  }));

  // 2. rank over the day's entries.
  const rows = rankTonight(options, entries, anchorEpochDay);

  // 3. rank over the entries strictly before the day, for the decided
  // block's pre-Pick recency.
  const entriesBeforeAnchor = entries.filter(
    (entry) => entry.eatenOn < anchorEpochDay,
  );
  const decidedRows = rankTonight(options, entriesBeforeAnchor, anchorEpochDay);

  // 4. split into the decided block and the live picker.
  const { tonightsDinner, picker } = splitTonight(
    rows,
    dayEntries,
    decidedRows,
  );

  // 5. drop Rejections dated the Selected day — before Closed days, so a row
  // both rejected and closed never reaches step 6.
  const rejectedIds = new Set(rejectedOptionIds);
  const afterRejection = picker.filter(
    (row) => !rejectedIds.has(row.option.id),
  );

  // 6. partition what is left into the visible picker and the Closed rows.
  const { visible: visiblePicker, closed } = partitionClosedRows(
    afterRejection,
    options,
    selectedDay,
  );

  // 7. Last notes, for every row type — one Map serves picker, AI result,
  // and decided rows alike.
  const lastNotes = lastNotesByOption(
    logEntries.map(
      (entry): NotedLogEntry => ({
        optionId: entry.optionId,
        eatenOn: epochDayFromSqlDate(entry.eatenOn),
        createdAt: entry.createdAt,
        note: entry.note,
      }),
    ),
    anchorEpochDay,
  );

  // 8. "filtered empty" vs. "genuinely empty Catalog".
  const allFiltered = picker.length > 0 && visiblePicker.length === 0;

  return {
    tonightsDinner,
    picker: visiblePicker,
    closed,
    lastNotes,
    allFiltered,
  };
}
