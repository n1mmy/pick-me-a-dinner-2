import { and, asc, desc, eq, lte } from "drizzle-orm";
import { db } from "./index";
import {
  dinnerLog,
  optionTags,
  options,
  rejections,
  tags,
  type Option,
} from "./schema";
import type { RankOption } from "../lib/ranking";
import type { RejectionRow } from "../lib/rejections";
import type { TodayLogEntry } from "../lib/tonights-dinner";

/** An Option together with the names of the Tags attached to it. */
export type OptionWithTags = Option & { tags: string[] };

/**
 * The whole-Catalog `option_tags ⋈ tags` join, reduced to a `Map` of Tag names
 * keyed by Option id. The Tag names of each Option come out ordered by name —
 * the join is sorted by `tags.name` — and an Option with no Tags is simply
 * absent from the Map. `getActiveCatalog`, `getTonightData`, and `getRejections`
 * all need exactly this whole-Catalog grouping, so it lives here once;
 * `getOptionById`'s single-Option variant is a deliberately narrower query and
 * is left separate.
 */
async function tagNamesByOption(): Promise<Map<string, string[]>> {
  const links = await db
    .select({ optionId: optionTags.optionId, name: tags.name })
    .from(optionTags)
    .innerJoin(tags, eq(optionTags.tagId, tags.id))
    .orderBy(asc(tags.name));

  const tagsByOption = new Map<string, string[]>();
  for (const link of links) {
    const list = tagsByOption.get(link.optionId) ?? [];
    list.push(link.name);
    tagsByOption.set(link.optionId, list);
  }
  return tagsByOption;
}

/**
 * The default Catalog list: active Options only (Archived ones drop out), split
 * into the two kinds and ordered by name. Each Option carries its attached Tag
 * names, and `allTags` is the full Tag vocabulary the form's autocomplete
 * suggests from. The ranking is a separate concern.
 */
export async function getActiveCatalog(): Promise<{
  home: OptionWithTags[];
  restaurants: OptionWithTags[];
  allTags: string[];
}> {
  const active = await db
    .select()
    .from(options)
    .where(eq(options.active, true))
    .orderBy(asc(options.name));

  const tagsByOption = await tagNamesByOption();

  const withTags = (option: Option): OptionWithTags => ({
    ...option,
    tags: tagsByOption.get(option.id) ?? [],
  });

  return {
    home: active.filter((o) => o.kind === "home").map(withTags),
    restaurants: active.filter((o) => o.kind === "restaurant").map(withTags),
    allTags: await getAllTags(),
  };
}

/** An Archived Option reduced to what the Catalog's "Archived" disclosure links. */
export type ArchivedOption = { id: string; name: string };

/**
 * The Archived Options for the Catalog screen's "Archived" disclosure (PRD:
 * Option detail page) — `active = false` Options ordered by name, narrowed to
 * the id and name the disclosure renders as links to each detail page. It is
 * the counterpart of `getActiveCatalog`'s active list: the disclosure is pinned
 * collapsed below it, so an Archived Option stays reachable again.
 */
export async function getArchivedOptions(): Promise<ArchivedOption[]> {
  return db
    .select({ id: options.id, name: options.name })
    .from(options)
    .where(eq(options.active, false))
    .orderBy(asc(options.name));
}

/**
 * The full Tag vocabulary, ordered by name — the autocomplete source the
 * Option form suggests from. `getActiveCatalog` returns it for the Catalog
 * screen; the Option detail page's inline Edit form loads it on its own.
 */
export async function getAllTags(): Promise<string[]> {
  const rows = await db
    .select({ name: tags.name })
    .from(tags)
    .orderBy(asc(tags.name));
  return rows.map((row) => row.name);
}

/**
 * A SQL `uuid` column rejects a non-UUID string at the database, so a junk
 * route param must be screened before it reaches a query — `getOptionById`
 * turns one into a clean `null` (a not-found page) instead of a 500.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One Option by id with its Tag names, or `null` when no `options` row matches
 * — the not-found case the Option detail page's route renders as a 404 (a
 * stale link to a Deleted Option, or a malformed id). Unlike `getActiveCatalog`
 * this is not filtered to active Options: the detail page serves an Archived
 * Option too.
 */
