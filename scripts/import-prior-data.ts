/**
 * One-off prior-version data import (issue 09, PRD "Data import").
 *
 * Imports the prior Prisma app's real Catalog and Log history — tables
 * `Meal` (7), `Restaurant` (21), `Dinner` (67) — into the v1 schema. This data
 * is the v1 starting point; there is no hand-seed step.
 *
 * The import runs inside a SINGLE transaction: any failure rolls the whole
 * thing back, leaving the DB untouched, so the offending row can be fixed and
 * the script simply re-run from scratch. It targets a fresh, empty,
 * freshly-migrated database — there is no upsert / idempotency machinery.
 *
 * Run it with the prior tables exported verbatim to one JSON file:
 *
 *   npx tsx scripts/import-prior-data.ts ./prior-data.json
 *
 * where the JSON is `{ meals: PriorMeal[], restaurants: PriorRestaurant[],
 * dinners: PriorDinner[] }`. `DATABASE_URL` and `APP_TZ` are read from `.env`.
 *
 * Producing that JSON is a manual one-off: dump the prior Prisma DB's three
 * tables, with the JSON keys matching the Prior* types below. The prior
 * table/column names are case-sensitive, so they stay double-quoted. psql's
 * `\copy` writes the file client-side — run this against the prior DB (escape
 * the inner `"` if you pass the query through `psql -c "..."`):
 *
 *   \copy (SELECT json_build_object(
 *     'meals',       (SELECT json_agg(json_build_object(
 *       'id',id,'name',name,'notes',notes,'createdAt',"createdAt",
 *       'hidden',hidden,'tags',tags)) FROM "Meal"),
 *     'restaurants', (SELECT json_agg(json_build_object(
 *       'id',id,'name',name,'notes',notes,'createdAt',"createdAt",
 *       'hidden',hidden,'tags',tags,'phoneNumber',"phoneNumber",
 *       'orderUrl',"orderUrl",'menuUrl',"menuUrl")) FROM "Restaurant"),
 *     'dinners',     (SELECT json_agg(json_build_object(
 *       'id',id,'date',date,'notes',notes,'type',type,
 *       'mealId',"mealId",'restaurantId',"restaurantId")) FROM "Dinner"))
 *   ) TO 'prior-data.json'
 *
 * prior-data.json holds real personal data — delete it after the import.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { db } from "../db";
import { dinnerLog, optionTags, options, tags } from "../db/schema";
import { normalizeTag } from "../lib/normalize-tag";

/** A row of the prior app's `Meal` table — a home-cooked meal. */
export type PriorMeal = {
  id: string;
  name: string;
  notes: string | null;
  createdAt: string;
  hidden: boolean;
  tags: string[];
};

/** A row of the prior app's `Restaurant` table. */
export type PriorRestaurant = {
  id: string;
  name: string;
  notes: string | null;
  createdAt: string;
  hidden: boolean;
  tags: string[];
  phoneNumber: string | null;
  orderUrl: string | null;
  menuUrl: string | null;
};

/** A row of the prior app's `Dinner` table — one logged evening's eating. */
export type PriorDinner = {
  id: string;
  /** A date string; only the `YYYY-MM-DD` head is used for `eaten_on`. */
  date: string;
  notes: string | null;
  /** `"meal"` | `"restaurant"` — dropped in v1, redundant with the Option's kind. */
  type: string;
  mealId: string | null;
  restaurantId: string | null;
};

/** The prior app's three tables, exported verbatim to JSON. */
export type PriorData = {
  meals: PriorMeal[];
  restaurants: PriorRestaurant[];
  dinners: PriorDinner[];
};

type OptionInsert = typeof options.$inferInsert;
type TagInsert = typeof tags.$inferInsert;
type OptionTagInsert = typeof optionTags.$inferInsert;
type DinnerLogInsert = typeof dinnerLog.$inferInsert;

/** The v1 rows to insert, fully wired with fresh uuids — the output of mapping. */
export type ImportRows = {
  options: OptionInsert[];
  tags: TagInsert[];
  optionTags: OptionTagInsert[];
  dinnerLog: DinnerLogInsert[];
};

/** Summary counts of a completed import, for the operator's console output. */
export type ImportSummary = { options: number; tags: number; dinnerLog: number };

/**
 * The UTC offset of `timeZone` at the instant `instant`, in milliseconds
 * (negative west of UTC). Read by formatting the instant's wall-clock in the
 * zone, so it is correct on either side of a DST transition.
 */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const v = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wallClockAsUtc = Date.UTC(
    v("year"),
    v("month") - 1,
    v("day"),
    v("hour"),
    v("minute"),
    v("second"),
  );
  return wallClockAsUtc - instant.getTime();
}

/**
 * The instant of local midnight on `sqlDate` (`YYYY-MM-DD`) in `timeZone`.
 *
 * Used to set `dinner_log.created_at` — the prior schema had no per-entry
 * timestamp, so each Log entry is anchored at midnight of its own `eaten_on`
 * date in the Household's zone. Resolved in two passes so a date whose
 * midnight straddles a DST change still lands on the correct offset.
 */
export function localMidnightUtc(sqlDate: string, timeZone: string): Date {
  const [year, month, day] = sqlDate.slice(0, 10).split("-").map(Number);
  const naiveMidnightUtc = Date.UTC(year, month - 1, day);
  let offset = zoneOffsetMs(new Date(naiveMidnightUtc), timeZone);
  offset = zoneOffsetMs(new Date(naiveMidnightUtc - offset), timeZone);
  return new Date(naiveMidnightUtc - offset);
}

