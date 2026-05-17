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
import type { TodayLogEntry } from "../lib/tonights-dinner";

/** An Option together with the names of the Tags attached to it. */
export type OptionWithTags = Option & { tags: string[] };

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

  const allTags = await db
    .select({ name: tags.name })
    .from(tags)
    .orderBy(asc(tags.name));

  const withTags = (option: Option): OptionWithTags => ({
    ...option,
    tags: tagsByOption.get(option.id) ?? [],
  });

  return {
    home: active.filter((o) => o.kind === "home").map(withTags),
    restaurants: active.filter((o) => o.kind === "restaurant").map(withTags),
    allTags: allTags.map((t) => t.name),
  };
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

/** An Option reduced to a choice for the Log edit form's Option picker. */
export type OptionChoice = { id: string; name: string; kind: "home" | "restaurant" };

/**
 * Every Option — Active and Archived alike — as picker choices for the Log
 * edit form. Archived Options are included so an entry already logged against
 * one stays selectable when its row is edited.
 */
export async function getOptionChoices(): Promise<OptionChoice[]> {
  return db
    .select({ id: options.id, name: options.name, kind: options.kind })
    .from(options)
    .orderBy(asc(options.name));
}
