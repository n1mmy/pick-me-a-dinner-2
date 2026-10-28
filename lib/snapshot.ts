/**
 * The **AI snapshot** (ADR-0005, ADR-0008): the one model input both AI search
 * and Prepared notes send — the active Catalog as candidates for the anchor
 * day, the full Log, the Rejections and Day notes as dated history. It owns
 * the four DB reads (`snapshotForDay`), the pure shaping (`buildSnapshot`),
 * and the one value both model clients take: the snapshot, the map from each
 * candidate's snapshot number back to its Option id, and the names.
 *
 * The output is canonical: the same data builds the same snapshot whatever
 * order Postgres returns its rows in, so a Prepared note's input hash only
 * changes when the data does.
 */
import {
  getDayNotes,
  getFullLogForSnapshot,
  getRejections,
  getTonightData,
} from "../db/queries";
import { suppressionsOn } from "./day-suppressions";
import {
  epochDayFromSqlDate,
  WEEKDAY_NAMES,
  weekdayFromSqlDate,
} from "./local-day";
import {
  partitionRejections,
  type RejectionRow,
  type RejectionsBlock,
  type SnapshotRejection,
} from "./rejections";
import { delimit, formatDateWithWeekday } from "./snapshot-format";

/** An active Catalog Option as the snapshot builder consumes it. */
export type SnapshotOption = {
  id: string;
  name: string;
  kind: "home" | "restaurant";
  tags: string[];
  notes: string | null;
  /**
   * Weekday numbers (`0`–`6`, `0` = Sunday) the Restaurant is closed on —
   * mirrors `TonightOption.closedDays` (`db/queries.ts`); empty for an
   * always-open Restaurant and always for a Home meal. Drives `buildSnapshot`'s
   * candidate drop (a Restaurant closed on `asOf` leaves the candidate set,
   * exactly as an anchor-day Rejection does) and the serialized
   * `SnapshotModelOption.closedDays` for every candidate that remains
   * (PRD: Closed days, ADR-0010).
   */
  closedDays: number[];
};

/**
 * A Log entry as the snapshot builder consumes it — any date, past, today, or
 * future (a Planned dinner). The AI snapshot sees the Household's near future
 * (ADR-0008); the deterministic ranking still gets a non-future Log of its own.
 */
export type SnapshotLogEntry = {
  optionId: string;
  /** `eaten_on` as a SQL date string, `"YYYY-MM-DD"` (see `local-day.ts`). */
  eatenOn: string;
  note: string | null;
};

/**
 * An Option's or a Tag's eating history summed up as of the anchor day
 * (ADR-0012), so every run reads the same timing facts instead of whichever
 * ones the model works out. Counted like **Recency**: Log entries of active
 * Options dated on or before the anchor day, Planned dinners before it
 * included; a day counts once however many entries share it.
 */
export type SnapshotTiming = {
  /** How many days it was eaten. */
  eaten: number;
  /** Days from its last eat to the anchor day — omitted when never eaten. */
  daysSinceLast?: number;
  /**
   * Its **Interval**: the median gap in days between consecutive eats in its
   * current run — the eats since its longest break (`intervalOf`) — omitted
   * under two eats, where there is no gap to take.
   */
  intervalDays?: number;
};

/**
 * One Rejection as a Tag's entry lists it: the day, the Option by its number,
 * the reason. The same row as the Rejections block carries, seen from the Tag.
 */
export type SnapshotTagRejection = {
  /** The day rejected, with weekday. */
  date: string;
  /** The rejected Option, by its snapshot number. */
  optionId: number;
  /** The Household's reason, or `null` when none was given. */
  reason: string | null;
};

/**
 * A Tag's entry in the snapshot: its timing facts across every active Option
 * carrying it, and — when there are any — the Rejections of those Options,
 * newest first. A Rejection is the Household's verdict on one Option, but a
 * reason like "too recent" is about the kind of food; listed under the Tag,
 * it reaches every Option of that kind, which the model did not manage when
 * the row sat under one Option alone (ADR-0006 amended). Omitted, not empty,
 * for a Tag with none.
 */
export type SnapshotTag = SnapshotTiming & { rejections?: SnapshotTagRejection[] };

/**
 * One Option in the model-input snapshot — a candidate to rank, with its
 * timing facts.
 */
