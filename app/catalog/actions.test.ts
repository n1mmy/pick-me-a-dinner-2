import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { dinnerLog, options } from "../../db/schema";
import { getActiveCatalog } from "../../db/queries";
import { truncateAll } from "../../db/test-support";
import {
  archiveOption,
  createOption,
  deleteOption,
  updateOption,
  type OptionFormValues,
} from "./actions";

// revalidatePath needs a Next request scope; tests exercise the DB writes only.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const emptyValues: OptionFormValues = {
  name: "",
  url: "",
  notes: "",
  address: "",
  phone: "",
  mapsUrl: "",
};

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
