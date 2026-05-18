/**
 * Rejections — the pure shaping of the Household's Rejection history for the AI
 * search snapshot (PRD: Rejections on Tonight, ADR-0006). No I/O: it is handed
 * the Rejection rows — each carrying its Option's name / kind / Tags for
 * readability — and today's date, and it partitions them, derives the per-day
 * suppression set, and shapes the snapshot's Rejections block.
 *
 * ADR-0006: every Rejection is stored flat as raw dated history. This module
 * encodes no decay, no query-scoping, and no "standing dislike vs one-off"
 * judgement — that call is the model's. All it does is split today from
 * not-today (today's rejected Options leave the candidate set; not-today ones
 * — past *or* future-dated — stay candidates) and shape both groups parallel
 * to the Log block, so the model reasons over Rejections the way it reasons
 * over the Log (ADR-0005, ADR-0008).
 */
import {
  delimit,
  delimitNullable,
  formatDateWithWeekday,
} from "./snapshot-format";

/**
 * A Rejection row as this module consumes it: the Rejection itself plus the
 * rejected Option's name / kind / Tags, carried for snapshot readability.
 */
export type RejectionRow = {
  optionId: string;
  /** The optional short reason — `null` when the Household gave none. */
  reason: string | null;
  /** `rejected_on` as a SQL date string, `"YYYY-MM-DD"` (see `local-day.ts`). */
  rejectedOn: string;
  /** The rejected Option's name — Household-authored. */
  optionName: string;
  kind: "home" | "restaurant";
  /** The rejected Option's Tag names — each Household-authored. */
  tags: string[];
};

/**
 * One Rejection in the model-input snapshot — one turned-down Option, as dated
 * history, parallel to a Log entry (`SnapshotModelLogEntry`).
 */
export type SnapshotRejection = {
  /** The day rejected, with weekday — e.g. `"2026-05-12 (Tuesday)"`. */
  date: string;
  /** The rejected Option, by id — ties the Rejection to a candidate exactly. */
  optionId: string;
  /** That Option's name — Household-authored and delimited. */
  name: string;
  kind: "home" | "restaurant";
  /** That Option's Tags — each Household-authored and delimited. */
  tags: string[];
  /**
   * The Household's reason — Household-authored and delimited, or `null` when
   * none was given. A null reason is carried as `null`, never an empty
   * delimiter — an unexplained Rejection is honest weak data (PRD user story
   * 22), not noise.
   */
  reason: string | null;
};

/**
 * The snapshot's Rejections block: today's Rejections — whose Options are off
 * the candidate set — and not-today ones — whose Options stay candidates — each
 * group ordered newest first, parallel to the Log block. The not-today group
 * carries both past and future-dated (Planned) Rejections; each row's own date
 * tells the model which it is, so the group label stays date-neutral
 * (ADR-0008).
 */
export type RejectionsBlock = {
  rejectedTonight: SnapshotRejection[];
  notTodayRejections: SnapshotRejection[];
};

/** The partitioned Rejections: the snapshot block plus the suppression set. */
export type PartitionedRejections = {
  /**
   * The ids of Options rejected *today* — the per-day suppression set. These
   * Options are dropped from the snapshot's candidate `options`.
   */
  suppressedToday: Set<string>;
  /** Both Rejection groups, shaped for the model-input snapshot. */
  block: RejectionsBlock;
};

/** Shape one Rejection row into a snapshot entry — delimited, weekday-dated. */
function toSnapshotRejection(row: RejectionRow): SnapshotRejection {
  return {
    date: formatDateWithWeekday(row.rejectedOn),
    optionId: row.optionId,
    name: delimit(row.optionName),
    kind: row.kind,
    tags: row.tags.map((tag) => delimit(tag)),
    reason: delimitNullable(row.reason),
  };
}

/**
 * Partition the Household's Rejection history against today: a row whose
 * `rejectedOn` is exactly today is *rejected tonight*, every other row —
 * past-dated *or* future-dated (a Planned rejection) — is *not-today*. Derives
 * the today suppression set — the Option ids rejected today — and shapes both
 * groups for the snapshot: reasons delimited, dates carrying their weekday,
 * each group newest first. The suppression set stays `rejectedOn === today`
 * only, so a Planned rejection's Option remains a candidate today (ADR-0008).
 */
export function partitionRejections(
  rows: RejectionRow[],
  today: string,
): PartitionedRejections {
  const tonight: RejectionRow[] = [];
  const notToday: RejectionRow[] = [];
  const suppressedToday = new Set<string>();

  for (const row of rows) {
    if (row.rejectedOn === today) {
      tonight.push(row);
      suppressedToday.add(row.optionId);
    } else {
      notToday.push(row);
    }
  }

  // Newest Rejection first within each group — parallel to the Log block. The
  // sort is stable, so same-day rows keep the caller's order (the query hands
  // them over newest `created_at` first).
  const newestFirst = (a: RejectionRow, b: RejectionRow) =>
    b.rejectedOn.localeCompare(a.rejectedOn);

  return {
    suppressedToday,
    block: {
      rejectedTonight: [...tonight].sort(newestFirst).map(toSnapshotRejection),
      notTodayRejections: [...notToday]
        .sort(newestFirst)
        .map(toSnapshotRejection),
    },
  };
}