export type SnapshotModelOption = SnapshotTiming & {
  /**
   * The Option's snapshot number — its 1-based position in the Catalog ordered
   * alphabetically by name. The model sees and returns this integer, never the
   * UUID; `parseRankingText` maps it back. An integer tokenizes far cheaper
   * than a UUID — in the snapshot and, above all, in every result row.
   */
  id: number;
  /** Household-authored. */
  name: string;
  kind: "home" | "restaurant";
  /** Household-authored, or `null` when the Option has no notes. */
  notes: string | null;
  /** The Tag names on this Option — each Household-authored. */
  tags: string[];
  /**
   * The Restaurant's Closed days, as weekday names (`"Sunday"`, `"Monday"`,
   * …) — a name needs no arithmetic and cannot be mis-indexed, unlike a raw
   * weekday number, matching the snapshot's other human-readable dates. Every
   * candidate here is already open on `today` — a Restaurant closed on `asOf`
   * never reaches this list at all (see `buildSnapshot`) — so this is not
   * about whether the candidate is open tonight; it exists so the model can
   * explain a thinner Log with the trading week rather than misreading it as
   * Drift (see `buildSystemPrompt`). **Omitted entirely** — not an empty
   * array — when the Restaurant has no Closed days, so an always-open
   * Restaurant and every Home meal cost nothing. App-derived structure, not
   * Household-authored text.
   */
  closedDays?: string[];
  /**
   * How many of its eats fell on each weekday, by weekday name, in week order
   * from Sunday — omitted when never eaten, and a weekday with none is left
   * out. Counts, not a "habit" label: the model judges whether one weekday
   * stands out from an even spread.
   */
  weekdays?: Record<string, number>;
};

/**
 * One Log entry in the model-input snapshot — one dinner, as dated history. Its
 * `date` may be in the future (a Planned dinner); the snapshot carries today's
 * date, so the model tells a plan from history itself (ADR-0008).
 */
export type SnapshotModelLogEntry = {
  /** The day eaten, with weekday — e.g. `"2026-05-12 (Tuesday)"`. */
  date: string;
  /** The Option eaten, by its snapshot number — ties this dinner to a candidate. */
  optionId: number;
  /** That Option's name — Household-authored. */
  name: string;
  kind: "home" | "restaurant";
  /** That Option's Tags — each Household-authored. */
  tags: string[];
  /** Household-authored, or `null` when the entry has no note. */
  note: string | null;
};

/** The model-input JSON the snapshot builder produces. */
export type ModelSnapshot = {
  /**
   * The Tonight screen's anchor day — the **Selected day** (ADR-0009) — with
   * weekday, e.g. `"2026-05-17 (Sunday)"`. Called `today` on the wire because
   * the model's frame is "today is this date": it is today *from the
   * household's planning perspective*, even when the Selected day is a future
   * calendar date the Household stepped to.
   */
  today: string;
  /**
   * The Household's query, wrapped in `<household-text>` delimiters: the one
   * Household text sent outside the JSON (AI search's trailing query line),
   * where no string quotes mark where it ends.
   */
  query: string;
  /**
   * The candidate set in alphabetical order by name — the active Catalog with
   * every Option Picked, Rejected, or Closed for today dropped (the AI-result
   * side of suppression).
   */
  options: SnapshotModelOption[];
  /**
   * Every Tag on an active Option, by name in alphabetical order, with its
   * timing facts across every active Option carrying it — once here rather
   * than on each Option that carries it — and the Rejections of those
   * Options, so a reason about the kind of food is read against every
   * Option of that kind.
   */
  tags: Record<string, SnapshotTag>;
  /**
   * The full Log as dated history, newest dinner first — past entries *and*
   * future-dated ones (Planned dinners), each carrying its real date so the
   * model tells a plan from history itself (ADR-0008).
   */
  log: SnapshotModelLogEntry[];
  /**
   * The Household's Rejections — Options turned down and why — as raw dated
   * history, split into today's and not-today's (PRD: Rejections on Tonight,
   * ADR-0006, ADR-0008). The not-today group carries past *and* future-dated
   * (Planned) Rejections. The model judges from each reason and date what is
   * standing and what was one-off; this snapshot pre-digests nothing.
   */
  rejections: RejectionsBlock;
  /**
   * The Household's **Day notes** — facts about an evening, not about any
   * Option (PRD: Day notes) — as dated history, newest first like `log`, past
   * and future alike. The anchor day's own note is not repeated here; it is
   * `todayDayNote`.
   */
  dayNotes: SnapshotModelDayNote[];
  /**
   * The anchor day's Day note — current context for this search — or `null`
   * when it has none. Delimited: Household-authored.
   */
  todayDayNote: string | null;
};

