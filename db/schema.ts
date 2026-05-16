import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * v1 schema — 4 tables (ADR-0001, plan §5). Both Home meals and Restaurants
 * live in one `options` table discriminated by `kind`; `dinner_log` is the
 * single source of truth for all recency.
 */

/** A Home meal or a Restaurant — the two kinds of Option. */
export const optionKind = pgEnum("option_kind", ["home", "restaurant"]);

/** The Catalog: every Option the Household can pick for dinner. */
export const options = pgTable("options", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  kind: optionKind("kind").notNull(),
  /** Menu / delivery / recipe link. */
  url: text("url"),
  notes: text("notes"),
  /** Archived Options set this false: hidden from Tonight, kept in the Log. */
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  // Restaurant-only fields — always null for a Home meal.
  address: text("address"),
  phone: text("phone"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  googlePlaceId: text("google_place_id"),
  mapsUrl: text("maps_url"),
});

/** A Catalog row as stored — a Home meal or a Restaurant. */
export type Option = typeof options.$inferSelect;

/**
 * Free-form, case-insensitive Tags. The unique index on `lower(name)` enforces
 * case-insensitive uniqueness without the `citext` extension.
 */
export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
  },
  (t) => [uniqueIndex("tags_lower_name_unique").on(sql`lower(${t.name})`)],
);

/** Option-to-Tag M2M. Both FKs cascade so cleanup never leaves dangling rows. */
export const optionTags = pgTable(
  "option_tags",
  {
    optionId: uuid("option_id")
      .notNull()
      .references(() => options.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.optionId, t.tagId] })],
);

/**
 * The Log: one row per Log entry. `option_id` is ON DELETE RESTRICT so a
 * logged Option can only be Archived, never hard-deleted. `eaten_on` may be
 * past, today, or future (a Planned dinner); `(option_id, eaten_on)` is unique
 * so the same Option cannot be logged twice on one date.
 */
export const dinnerLog = pgTable(
  "dinner_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    optionId: uuid("option_id")
      .notNull()
      .references(() => options.id, { onDelete: "restrict" }),
    eatenOn: date("eaten_on").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("dinner_log_option_eaten_on_unique").on(t.optionId, t.eatenOn)],
);