/**
 * Map the prior app's `Meal` / `Restaurant` / `Dinner` rows into v1
 * `options` / `tags` / `option_tags` / `dinner_log` rows.
 *
 * Pure: it allocates fresh uuids, rewires every `Dinner` FK to the mapped
 * Option, inverts `hidden` to `active`, coalesces `orderUrl`/`menuUrl` into one
 * `url`, and normalizes Tags via the shared `normalizeTag` helper — deduped
 * across every Option so the `tags.lower(name)` unique index never collides.
 * A `Dinner` with an unresolvable FK throws before any DB write happens.
 */
export function mapPriorData(prior: PriorData, timeZone: string): ImportRows {
  const optionRows: OptionInsert[] = [];
  const tagRows: TagInsert[] = [];
  const optionTagRows: OptionTagInsert[] = [];
  const dinnerLogRows: DinnerLogInsert[] = [];

  // Prior text cuid -> fresh Option uuid, used to rewire the Dinner FKs.
  const optionIdByPriorId = new Map<string, string>();
  // Normalized Tag name -> fresh Tag uuid, deduped across every Option.
  const tagIdByName = new Map<string, string>();

  /** Resolve a normalized Tag name to a uuid, creating the Tag row on first sight. */
  function tagId(name: string): string {
    const existing = tagIdByName.get(name);
    if (existing) return existing;
    const id = randomUUID();
    tagIdByName.set(name, id);
    tagRows.push({ id, name });
    return id;
  }

  /** Link an Option to its source Tag strings — normalized, and deduped per Option. */
  function attachTags(optionId: string, rawTags: string[]): void {
    const names = new Set(
      rawTags.map(normalizeTag).filter((name) => name.length > 0),
    );
    for (const name of names) {
      optionTagRows.push({ optionId, tagId: tagId(name) });
    }
  }

  for (const meal of prior.meals) {
    const id = randomUUID();
    optionIdByPriorId.set(meal.id, id);
    optionRows.push({
      id,
      name: meal.name,
      kind: "home",
      // A Home meal carries no url in the prior schema (recipe links are v1-only).
      url: null,
      notes: meal.notes,
      active: !meal.hidden,
      createdAt: new Date(meal.createdAt),
    });
    attachTags(id, meal.tags);
  }

  for (const restaurant of prior.restaurants) {
    const id = randomUUID();
    optionIdByPriorId.set(restaurant.id, id);
    optionRows.push({
      id,
      name: restaurant.name,
      kind: "restaurant",
      // orderUrl and menuUrl are never both populated — coalesce to one url.
      url: restaurant.orderUrl ?? restaurant.menuUrl ?? null,
      notes: restaurant.notes,
      active: !restaurant.hidden,
      createdAt: new Date(restaurant.createdAt),
      phone: restaurant.phoneNumber,
      // Absent from the prior schema — populated later via Places autofill.
      address: null,
      lat: null,
      lng: null,
      googlePlaceId: null,
      mapsUrl: null,
    });
    attachTags(id, restaurant.tags);
  }

  for (const dinner of prior.dinners) {
    const priorOptionId = dinner.mealId ?? dinner.restaurantId;
    if (!priorOptionId) {
      throw new Error(
        `Dinner ${dinner.id} references neither a Meal nor a Restaurant`,
      );
    }
    const optionId = optionIdByPriorId.get(priorOptionId);
    if (!optionId) {
      throw new Error(
        `Dinner ${dinner.id} references unknown Option ${priorOptionId}`,
      );
    }
    const eatenOn = dinner.date.slice(0, 10);
    dinnerLogRows.push({
      id: randomUUID(),
      optionId,
      eatenOn,
      note: dinner.notes,
      createdAt: localMidnightUtc(eatenOn, timeZone),
    });
  }

  return {
    options: optionRows,
    tags: tagRows,
    optionTags: optionTagRows,
    dinnerLog: dinnerLogRows,
  };
}

/**
 * Map and insert the prior data in one transaction. Mapping runs first, outside
 * the transaction, so a bad foreign key fails fast without touching the DB; the
 * inserts then all commit together, or — on any failure — all roll back, so a
 * re-run after fixing the offending row starts from a clean slate.
 */
export async function runImport(
  prior: PriorData,
  timeZone: string,
): Promise<ImportSummary> {
  const rows = mapPriorData(prior, timeZone);
  await db.transaction(async (tx) => {
    if (rows.options.length > 0) await tx.insert(options).values(rows.options);
    if (rows.tags.length > 0) await tx.insert(tags).values(rows.tags);
    if (rows.optionTags.length > 0)
      await tx.insert(optionTags).values(rows.optionTags);
    if (rows.dinnerLog.length > 0)
      await tx.insert(dinnerLog).values(rows.dinnerLog);
  });
  return {
    options: rows.options.length,
    tags: rows.tags.length,
    dinnerLog: rows.dinnerLog.length,
  };
}

async function main(): Promise<void> {
  const sourcePath = process.argv[2] ?? "prior-data.json";
  const prior = JSON.parse(readFileSync(sourcePath, "utf8")) as PriorData;
  const timeZone = process.env.APP_TZ ?? "UTC";
  const summary = await runImport(prior, timeZone);
  console.log(
    `Imported ${summary.options} Options, ${summary.tags} Tags, ` +
      `${summary.dinnerLog} Log entries from ${sourcePath}.`,
  );
}

// Run only when invoked directly — never when imported by the test suite.
if (/import-prior-data\.[tj]s$/.test(process.argv[1] ?? "")) {
  main().catch((error) => {
    console.error("Import failed — the database was left untouched.");
    console.error(error);
    process.exit(1);
  });
}