export async function getOptionById(
  id: string,
): Promise<OptionWithTags | null> {
  if (!UUID_RE.test(id)) return null;

  const [row] = await db.select().from(options).where(eq(options.id, id));
  if (!row) return null;

  const links = await db
    .select({ name: tags.name })
    .from(optionTags)
    .innerJoin(tags, eq(optionTags.tagId, tags.id))
    .where(eq(optionTags.optionId, id))
    .orderBy(asc(tags.name));

  return { ...row, tags: links.map((link) => link.name) };
}

/**
 * A ranking Option plus its free-text `notes`. The ranking ignores `notes` —
 * `rankTonight` still receives exactly a `RankOption` — but the AI search
 * snapshot builder needs it (PRD: AI search).
 */
export type TonightOption = RankOption & { notes: string | null };

/**
 * A non-future `dinner_log` row, narrowed to what Tonight needs. The ranking
 * ignores `note`; the AI search snapshot builder uses it.
 */
export type TonightLogRow = {
  optionId: string;
  eatenOn: string;
  note: string | null;
};

/**
 * Everything the Tonight screen needs to rank the Catalog (ADR-0003): the
 * active Options with their Tags, and the non-future Log entries. `eaten_on` is
 * filtered against `todaySqlDate` — the Household's calendar day in `APP_TZ`,
 * computed by the caller — so a Planned dinner never reaches the ranking. The
 * Score itself is computed in the pure `lib/ranking` module, not in SQL.
 *
 * Each Option also carries its `notes` and each Log entry its `note` — text the
 * AI search snapshot builder needs (PRD: AI search). Each Option additionally
 * carries `url` and `phone` (both nullable; `phone` is always null for a Home
 * meal) — the fields the decided view's Menu / Call / Recipe action buttons
 * render from (PRD: Tonight — decided mode). The ranking input is otherwise
 * unchanged: `rankTonight` reads only the recency-relevant `RankOption` fields.
 *
 * `todayEntries` is the `dinner_log` rows dated *today* — with their `id` and
 * `created_at` — which the decided mode of Tonight needs (PRD: Tonight —
 * decided mode): `created_at` gives the pick order and `id` is the handle the
 * decided row's "Remove" deletes.
 */
export async function getTonightData(todaySqlDate: string): Promise<{
  options: TonightOption[];
  logEntries: TonightLogRow[];
  todayEntries: TodayLogEntry[];
}> {
  const active = await db
    .select()
    .from(options)
    .where(eq(options.active, true))
    .orderBy(asc(options.name));

  const tagsByOption = await tagNamesByOption();

  // Only active Options' Log rows feed the ranking. Archiving an Option is rare
  // and must not move the ranking — its history neither counts as per-Option
  // recency (it is not in the ranked set) nor as per-Tag recency (review fix
  // F5 / review B3). The join makes that exclusion explicit at the query.
  const logEntries = await db
    .select({
      optionId: dinnerLog.optionId,
      eatenOn: dinnerLog.eatenOn,
      note: dinnerLog.note,
    })
    .from(dinnerLog)
    .innerJoin(options, eq(dinnerLog.optionId, options.id))
    .where(and(lte(dinnerLog.eatenOn, todaySqlDate), eq(options.active, true)));

  // Today's Log entries — the Picks that put Tonight into decided mode. An
  // entry for a since-Archived Option is harmless: `splitTonight` skips any
  // Option not in the ranked set.
  const todayEntries = await db
    .select({
      id: dinnerLog.id,
      optionId: dinnerLog.optionId,
      createdAt: dinnerLog.createdAt,
    })
    .from(dinnerLog)
    .where(eq(dinnerLog.eatenOn, todaySqlDate));

  return {
    options: active.map((option) => ({
      id: option.id,
      name: option.name,
      kind: option.kind,
      tags: tagsByOption.get(option.id) ?? [],
      notes: option.notes,
      url: option.url,
      phone: option.phone,
    })),
    logEntries,
    todayEntries,
  };
}

/**
 * The full Log for the AI search snapshot (PRD: Dated Rejections — AI snapshot,
 * ADR-0008): every `dinner_log` row of an **active** Option, **regardless of
 * date** — past entries and future-dated ones (Planned dinners) alike. It is
 * the AI-snapshot counterpart of `getTonightData`'s `logEntries`, which filters
 * `eaten_on <= today` for the deterministic ranking. The AI snapshot sees the
 * Household's near future (ADR-0008); the deterministic ranking still gets the
 * non-future Log from `getTonightData`, so only the AI path sees the future.
 * Only active Options are joined, mirroring how `getTonightData` already
 * excludes Archived Options' Log entries from an AI search.
 */