/** One Day note in the model snapshot. */
export type SnapshotModelDayNote = {
  /** The evening it is about, with weekday — e.g. `"2026-05-22 (Friday)"`. */
  date: string;
  /** Household-authored. */
  note: string;
};

/**
 * The one built value both model clients take: the snapshot, and the maps
 * that read the model's answer back. They are built together so they can
 * never be mismatched.
 */
export type BuiltSnapshot = {
  /** The JSON snapshot sent to the model — Option ids are small integers. */
  snapshot: ModelSnapshot;
  /**
   * Maps each candidate Option's snapshot integer back to its real UUID. The
   * model only ever sees and returns the integer; `parseRankingText` uses this
   * both to recover the UUID and to reject any integer that is not a candidate
   * — a hallucinated number, or an Option Picked, Rejected, or Closed for
   * today that the model wrongly returned (each keeps a number for its
   * history rows but is absent from this map, so it can never resurface as a
   * result).
   */
  idByIndex: Map<number, string>;
  /**
   * Maps each Catalog Option's id to its Household-facing name — the eval
   * scripts print a result row by name instead of a raw UUID; production has
   * no use for it (the screen already holds the names).
   */
  nameById: Map<string, string>;
};

/**
 * Turn the active Catalog, the full Log, the Rejection history, the **anchor
 * day** (the Selected day from the Tonight screen — today on the standard
 * render), and the query into the model-input JSON. Decisions baked in
 * (ADR-0005, ADR-0006, ADR-0008, ADR-0009):
 *
 * - Options come out in **alphabetical order by name**, not Score-rank order —
 *   a pre-ranked list would anchor the model toward the existing order.
 * - Every Option is given a **small integer number** — its 1-based position in
 *   that alphabetical order — and the snapshot refers to Options by that number
 *   everywhere (the Log and the Rejections too); the UUID is never sent. The
 *   numbering covers the whole Catalog, so an Option dropped as a candidate
 *   (below) keeps a stable number for its history rows. An integer tokenizes far cheaper than a UUID, and the saving
 *   compounds in every result row the model writes back.
 * - **Timing facts, not a sort key** (ADR-0012, superseding that part of
 *   ADR-0005). Each candidate carries how often it was eaten, days since its
 *   last eat, its Interval, and its weekday counts; the `tags` block carries
 *   the first three per Tag. Left to work these out from the Log, the model
 *   worked out a different subset each run and judged them inconsistently.
 *   Nothing here combines them — no overdue flag, no ratio, no habit label —
 *   so the judgment stays the model's.
 * - The Log is the **full Log — past entries and future-dated ones (Planned
 *   dinners)** — as a flat chronological list, newest dinner first, each entry
 *   carrying its real date + weekday and the eaten Option's name / kind / Tags
 *   inline. The model never sees those copies: `leanSnapshot` cuts each
 *   row to its number and lists a dropped Option's entry in `otherOptions`.
 *   The snapshot carries the anchor day as its `today`, so the model tells a
 *   plan from history itself (ADR-0008); when the Selected day is a future
 *   date the model sees it as "today" and reasons about the day-of-week and
 *   the household's plans against that frame (ADR-0009). The deterministic
 *   ranking still excludes Log rows after the anchor — only this AI snapshot
 *   sees rows beyond it.
 * - Options the Household **rejected on the anchor day** are dropped from the
 *   candidate `options` — the AI-result side of "suppressed for the day"
 *   (PRD: Rejections on Tonight). It is a presentation filter on the snapshot
 *   only; the Score and `lib/ranking` are untouched (ADR-0003, ADR-0006). A
 *   suppressed Option's eating history still appears in the Log — only its
 *   candidacy is removed.
 * - A Restaurant **closed on the anchor day** is dropped from the candidate
 *   `options` exactly the same way — a closed Restaurant cannot resurface as a
 *   result even if the model returns its number; `parseRankingText` drops it
 *   because `idByIndex` never held it. Its number, Log rows, and Rejection
 *   rows are unaffected — the numbering covers the whole Catalog either way
 *   (PRD: Closed days, ADR-0010).
 * - Options already **in the Log on the anchor day** (Picked for it) are
 *   dropped from the candidate `options` the same way. The Tonight screen
 *   removes a Picked Option from the ranked list, so any row the model wrote
 *   for it would never be shown; its Log row stays, so the model still reads
 *   what tonight's dinner already covers.
 * - All three drops come from one call to `suppressionsOn` (`lib/day-suppressions`)
 *   — the same rules the Tonight picker applies — so an Option that is
 *   several at once is dropped once, and the two lists cannot drift apart.
 * - Every **remaining candidate**'s Closed days ride along on
 *   `SnapshotModelOption.closedDays`, as weekday names, so the model can
 *   explain a thinner Log with the trading week instead of misreading it as
 *   Drift — see `buildSystemPrompt`. Every candidate is already open on
 *   `asOf`, so this is never about whether to recommend it tonight.
 * - The **Rejections block** carries every Rejection of an active Option as
 *   raw dated history (via `lib/rejections`), split into anchor-day Rejections
 *   (the snapshot's `rejectedTonight` group, from the model's frame) and the
 *   not-anchor-day ones — the latter carrying past *and* future-dated (Planned)
 *   Rejections; the model judges from the reasons and dates what is standing
 *   and what was one-off.
 * - The same Rejections are listed again **per Tag**, under each Tag of the
 *   rejected Option (ADR-0006 amended). Under one Option alone, a "too
 *   recent" was read as a fact about that Option, and the next Option of the
 *   same kind was ranked first the following day. The Tags come from the
 *   Catalog as it stands, not from the row's own copy.
 * - **Day notes** (PRD: Day notes) ride along as dated history — past and
 *   future, newest first, uncapped like the Log — with the anchor day's own
 *   note lifted out into `todayDayNote` as current context. They are facts
 *   about an evening, not an Option, so they never touch the candidate set or
 *   the numbering.
 * - The Restaurant **Places fields** (`address`, `phone`, `lat`, `lng`,
 *   `googlePlaceId`, `mapsUrl`) never enter — `SnapshotOption` has no slot for
 *   them, so they are excluded by construction.
 * - Household-authored text — names, Tags, notes, Rejection reasons, Day
 *   notes — rides as plain JSON string values; each system prompt names those
 *   fields as data, never instructions. Only the query is wrapped in
 *   `<household-text>` delimiters, since it is sent outside the JSON.
 * - **Backtest mode** (`backtest: true`) builds the snapshot as the Household
 *   saw the anchor day before deciding it, for scoring a ranking against what
 *   was eaten: Log entries and Rejections dated before `asOf` only — the
 *   anchor day's Picks stay candidates and its Rejections suppress nothing,
 *   both being the scorer's ground truth — and Day notes on or before `asOf`.
 *   The Catalog is whatever is passed in.
 */
