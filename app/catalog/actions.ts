"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { optionTags, options, tags } from "../../db/schema";
import { normalizeTag } from "../../lib/normalize-tag";

/** Which kind of Option a form is editing. */
export type OptionKind = "home" | "restaurant";

/** A Drizzle transaction handle — the query client inside `db.transaction`. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Raw form values for adding or editing an Option. The restaurant-only fields
 * are ignored when `kind` is `"home"` — a Home meal has no address or phone.
 * `lat`/`lng` are carried as strings (the form's text inputs) and parsed to a
 * number, or `null`, on save. `tags` is the full set of Tag strings the form's
 * token input currently holds; `normalizeTag` canonicalizes each before it
 * touches the DB.
 */
export type OptionFormValues = {
  name: string;
  url: string;
  notes: string;
  address: string;
  phone: string;
  mapsUrl: string;
  lat: string;
  lng: string;
  googlePlaceId: string;
  tags: string[];
};

/** A Catalog mutation either succeeds or carries a message to show inline. */
export type ActionResult = { ok: true } | { ok: false; error: string };

/** Trim a free-text field, storing `null` rather than an empty string. */
function trimToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** Parse a latitude/longitude form field to a number, or `null` when blank or non-numeric. */
function parseCoord(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

/** Column values for an insert/update — restaurant-only fields dropped for Home meals. */
function columnsFor(kind: OptionKind, values: OptionFormValues) {
  const base = {
    name: values.name.trim(),
    url: trimToNull(values.url),
    notes: trimToNull(values.notes),
  };
  if (kind === "home") return base;
  return {
    ...base,
    address: trimToNull(values.address),
    phone: trimToNull(values.phone),
    mapsUrl: trimToNull(values.mapsUrl),
    lat: parseCoord(values.lat),
    lng: parseCoord(values.lng),
    googlePlaceId: trimToNull(values.googlePlaceId),
  };
}

/**
 * Resolve a normalized Tag name to its row id, creating the Tag if it is new.
 * The insert relies on the `tags.lower(name)` unique index: a Tag that already
 * exists conflicts and inserts nothing, so "Pasta" reuses the existing "pasta"
 * row rather than duplicating it. Names are pre-normalized, so an exact-name
 * lookup finds the existing row.
 */
async function resolveTagId(tx: Tx, name: string): Promise<string> {
  const [created] = await tx
    .insert(tags)
    .values({ name })
    .onConflictDoNothing()
    .returning({ id: tags.id });
  if (created) return created.id;

  const [existing] = await tx
    .select({ id: tags.id })
    .from(tags)
    .where(eq(tags.name, name));
  return existing.id;
}

/**
 * Replace an Option's `option_tags` rows with exactly the given Tags. Each Tag
 * is normalized and the set deduped, so "Pasta" and "pasta " collapse to one
 * row; detached Tags simply lose their link (a Tag with no Options is harmless
 * and needs no cleanup).
 */
async function syncOptionTags(
  tx: Tx,
  optionId: string,
  rawTags: string[],
): Promise<void> {
  const names = [
    ...new Set(rawTags.map(normalizeTag).filter((name) => name.length > 0)),
  ];
  await tx.delete(optionTags).where(eq(optionTags.optionId, optionId));
  if (names.length === 0) return;

  const tagIds = await Promise.all(names.map((name) => resolveTagId(tx, name)));
  await tx.insert(optionTags).values(tagIds.map((tagId) => ({ optionId, tagId })));
}

/**
 * A `dinner_log` row referencing the Option triggers `ON DELETE RESTRICT`,
 * which Postgres reports as a foreign-key violation (SQLSTATE 23503).
 */
function isForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23503"
  );
}

/**
 * Add a Home meal or Restaurant to the Catalog. The Option insert and its Tag
 * sync run in one transaction, so a mid-write failure rolls back rather than
 * leaving an Option with missing Tags.
 */
export async function createOption(
  kind: OptionKind,
  values: OptionFormValues,
): Promise<ActionResult> {
  if (values.name.trim().length === 0) {
    return { ok: false, error: "Enter a name" };
  }
  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(options)
      .values({ kind, ...columnsFor(kind, values) })
      .returning({ id: options.id });
    await syncOptionTags(tx, created.id, values.tags);
  });
  revalidatePath("/catalog");
  return { ok: true };
}

/**
 * Edit an existing Option in place. The Option update and its Tag sync run in
 * one transaction — `syncOptionTags` deletes every Tag link before re-inserting,
 * so a partial failure outside a transaction could strip an Option's Tags.
 */
export async function updateOption(
  id: string,
  kind: OptionKind,
  values: OptionFormValues,
): Promise<ActionResult> {
  if (values.name.trim().length === 0) {
    return { ok: false, error: "Enter a name" };
  }
  await db.transaction(async (tx) => {
    await tx.update(options).set(columnsFor(kind, values)).where(eq(options.id, id));
    await syncOptionTags(tx, id, values.tags);
  });
  revalidatePath("/catalog");
  return { ok: true };
}

/**
 * Archive an Option: `active = false`. It leaves the default Catalog list and
 * Tonight, but its Log history is untouched.
 */
export async function archiveOption(id: string): Promise<ActionResult> {
  await db.update(options).set({ active: false }).where(eq(options.id, id));
  revalidatePath("/catalog");
  return { ok: true };
}

/**
 * Hard-delete an Option. Allowed only for an Option with zero Log entries; the
 * `ON DELETE RESTRICT` violation for a logged Option is caught and translated
 * into a friendly inline message rather than surfacing as a 500.
 */
export async function deleteOption(id: string): Promise<ActionResult> {
  try {
    await db.delete(options).where(eq(options.id, id));
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      return { ok: false, error: "In your log — archive instead" };
    }
    throw error;
  }
  revalidatePath("/catalog");
  return { ok: true };
}
