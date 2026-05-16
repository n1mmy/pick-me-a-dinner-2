"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { options } from "../../db/schema";

/** Which kind of Option a form is editing. */
export type OptionKind = "home" | "restaurant";

/**
 * Raw form values for adding or editing an Option. The restaurant-only fields
 * are ignored when `kind` is `"home"` — a Home meal has no address or phone.
 */
export type OptionFormValues = {
  name: string;
  url: string;
  notes: string;
  address: string;
  phone: string;
  mapsUrl: string;
};

/** A Catalog mutation either succeeds or carries a message to show inline. */
export type ActionResult = { ok: true } | { ok: false; error: string };

/** Trim a free-text field, storing `null` rather than an empty string. */
function trimToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
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
  };
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

/** Add a Home meal or Restaurant to the Catalog. */
export async function createOption(
  kind: OptionKind,
  values: OptionFormValues,
): Promise<ActionResult> {
  if (values.name.trim().length === 0) {
    return { ok: false, error: "Enter a name" };
  }
  await db.insert(options).values({ kind, ...columnsFor(kind, values) });
  revalidatePath("/catalog");
  return { ok: true };
}

/** Edit an existing Option in place. */
export async function updateOption(
  id: string,
  kind: OptionKind,
  values: OptionFormValues,
): Promise<ActionResult> {
  if (values.name.trim().length === 0) {
    return { ok: false, error: "Enter a name" };
  }
  await db.update(options).set(columnsFor(kind, values)).where(eq(options.id, id));
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
