import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
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
  /**
   * The weekdays a Restaurant is closed, `0`–`6` with `0` = Sunday — the same
   * indexing as the `WEEKDAYS` table in `lib/snapshot-format.ts` and
   * `weekdayFromSqlDate` in `lib/local-day.ts`. Empty means open all week
   * (the default, so every pre-existing row and every Home meal behaves
   * exactly as before). Restaurant-only, like `address` / `phone` / `lat`; a
   * Home meal leaves it empty. Not validated against all seven days — a
   * temporary full-week closure is legitimate (Archive is for permanent).
   */
  closedDays: integer("closed_days")
    .array()
    .notNull()
    .default(sql`'{}'::integer[]`),
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

/**
 * Option-to-Tag M2M. Both FKs cascade so cleanup never leaves dangling rows.
 * The composite PK covers `option_id`-leading lookups; `tag_id` gets its own
 * index because Postgres does not auto-index FK columns and the per-Tag
 * recency join filters by `tag_id` (review fix F9).
 */
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
  (t) => [
    primaryKey({ columns: [t.optionId, t.tagId] }),
    index("option_tags_tag_id_idx").on(t.tagId),
  ],
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

/**
 * Rejections (PRD: Rejections on Tonight, ADR-0006). A Rejection records that
 * the Household passed an Option over for one night's decision, carrying an
 * optional short reason.
 *
 * `option_id` is ON DELETE CASCADE: a Rejection is light history and must never
 * block an Option's hard-delete (allowed only for an Option with no Log entries
 * — ADR-0001); a Rejection of a hard-deleted Option is meaningless, so it goes
 * with the Option. A Rejection is *not* a Log entry and carries no Score
 * weight. `rejected_on` is the Household's calendar day in `APP_TZ`; the index
 * on it serves the today's-Rejections query that derives the per-day
 * suppression set. `(option_id, rejected_on)` is unique so the same Option
 * cannot be rejected twice on one date — manual dated entry (ADR-0008) means
 * the same date can be revisited, so this constraint is required (it supersedes
 * ADR-0006's note that no such constraint was needed when Rejections were
 * live-only).
 */
export const rejections = pgTable(
  "rejections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    optionId: uuid("option_id")
      .notNull()
      .references(() => options.id, { onDelete: "cascade" }),
    /** The optional short reason — null when the Household gave none. */
    reason: text("reason"),
    /** The Household's calendar day in `APP_TZ` the Option was rejected on. */
    rejectedOn: date("rejected_on").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("rejections_rejected_on_idx").on(t.rejectedOn),
    unique("rejections_option_rejected_on_unique").on(t.optionId, t.rejectedOn),
  ],
);

/** A Rejection row as stored. */
export type Rejection = typeof rejections.$inferSelect;

/**
 * Day notes (PRD: Day notes). A **Day note** is one optional, single-line note
 * about the Household's evening on a calendar date — "Jen won't be around",
 * "guests over" — independent of any Log entry, Rejection, or Pick. The unique
 * `noted_on` enforces "a date carries zero or one Day note"; an absent Day note
 * is an absent row, never an empty string. It never feeds the Score, a
 * suppression, or a Last note.
 */
export const dayNotes = pgTable("day_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** The Household's calendar day in `APP_TZ` the note is about. */
  notedOn: date("noted_on").notNull().unique(),
  note: text("note").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** One row of a Prepared ranking: an Option id and its AI rationale. */
export type PreparedRankingRow = { id: string; reason: string };

/**
 * Prepared notes (ADR-0011). A **Prepared note** is what the local model wrote
 * ahead of time for one date: a brief and a Prepared ranking of every
 * candidate. The unique `prepared_for` keeps one row per date — only the latest
 * (or, once the date has a Pick, the frozen) version is kept.
 *
 * The row doubles as the per-date claim: `claimed_until` is a lease a replica
 * takes before generating, so two replicas never generate the same date at
 * once. A claim on a date with no note yet inserts a row holding only the date
 * and the lease, which is why every note column is nullable.
 */
export const preparedNotes = pgTable("prepared_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** The Household's calendar day in `APP_TZ` the note is for. */
  preparedFor: date("prepared_for").notNull().unique(),
  brief: text("brief"),
  /** Every candidate in rank order. */
  ranking: jsonb("ranking").$type<PreparedRankingRow[]>(),
  /** Hash of the snapshot, model, and prompt version the note was built from. */
  inputHash: text("input_hash"),
  model: text("model"),
  preparedAt: timestamp("prepared_at", { withTimezone: true }),
  claimedUntil: timestamp("claimed_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** A Prepared note row as stored. */
export type PreparedNoteRow = typeof preparedNotes.$inferSelect;