export async function getFullLogForSnapshot(): Promise<TonightLogRow[]> {
  return db
    .select({
      optionId: dinnerLog.optionId,
      eatenOn: dinnerLog.eatenOn,
      note: dinnerLog.note,
    })
    .from(dinnerLog)
    .innerJoin(options, eq(dinnerLog.optionId, options.id))
    .where(eq(options.active, true));
}

/** A Log entry joined to its Option, narrowed to what the Log screen renders. */
export type LogEntryRow = {
  id: string;
  optionId: string;
  optionName: string;
  kind: "home" | "restaurant";
  /** `eaten_on` as a SQL `date` string (`"YYYY-MM-DD"`); may be past or future. */
  eatenOn: string;
  note: string | null;
};

/**
 * The full Log for the Log screen: every Log entry — past, today, and future
 * (Planned dinners) — joined to its Option, ordered newest `eaten_on` first.
 * The screen splits future from non-future and groups each side into Dinners.
 */
export async function getLog(): Promise<LogEntryRow[]> {
  return db
    .select({
      id: dinnerLog.id,
      optionId: dinnerLog.optionId,
      optionName: options.name,
      kind: options.kind,
      eatenOn: dinnerLog.eatenOn,
      note: dinnerLog.note,
    })
    .from(dinnerLog)
    .innerJoin(options, eq(dinnerLog.optionId, options.id))
    .orderBy(desc(dinnerLog.eatenOn), asc(options.name));
}

/**
 * Every Log entry for one Option — past, today, and future (its Planned
 * dinners) — joined to its Option, ordered newest `eaten_on` first. The Option
 * detail page's History section splits and groups this with
 * `lib/dinner-grouping`. Unlike `getLog` it is scoped to a single Option id,
 * and unlike the Tonight queries it is not filtered to active Options — the
 * detail page serves an Archived Option's history too.
 */
export async function getOptionLog(optionId: string): Promise<LogEntryRow[]> {
  return db
    .select({
      id: dinnerLog.id,
      optionId: dinnerLog.optionId,
      optionName: options.name,
      kind: options.kind,
      eatenOn: dinnerLog.eatenOn,
      note: dinnerLog.note,
    })
    .from(dinnerLog)
    .innerJoin(options, eq(dinnerLog.optionId, options.id))
    .where(eq(dinnerLog.optionId, optionId))
    .orderBy(desc(dinnerLog.eatenOn));
}

/**
 * A Rejection the Household made today, narrowed to what the "Rejected
 * tonight" disclosure renders and to the per-day suppression set the Tonight
 * page derives from it (PRD: Rejections on Tonight).
 */
export type TodayRejection = {
  /** The `rejections` row id — the handle the "Bring back" action deletes by. */
  id: string;
  optionId: string;
  optionName: string;
  /** The optional short reason; `null` when the Household gave none. */
  reason: string | null;
};

/**
 * The Household's Rejections made *today* — `rejections` rows whose
 * `rejected_on` equals `todaySqlDate`, the Household's calendar day in
 * `APP_TZ` — joined to their Option, newest first (PRD: Rejections on
 * Tonight). The Tonight page uses one result for both jobs: the per-day
 * suppression set — Options dropped from the deterministic picker, a
 * presentation filter that leaves `lib/ranking` and the Score untouched
 * (ADR-0003, ADR-0006) — and the "Rejected tonight" disclosure list. Only
 * active Options are joined, mirroring how the Log already excludes Archived
 * Options. Because the query is keyed on today's date, a new calendar day
 * empties the result on its own and a rejected Option reappears with no
 * day-boundary logic.
 */
export async function getTodayRejections(
  todaySqlDate: string,
): Promise<TodayRejection[]> {
  return db
    .select({
      id: rejections.id,
      optionId: rejections.optionId,
      optionName: options.name,
      reason: rejections.reason,
    })
    .from(rejections)
    .innerJoin(options, eq(rejections.optionId, options.id))
    .where(
      and(eq(rejections.rejectedOn, todaySqlDate), eq(options.active, true)),
    )
    .orderBy(desc(rejections.createdAt));
}