export function buildSnapshot(input: {
  options: SnapshotOption[];
  logEntries: SnapshotLogEntry[];
  rejections: RejectionRow[];
  /**
   * Every Day note, any date (PRD: Day notes). Optional — omitted, the
   * snapshot simply carries none. Never touches the candidate set or numbering.
   */
  dayNotes?: { notedOn: string; note: string }[];
  /**
   * The anchor day — the Tonight screen's **Selected day** (ADR-0009). Drives
   * the snapshot's `today` field from the model's frame, the candidate-drop
   * rule (Options Picked, Rejected, or Closed on this day), and the Rejections
   * split (this day vs everything else). On the standard Tonight render this
   * is today; on a stepped Tonight it is the Selected day.
   */
  asOf: string;
  query: string;
  /** Cut the history to what was known before deciding `asOf` — see above. */
  backtest?: boolean;
}): BuiltSnapshot {
  const { options, asOf, query, backtest = false } = input;
  const logEntries = backtest
    ? input.logEntries.filter((entry) => entry.eatenOn < asOf)
    : input.logEntries;
  const rejections = backtest
    ? input.rejections.filter((row) => row.rejectedOn < asOf)
    : input.rejections;
  const dayNotes = (input.dayNotes ?? []).filter(
    (dayNote) => !backtest || dayNote.notedOn <= asOf,
  );

  // Every Option is numbered by its 1-based position in the Catalog ordered
  // alphabetically by name — the number is what the model sees instead of the
  // UUID. Numbering covers the *whole* Catalog, not just candidates, so an
  // Option Picked, Rejected, or Closed for the anchor day still has a stable
  // number for its Log and Rejection rows; the candidate `options` list below
  // simply omits it, leaving a gap.
  const byName = [...options].sort((a, b) => a.name.localeCompare(b.name));
  const indexByOptionId = new Map(byName.map((o, i) => [o.id, i + 1]));

  const { suppressedForAsOf, block } = partitionRejections(
    rejections,
    asOf,
    indexByOptionId,
  );

  // Every Option the Tonight picker suppresses for the anchor day — Picked,
  // Rejected, or Closed — leaves the candidate set; `suppressionsOn` is the
  // one statement of those rules, shared with `tonightForDay`. The Log below
  // is still built from the *full* `options` input, so a dropped Option's
  // eating history reads as history even though it is no longer a candidate.
  const suppressions = suppressionsOn({
    options: byName,
    pickedOptionIds: logEntries
      .filter((entry) => entry.eatenOn === asOf)
      .map((entry) => entry.optionId),
    rejectedOptionIds: suppressedForAsOf,
    day: asOf,
  });
  const candidates = byName.filter((o) => !suppressions.has(o.id));

  // The days each active Option was eaten, on or before the anchor day — the
  // source of every timing fact. An entry for an Option outside `options`
  // (archived) never counts, as for Recency.
  const eatenDaysByOption = new Map<string, Set<string>>(
    options.map((option) => [option.id, new Set()]),
  );
  for (const entry of logEntries) {
    if (entry.eatenOn > asOf) continue;
    eatenDaysByOption.get(entry.optionId)?.add(entry.eatenOn);
  }

  const modelOptions = candidates.map(
    (option): SnapshotModelOption => ({
      id: indexByOptionId.get(option.id)!,
      name: option.name,
      kind: option.kind,
      notes: option.notes,
      tags: option.tags,
      ...timingOf(eatenDaysByOption.get(option.id)!, asOf),
      ...weekdayCountsOf(eatenDaysByOption.get(option.id)!),
      // Omitted entirely — not an empty array — when the Restaurant has no
      // Closed days, so an always-open Restaurant and every Home meal cost
      // nothing.
      ...(option.closedDays.length > 0
        ? { closedDays: option.closedDays.map((day) => WEEKDAY_NAMES[day]) }
        : {}),
    }),
  );

  // Each Log entry is enriched with the eaten Option's name / kind / Tags —
  // the source `leanSnapshot` draws a dropped Option's entry from.
  const optionById = new Map(options.map((option) => [option.id, option]));
  const log = [...logEntries]
    // Newest dinner first — the most recent history reads at the top. Same-
    // date dinners tie-break on Option id, so the snapshot (and a Prepared
    // note's input hash) can't change with the order Postgres returns rows in.
    .sort(
      (a, b) =>
        b.eatenOn.localeCompare(a.eatenOn) ||
        a.optionId.localeCompare(b.optionId),
    )
    .flatMap((entry): SnapshotModelLogEntry[] => {
      const option = optionById.get(entry.optionId);
      if (!option) return [];
      return [
        {
          date: formatDateWithWeekday(entry.eatenOn),
          optionId: indexByOptionId.get(entry.optionId)!,
          name: option.name,
          kind: option.kind,
          tags: option.tags,
          note: entry.note,
        },
      ];
    });

  // The map back: only candidates are valid results, so a suppressed
  // Option's number is deliberately absent — `parseRankingText` drops it, and
  // `search` never appends it.
  const idByIndex = new Map(
    candidates.map((option) => [indexByOptionId.get(option.id)!, option.id]),
  );

  // Every Rejection of an active Option, newest first, with the Option's Tags
  // as the Catalog has them — the rows each Tag's entry lists.
  const rejectionsByDate = [...rejections]
    .filter((row) => optionById.has(row.optionId))
    .sort(
      (a, b) =>
        b.rejectedOn.localeCompare(a.rejectedOn) ||
        indexByOptionId.get(a.optionId)! - indexByOptionId.get(b.optionId)!,
    );

  // Each Tag's eat days are the union of its carriers' — a day two carriers
  // share counts once.
  const tagNames = [...new Set(options.flatMap((option) => option.tags))].sort(
    (a, b) => a.localeCompare(b),
  );
  const tags = Object.fromEntries(
    tagNames.map((tag): [string, SnapshotTag] => {
      const days = new Set(
        options
          .filter((option) => option.tags.includes(tag))
          .flatMap((option) => [...eatenDaysByOption.get(option.id)!]),
      );
      const tagRejections = rejectionsByDate
        .filter((row) => optionById.get(row.optionId)!.tags.includes(tag))
        .map(
          (row): SnapshotTagRejection => ({
            date: formatDateWithWeekday(row.rejectedOn),
            optionId: indexByOptionId.get(row.optionId)!,
            reason: row.reason,
          }),
        );
      return [
        tag,
        {
          ...timingOf(days, asOf),
          ...(tagRejections.length > 0 ? { rejections: tagRejections } : {}),
        },
      ];
    }),
  );

  return {
    snapshot: {
      today: formatDateWithWeekday(asOf),
      query: delimit(query),
      options: modelOptions,
      tags,
      log,
      rejections: block,
      dayNotes: [...dayNotes]
        .filter((dayNote) => dayNote.notedOn !== asOf)
        .sort((a, b) => b.notedOn.localeCompare(a.notedOn))
        .map((dayNote) => ({
          date: formatDateWithWeekday(dayNote.notedOn),
          note: dayNote.note,
        })),
      todayDayNote:
        dayNotes.find((dayNote) => dayNote.notedOn === asOf)?.note ?? null,
    },
    idByIndex,
    nameById: new Map(options.map((option) => [option.id, option.name])),
  };
}

