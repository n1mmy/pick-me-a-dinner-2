"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { optionTags, options, tags } from "../../db/schema";
import { authedAction } from "../../lib/authed-action";
import { normalizeTag } from "../../lib/normalize-tag";
import { pgErrorCode } from "../../lib/pg-error";

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
 *
 * Under a concurrent same-Tag insert, the loser's `onConflictDoNothing` returns
 * nothing and its first SELECT can miss the winner's not-yet-committed row, so
 * the lookup is retried once — by the second pass the winner has committed and
 * the row is visible (review fix F6 / review B5).
 */
async function resolveTagId(tx: Tx, name: string): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
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
    if (existing) return existing.id;
  }
  throw new Error(`could not resolve tag "${name}"`);
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
 * Revalidate every screen a Catalog mutation changes: the Catalog list and the
 * Option detail page. An Edit, Archive, or Delete invoked from the detail page
 * must refresh it in place there too — a control behaves identically wherever
 * it is invoked (PRD: Option detail page, ADR-0007).
 */
function revalidateCatalog(): void {
  revalidatePath("/catalog");
  revalidatePath("/catalog/[id]", "page");
}

/**
 * Add a Home meal or Restaurant to the Catalog. The Option insert and its Tag
 * sync run in one transaction, so a mid-write failure rolls back rather than
 * leaving an Option with missing Tags.
 */
export const createOption = authedAction(
  async (kind: OptionKind, values: OptionFormValues): Promise<ActionResult> => {
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
  },
);

/**
 * Edit an existing Option in place. The Option update and its Tag sync run in
 * one transaction — `syncOptionTags` deletes every Tag link before re-inserting,
 * so a partial failure outside a transaction could strip an Option's Tags.
 */
export const updateOption = authedAction(
  async (
    id: string,
    kind: OptionKind,
    values: OptionFormValues,
  ): Promise<ActionResult> => {
    if (values.name.trim().length === 0) {
      return { ok: false, error: "Enter a name" };
    }
    try {
      await db.transaction(async (tx) => {
        await tx
          .update(options)
          .set(columnsFor(kind, values))
          .where(eq(options.id, id));
        await syncOptionTags(tx, id, values.tags);
      });
    } catch (error) {
      // 22P02 invalid uuid — a malformed/stale Option id; report, don't 500.
      if (pgErrorCode(error) === "22P02") {
        return { ok: false, error: "That option is no longer available" };
      }
      throw error;
    }
    revalidateCatalog();
    return { ok: true };
  },
);

/**
 * Archive an Option: `active = false`. It leaves the default Catalog list and
 * Tonight, but its Log history is untouched.
 */
export const archiveOption = authedAction(
  async (id: string): Promise<ActionResult> => {
    try {
      await db.update(options).set({ active: false }).where(eq(options.id, id));
    } catch (error) {
      // 22P02 invalid uuid — a malformed/stale Option id; report, don't 500.
      if (pgErrorCode(error) === "22P02") {
        return { ok: false, error: "That option is no longer available" };
      }
      throw error;
    }
    revalidateCatalog();
    return { ok: true };
  },
);

/**
 * Hard-delete an Option. Allowed only for an Option with zero Log entries; the
 * `ON DELETE RESTRICT` violation for a logged Option is caught and translated
 * into a friendly inline message rather than surfacing as a 500.
 */
export const deleteOption = authedAction(
  async (id: string): Promise<ActionResult> => {
    try {
      await db.delete(options).where(eq(options.id, id));
    } catch (error) {
      const code = pgErrorCode(error);
      // 23503 FK violation — the Option has Log history; archive it instead.
      if (code === "23503") {
        return { ok: false, error: "In your log — archive instead" };
      }
      // 22P02 invalid uuid — a malformed/stale Option id; report, don't 500.
      if (code === "22P02") {
        return { ok: false, error: "That option is no longer available" };
      }
      throw error;
    }
    revalidateCatalog();
    return { ok: true };
  },
);
