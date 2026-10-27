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
import { WEEKDAY_NAMES } from "./local-day";
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

/** One Option in the model-input snapshot — a candidate to rank, no recency. */
export type SnapshotModelOption = {
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
 * - **No pre-computed recency.** The snapshot carries plain dated history; the
 *   model re-derives recency itself and spends its reasoning on the patterns
 *   recency misses. Do not re-add recency integers — ADR-0005.
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
}): BuiltSnapshot {
  const { options, logEntries, rejections, dayNotes = [], asOf, query } =
    input;

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
  const modelOptions = candidates.map(
    (option): SnapshotModelOption => ({
      id: indexByOptionId.get(option.id)!,
      name: option.name,
      kind: option.kind,
      notes: option.notes,
      tags: option.tags,
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

  return {
    snapshot: {
      today: formatDateWithWeekday(asOf),
      query: delimit(query),
      options: modelOptions,
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
 */
export async function snapshotForDay({
  asOf,
  query,
}: {
  asOf: string;
  query: string;
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
  const { today, query, options, log, rejections, ...rest } = snapshot;
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
    otherOptions: [...others.values()].sort((a, b) => a.id - b.id),
    log: log.map(({ date, optionId, note }) => ({ date, optionId, note })),
    rejections: {
      rejectedTonight: cut(rejectedTonight),
      notTodayRejections: cut(notTodayRejections),
    },
    ...rest,
  };
}