/**
 * The timing facts of a set of eat days, all on or before `asOf`. Keys with
 * nothing to say are omitted rather than null, so a never-eaten Option costs
 * one field.
 */
function timingOf(eatenDays: Set<string>, asOf: string): SnapshotTiming {
  const days = [...eatenDays].map(epochDayFromSqlDate).sort((a, b) => a - b);
  if (days.length === 0) return { eaten: 0 };
  const gaps = days.slice(1).map((day, i) => day - days[i]);
  return {
    eaten: days.length,
    daysSinceLast: epochDayFromSqlDate(asOf) - days[days.length - 1],
    ...(gaps.length > 0 ? { intervalDays: intervalOf(gaps) } : {}),
  };
}

/**
 * The **Interval** of a history given as its gaps in days, oldest first: the
 * median gap of the current run — the gaps after the longest one — or of every
 * gap when the longest gap is the latest, so there is no run after it yet.
 *
 * The all-time median mis-stated an Option whose habit had changed: an Option
 * eaten twice a week one spring and every three weeks since still carried an
 * Interval of six days, and was ranked "due" every few days for months. The
 * longest break is where the habit last reset; what comes after it is the
 * habit as it stands. No tuning constant. With a tie for the longest gap, the
 * earliest one starts the run, so the run keeps the most eats.
 */
