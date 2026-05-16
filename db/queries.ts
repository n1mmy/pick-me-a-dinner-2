import { and, asc, desc, eq, lte } from "drizzle-orm";
import { db } from "./index";
import { dinnerLog, optionTags, options, tags, type Option } from "./schema";
import type { RankOption } from "../lib/ranking";

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

/** A non-future `dinner_log` row, narrowed to what the ranking engine needs. */
export type TonightLogRow = { optionId: string; eatenOn: string };

/**
 * Everything the Tonight screen needs to rank the Catalog (ADR-0003): the
 * active Options with their Tags, and the non-future Log entries. `eaten_on` is
 * filtered against `todaySqlDate` — the Household's calendar day in `APP_TZ`,
 * computed by the caller — so a Planned dinner never reaches the ranking. The
 * Score itself is computed in the pure `lib/ranking` module, not in SQL.
 */
export async function getTonightData(todaySqlDate: string): Promise<{
  options: RankOption[];
  logEntries: TonightLogRow[];
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
    .select({ optionId: dinnerLog.optionId, eatenOn: dinnerLog.eatenOn })
    .from(dinnerLog)
    .innerJoin(options, eq(dinnerLog.optionId, options.id))
    .where(and(lte(dinnerLog.eatenOn, todaySqlDate), eq(options.active, true)));

  return {
    options: active.map((option) => ({
      id: option.id,
      name: option.name,
      kind: option.kind,
      tags: tagsByOption.get(option.id) ?? [],
    })),
    logEntries,
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
