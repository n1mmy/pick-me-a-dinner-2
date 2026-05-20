/**
 * Rejections — the pure shaping of the Household's Rejection history for the AI
 * search snapshot (PRD: Rejections on Tonight, ADR-0006). No I/O: it is handed
 * the Rejection rows — each carrying its Option's name / kind / Tags for
 * readability — and the anchor day, and it partitions them, derives the
 * per-anchor-day suppression set, and shapes the snapshot's Rejections block.
 *
 * The anchor day is the AI search's **Selected day** (ADR-0009) — today on the
 * standard render, the Selected day when the Household has stepped Tonight to
 * another date. A Rejection dated on the anchor day suppresses its Option from
 * the candidate set (it has been turned down *for that day*); every other
 * Rejection — past or future — stays a candidate and feeds the model as raw
 * dated history.
 *
 * ADR-0006: every Rejection is stored flat as raw dated history. This module
 * encodes no decay, no query-scoping, and no "standing dislike vs one-off"
 * judgement — that call is the model's. All it does is split anchor-day from
 * not-anchor-day (anchor-day's rejected Options leave the candidate set;
 * not-anchor-day ones — past *or* future-dated — stay candidates) and shape
 * both groups parallel to the Log block, so the model reasons over Rejections
 * the way it reasons over the Log (ADR-0005, ADR-0008).
 *
 * The JSON field names sent to the model — `rejectedTonight`,
 * `notTodayRejections` — are kept from the model's perspective: the anchor
 * day is "today" *to the model*, regardless of which calendar date the
 * Household stepped to. The system prompt reads those keys verbatim.
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
  /** The rejected Option, by its snapshot number — ties the Rejection to it. */
  optionId: number;
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
 * The snapshot's Rejections block — both groups carried to the model:
 * `rejectedTonight` (Rejections dated on the anchor day, whose Options are off
 * the candidate set) and `notTodayRejections` (every other Rejection — past or
 * future, the Options still candidates), each group ordered newest first,
 * parallel to the Log block. The field names are the model's vocabulary —
 * "tonight" means the anchor day from the model's perspective, regardless of
 * which date the Household stepped to (ADR-0009). The not-anchor-day group
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
   * The ids of Options rejected *on the anchor day* — the per-anchor-day
   * suppression set. These Options are dropped from the snapshot's candidate
   * `options`.
   */
  suppressedForAsOf: Set<string>;
  /** Both Rejection groups, shaped for the model-input snapshot. */
  block: RejectionsBlock;
};

/**
 * Shape one Rejection row into a snapshot entry — delimited, weekday-dated, the
 * Option referred to by its snapshot number. Every Rejection is of an active
 * Option (`getRejections` joins `active = true`), and the snapshot numbers the
 * whole active Catalog, so the lookup always resolves.
 */
function toSnapshotRejection(
  row: RejectionRow,
  indexByOptionId: ReadonlyMap<string, number>,
): SnapshotRejection {
  return {
    date: formatDateWithWeekday(row.rejectedOn),
    optionId: indexByOptionId.get(row.optionId)!,
    name: delimit(row.optionName),
    kind: row.kind,
    tags: row.tags.map((tag) => delimit(tag)),
    reason: delimitNullable(row.reason),
  };
}

/**
 * Partition the Household's Rejection history against the `asOf` anchor day: a
 * row whose `rejectedOn` is exactly the anchor day is *rejected for the anchor
 * day* (and lands in the snapshot's `rejectedTonight` group from the model's
 * perspective), every other row — past-dated *or* future-dated (a Planned
 * rejection that is not today) — is *not-anchor-day*. Derives the per-anchor
 * suppression set — the Option ids rejected on the anchor day — and shapes
 * both groups for the snapshot: reasons delimited, dates carrying their
 * weekday, the Option referred to by its snapshot number (`indexByOptionId`,
 * keyed by UUID), each group newest first. The suppression set stays
 * `rejectedOn === asOf` only, so a Planned rejection's Option remains a
 * candidate until its date becomes the anchor day (ADR-0008, ADR-0009).
 */
export function partitionRejections(
  rows: RejectionRow[],
  asOf: string,
  indexByOptionId: ReadonlyMap<string, number>,
): PartitionedRejections {
  const tonight: RejectionRow[] = [];
  const notToday: RejectionRow[] = [];
  const suppressedForAsOf = new Set<string>();

  for (const row of rows) {
    if (row.rejectedOn === asOf) {
      tonight.push(row);
      suppressedForAsOf.add(row.optionId);
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
    suppressedForAsOf,
    block: {
      rejectedTonight: [...tonight]
        .sort(newestFirst)
        .map((row) => toSnapshotRejection(row, indexByOptionId)),
      notTodayRejections: [...notToday]
        .sort(newestFirst)
        .map((row) => toSnapshotRejection(row, indexByOptionId)),
    },
  };
}