export function intervalOf(gaps: number[]): number {
  const longestAt = gaps.indexOf(Math.max(...gaps));
  const run = gaps.slice(longestAt + 1);
  return median(run.length > 0 ? run : gaps);
}

/** The middle value, or the rounded mean of the middle two. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * How many eat days fell on each weekday, in week order from Sunday, leaving
 * out weekdays with none — and the whole key when there are no eats.
 */
function weekdayCountsOf(
  eatenDays: Set<string>,
): Pick<SnapshotModelOption, "weekdays"> {
  if (eatenDays.size === 0) return {};
  const counts = WEEKDAY_NAMES.map(() => 0);
  for (const day of eatenDays) counts[weekdayFromSqlDate(day)] += 1;
  return {
    weekdays: Object.fromEntries(
      WEEKDAY_NAMES.flatMap((name, weekday) =>
        counts[weekday] > 0 ? [[name, counts[weekday]]] : [],
      ),
    ),
  };
}

/**
 * Build the AI snapshot for `asOf` — the anchor day (ADR-0009) — and `query`.
 * Owns the four reads `buildSnapshot` needs (the active Catalog and its
 * non-future Log via `getTonightData`, the full Log via
 * `getFullLogForSnapshot`, `getRejections`, and every Day note via
 * `getDayNotes`), the `SnapshotOption` /
 * `SnapshotLogEntry` mapping, and the `buildSnapshot` call itself.
 *
 * The Log passed to `buildSnapshot` is the **full** Log
 * (`getFullLogForSnapshot`), not `getTonightData`'s non-future `logEntries` —
 * the AI snapshot sees the household's near future (ADR-0008); only the
 * Catalog comes from `getTonightData`.
 *
 * `backtest` builds a past day as the Household saw it before deciding (see
 * `buildSnapshot`) — for the eval scripts only. The Catalog is still read as
 * it is now: an Option archived, added, or re-tagged since `asOf` is off.
 */