/**
 * The Household's full Rejection history for the AI search snapshot (PRD:
 * Rejections on Tonight, ADR-0006) — every `rejections` row joined to its
 * Option, with the Option's name / kind / Tags carried for snapshot
 * readability, ordered newest `rejected_on` first (`created_at` breaks a
 * same-day tie). Only Rejections of **active** Options are returned, mirroring
 * how `getTonightData` already excludes Archived Options' Log entries: an
 * Archived Option is off Tonight, so its Rejections must not shape an AI
 * search either. `lib/rejections.ts` partitions the result into today's
 * Rejections — dropped from the candidate set — and earlier ones — still
 * candidates. Uncapped by choice: the table is single-household-small and
 * ADR-0006 stores Rejections flat; revisit only if a prompt genuinely bloats.
 */
export async function getRejections(): Promise<RejectionRow[]> {
  const rows = await db
    .select({
      optionId: rejections.optionId,
      reason: rejections.reason,
      rejectedOn: rejections.rejectedOn,
      optionName: options.name,
      kind: options.kind,
    })
    .from(rejections)
    .innerJoin(options, eq(rejections.optionId, options.id))
    .where(eq(options.active, true))
    .orderBy(desc(rejections.rejectedOn), desc(rejections.createdAt));

  const tagsByOption = await tagNamesByOption();

  return rows.map((row) => ({
    optionId: row.optionId,
    reason: row.reason,
    rejectedOn: row.rejectedOn,
    optionName: row.optionName,
    kind: row.kind,
    tags: tagsByOption.get(row.optionId) ?? [],
  }));
}

/** A Rejection joined to its Option, narrowed to what the Log screen renders. */
export type LogRejectionRow = {
  id: string;
  optionId: string;
  optionName: string;
  kind: "home" | "restaurant";
  /** `rejected_on` as a SQL `date` string (`"YYYY-MM-DD"`); may be past or future. */
  rejectedOn: string;
  /** The optional short reason; `null` when the Household gave none. */
  reason: string | null;
};

/**
 * The full Rejection history for the Log screen (PRD: Dated Rejections): every
 * `rejections` row — past, today, and future (Planned rejections) — joined to
 * its Option, ordered newest `rejected_on` first. It is the counterpart of
 * `getLog`: the Log screen interleaves these into its date-groups, splitting
 * future from non-future. Unlike `getRejections` (the AI-snapshot feed) it is
 * not filtered to active Options — the Log shows an Archived Option's
 * Rejections in its history too.
 */
export async function getLogRejections(): Promise<LogRejectionRow[]> {
  return db
    .select({
      id: rejections.id,
      optionId: rejections.optionId,
      optionName: options.name,
      kind: options.kind,
      rejectedOn: rejections.rejectedOn,
      reason: rejections.reason,
    })
    .from(rejections)
    .innerJoin(options, eq(rejections.optionId, options.id))
    .orderBy(desc(rejections.rejectedOn), asc(options.name));
}

/**
 * Every Rejection ever made for one Option — `rejections` rows scoped to the
 * given Option id, ordered newest `rejected_on` first (`created_at` breaks a
 * same-day tie). The Option detail page's Rejections section lists these (PRD:
 * Dated Rejections — Option detail page parity), reusing the Log screen's
 * `RejectionRow` — so this returns the same `LogRejectionRow` shape, each row
 * joined to its Option. Unlike `getRejections` it is scoped to one Option, and
 * unlike the Tonight queries it is not filtered to active Options — the detail
 * page serves an Archived Option's Rejection history too.
 */
export async function getOptionRejections(
  optionId: string,
): Promise<LogRejectionRow[]> {
  return db
    .select({
      id: rejections.id,
      optionId: rejections.optionId,
      optionName: options.name,
      kind: options.kind,
      rejectedOn: rejections.rejectedOn,
      reason: rejections.reason,
    })
    .from(rejections)
    .innerJoin(options, eq(rejections.optionId, options.id))
    .where(eq(rejections.optionId, optionId))
    .orderBy(desc(rejections.rejectedOn), desc(rejections.createdAt));
}

/** An Option reduced to a choice for the Log edit form's Option picker. */
export type OptionChoice = { id: string; name: string; kind: "home" | "restaurant" };

/**
 * The Active Options as picker choices for the Log's `OptionCombobox` — every
 * `active = true` Option ordered by name. Archived Options are deliberately
 * excluded: the picker offers only Options the Household still uses. The dinner
 * edit form seeds its displayed name from the Log entry itself, so an entry
 * logged against a now-Archived Option still shows that Option without this
 * query carrying Archived rows.
 */
export async function getOptionChoices(): Promise<OptionChoice[]> {
  return db
    .select({ id: options.id, name: options.name, kind: options.kind })
    .from(options)
    .where(eq(options.active, true))
    .orderBy(asc(options.name));
}
