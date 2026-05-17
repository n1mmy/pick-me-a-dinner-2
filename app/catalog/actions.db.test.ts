import { beforeEach, describe, expect, it, vi } from "vitest";
import { asc, eq } from "drizzle-orm";
import { db } from "../../db";
import { dinnerLog, optionTags, options, tags } from "../../db/schema";
import { getActiveCatalog, getArchivedOptions } from "../../db/queries";
import { truncateAll } from "../../db/test-support";
import {
  archiveOption,
  createOption,
  deleteOption,
  unarchiveOption,
  updateOption,
  type OptionFormValues,
} from "./actions";

// revalidatePath needs a Next request scope; tests exercise the DB writes only.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// The actions are authedAction-wrapped (F1); stub the session check so the
// tests drive the action bodies directly.
vi.mock("../../lib/require-session", () => ({
  requireSession: vi.fn(async () => {}),
}));

const emptyValues: OptionFormValues = {
  name: "",
  url: "",
  notes: "",
  address: "",
  phone: "",
  mapsUrl: "",
  lat: "",
  lng: "",
  googlePlaceId: "",
  tags: [],
};

/** The Tag names attached to one Option, ordered for stable assertions. */
async function tagNamesFor(optionId: string): Promise<string[]> {
  const rows = await db
    .select({ name: tags.name })
    .from(optionTags)
    .innerJoin(tags, eq(optionTags.tagId, tags.id))
    .where(eq(optionTags.optionId, optionId))
    .orderBy(asc(tags.name));
  return rows.map((row) => row.name);
}

beforeEach(async () => {
  await truncateAll();
});

describe("createOption", () => {
  it("adds a Home meal to the Catalog", async () => {
    const result = await createOption("home", {
      ...emptyValues,
      name: "Pasta",
      notes: "weeknight staple",
    });

    expect(result).toEqual({ ok: true });
    const rows = await db.select().from(options);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Pasta");
    expect(rows[0].kind).toBe("home");
    expect(rows[0].active).toBe(true);
    expect(rows[0].notes).toBe("weeknight staple");
  });

  it("adds a Restaurant with its restaurant-only fields", async () => {
    const result = await createOption("restaurant", {
      ...emptyValues,
      name: "El Comal",
      address: "123 Main St",
      phone: "555-1234",
    });

    expect(result).toEqual({ ok: true });
    const [row] = await db.select().from(options);
    expect(row.kind).toBe("restaurant");
    expect(row.address).toBe("123 Main St");
    expect(row.phone).toBe("555-1234");
  });

  it("persists the autofill-only fields — lat, lng, google_place_id — for a Restaurant", async () => {
    const result = await createOption("restaurant", {
      ...emptyValues,
      name: "El Comal",
      lat: "37.7749",
      lng: "-122.4194",
      googlePlaceId: "ChIJabc123",
    });

    expect(result).toEqual({ ok: true });
    const [row] = await db.select().from(options);
    expect(row.lat).toBe(37.7749);
    expect(row.lng).toBe(-122.4194);
    expect(row.googlePlaceId).toBe("ChIJabc123");
  });

  it("stores a blank or non-numeric coordinate as null", async () => {
    await createOption("restaurant", {
      ...emptyValues,
      name: "El Comal",
      lat: "  ",
      lng: "not-a-number",
    });

    const [row] = await db.select().from(options);
    expect(row.lat).toBeNull();
    expect(row.lng).toBeNull();
  });

  it("rejects a blank name with an inline error", async () => {
    const result = await createOption("home", { ...emptyValues, name: "   " });

    expect(result).toEqual({ ok: false, error: "Enter a name" });
    expect(await db.select().from(options)).toHaveLength(0);
  });
});

describe("updateOption", () => {
  it("edits an Option in place", async () => {
    await createOption("home", { ...emptyValues, name: "Pasta" });
    const [row] = await db.select().from(options);

    const result = await updateOption(row.id, "home", {
      ...emptyValues,
      name: "Lasagna",
      url: "https://example.com/lasagna",
    });

    expect(result).toEqual({ ok: true });
    const [updated] = await db
      .select()
      .from(options)
      .where(eq(options.id, row.id));
    expect(updated.name).toBe("Lasagna");
    expect(updated.url).toBe("https://example.com/lasagna");
  });

  it("rejects a blank name", async () => {
    await createOption("home", { ...emptyValues, name: "Pasta" });
    const [row] = await db.select().from(options);

    const result = await updateOption(row.id, "home", {
      ...emptyValues,
      name: "",
    });

    expect(result).toEqual({ ok: false, error: "Enter a name" });
  });
});

describe("archiveOption", () => {
  it("sets active = false and drops the Option from the default Catalog list", async () => {
    await createOption("home", { ...emptyValues, name: "Pasta" });
    const [row] = await db.select().from(options);

    const result = await archiveOption(row.id);

    expect(result).toEqual({ ok: true });
    const [archived] = await db
      .select()
      .from(options)
      .where(eq(options.id, row.id));
    expect(archived.active).toBe(false);

    const catalog = await getActiveCatalog();
    expect(catalog.home).toHaveLength(0);
  });
});