export async function snapshotForDay({
  asOf,
  query,
  backtest = false,
}: {
  asOf: string;
  query: string;
  backtest?: boolean;
}): Promise<BuiltSnapshot> {
  const [{ options }, logEntries, rejections, dayNotes] = await Promise.all([
    getTonightData(asOf),
    getFullLogForSnapshot(),
    getRejections(),
    getDayNotes(),
  ]);

  return buildSnapshot({
    options: options.map((option) => ({
      id: option.id,
      name: option.name,
      kind: option.kind,
      tags: option.tags,
      notes: option.notes,
      closedDays: option.closedDays,
    })),
    logEntries: logEntries.map((entry) => ({
      optionId: entry.optionId,
      eatenOn: entry.eatenOn,
      note: entry.note,
    })),
    rejections,
    dayNotes,
    asOf,
    query,
    backtest,
  });
}

/** An Option reached only through its history: not a candidate on the anchor day. */
type OtherOption = Pick<SnapshotModelOption, "id" | "name" | "kind" | "tags">;

/** A Rejection row cut to what changes from row to row — see `leanSnapshot`. */
type LeanRejection = Pick<SnapshotRejection, "date" | "optionId" | "reason">;

/** The snapshot with lean Log and Rejection rows — see `leanSnapshot`. */
export type LeanSnapshot = Omit<ModelSnapshot, "log" | "rejections"> & {
  otherOptions: OtherOption[];
  log: Pick<SnapshotModelLogEntry, "date" | "optionId" | "note">[];
  rejections: {
    rejectedTonight: LeanRejection[];
    notTodayRejections: LeanRejection[];
  };
};

/**
 * The snapshot as a model receives it — AI search and Prepared notes alike:
 * each Log row cut to its date, number, and note, each Rejection row to its
 * date, number, and reason. `buildSnapshot` copies the Option's name, kind,
 * and Tags onto every history row; on a 215-dinner, 90-Rejection snapshot
 * those copies were over half the tokens. Candidates already carry them in
 * `options`; an Option dropped for the anchor day (Picked, Rejected, Closed)
 * would leave its rows pointing nowhere, so its entry moves to `otherOptions`.
 * A Prepared note's input hash stays on the full snapshot, which this is
 * derived from.
 */
export function leanSnapshot(snapshot: ModelSnapshot): LeanSnapshot {
  const { today, query, options, tags, log, rejections, ...rest } = snapshot;
  const { rejectedTonight, notTodayRejections } = rejections;
  const candidates = new Set(options.map((option) => option.id));
  const others = new Map<number, OtherOption>();
  for (const { optionId: id, name, kind, tags } of [
    ...log,
    ...rejectedTonight,
    ...notTodayRejections,
  ]) {
    if (!candidates.has(id) && !others.has(id)) {
      others.set(id, { id, name, kind, tags });
    }
  }
  const cut = (rows: SnapshotRejection[]): LeanRejection[] =>
    rows.map(({ date, optionId, reason }) => ({ date, optionId, reason }));
  return {
    today,
    query,
    options,
    tags,
    otherOptions: [...others.values()].sort((a, b) => a.id - b.id),
    log: log.map(({ date, optionId, note }) => ({ date, optionId, note })),
    rejections: {
      rejectedTonight: cut(rejectedTonight),
      notTodayRejections: cut(notTodayRejections),
    },
    ...rest,
  };
}