describe("unarchiveOption", () => {
  it("sets active = true and returns the Option to the default Catalog list", async () => {
    await createOption("home", { ...emptyValues, name: "Pasta" });
    const [row] = await db.select().from(options);
    await archiveOption(row.id);

    const result = await unarchiveOption(row.id);

    expect(result).toEqual({ ok: true });
    const [unarchived] = await db
      .select()
      .from(options)
      .where(eq(options.id, row.id));
    expect(unarchived.active).toBe(true);

    const catalog = await getActiveCatalog();
    expect(catalog.home).toHaveLength(1);
    expect(await getArchivedOptions()).toHaveLength(0);
  });
});

describe("getArchivedOptions", () => {
  it("lists Archived Options by name, leaving the active Catalog out", async () => {
    await createOption("home", { ...emptyValues, name: "Pasta" });
    await createOption("restaurant", { ...emptyValues, name: "El Comal" });
    const all = await db.select().from(options).orderBy(asc(options.name));
    const elComal = all.find((o) => o.name === "El Comal")!;
    await archiveOption(elComal.id);

    const archived = await getArchivedOptions();
    expect(archived).toEqual([{ id: elComal.id, name: "El Comal" }]);
  });
});

describe("Tags on an Option", () => {
  it("attaches Tags on create, normalizing and persisting them via option_tags", async () => {
    await createOption("home", {
      ...emptyValues,
      name: "Pasta",
      tags: ["  Weeknight ", "QUICK"],
    });
    const [row] = await db.select().from(options);

    expect(await tagNamesFor(row.id)).toEqual(["quick", "weeknight"]);
    expect(await db.select().from(tags)).toHaveLength(2);
  });

  it("reuses an existing Tag case-insensitively — 'Pasta' does not duplicate 'pasta'", async () => {
    await createOption("home", { ...emptyValues, name: "Spaghetti", tags: ["pasta"] });
    await createOption("home", { ...emptyValues, name: "Lasagna", tags: ["Pasta"] });

    const tagRows = await db.select().from(tags);
    expect(tagRows).toHaveLength(1);
    expect(tagRows[0].name).toBe("pasta");
    expect(await db.select().from(optionTags)).toHaveLength(2);
  });

  it("collapses duplicate Tags within one save to a single option_tags row", async () => {
    await createOption("home", {
      ...emptyValues,
      name: "Pasta",
      tags: ["pasta", "Pasta", " pasta "],
    });
    const [row] = await db.select().from(options);

    expect(await tagNamesFor(row.id)).toEqual(["pasta"]);
  });

  it("attaches and detaches Tags on update, leaving harmless orphan Tags behind", async () => {
    await createOption("home", {
      ...emptyValues,
      name: "Pasta",
      tags: ["pasta", "cheesy"],
    });
    const [row] = await db.select().from(options);

    await updateOption(row.id, "home", {
      ...emptyValues,
      name: "Pasta",
      tags: ["pasta", "spicy"],
    });

    // "cheesy" is detached; "spicy" attached; the Option keeps only its current Tags.
    expect(await tagNamesFor(row.id)).toEqual(["pasta", "spicy"]);
    // The orphaned "cheesy" Tag row simply lingers — no cleanup is needed.
    const allTagNames = (await db.select().from(tags)).map((t) => t.name).sort();
    expect(allTagNames).toEqual(["cheesy", "pasta", "spicy"]);
  });

  it("surfaces an Option's attached Tags through getActiveCatalog", async () => {
    await createOption("home", {
      ...emptyValues,
      name: "Pasta",
      tags: ["weeknight", "pasta"],
    });

    const catalog = await getActiveCatalog();
    expect(catalog.home).toHaveLength(1);
    expect([...catalog.home[0].tags].sort()).toEqual(["pasta", "weeknight"]);
    expect(catalog.allTags.sort()).toEqual(["pasta", "weeknight"]);
  });
});

describe("deleteOption", () => {
  it("hard-deletes an Option with zero Log entries", async () => {
    await createOption("home", { ...emptyValues, name: "Pasta" });
    const [row] = await db.select().from(options);

    const result = await deleteOption(row.id);

    expect(result).toEqual({ ok: true });
    expect(await db.select().from(options)).toHaveLength(0);
  });

  it("blocks hard-delete for an Option with Log history and says to archive instead", async () => {
    await createOption("home", { ...emptyValues, name: "Pasta" });
    const [row] = await db.select().from(options);
    await db.insert(dinnerLog).values({ optionId: row.id, eatenOn: "2026-05-01" });

    const result = await deleteOption(row.id);

    expect(result).toEqual({ ok: false, error: "In your log — archive instead" });
    expect(await db.select().from(options)).toHaveLength(1);
  });
});
