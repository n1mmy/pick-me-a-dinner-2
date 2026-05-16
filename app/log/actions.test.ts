import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { dinnerLog, options } from "../../db/schema";
import { getLog, getTonightData } from "../../db/queries";
import { truncateAll } from "../../db/test-support";
import { todaySqlDate } from "../../lib/local-day";
import {
  deleteLogEntry,
  logForDate,
  pickTonight,
  updateLogEntry,
} from "./actions";

// revalidatePath needs a Next request scope; tests exercise the DB writes only.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

/** The Household's calendar day — `pickTonight` logs against exactly this. */
const TODAY = todaySqlDate(new Date(), process.env.APP_TZ ?? "UTC");

/** Insert an Option directly — Catalog CRUD is covered by its own suite. */
async function makeOption(
  name: string,
  kind: "home" | "restaurant" = "home",
): Promise<string> {
  const [row] = await db
    .insert(options)
    .values({ name, kind })
    .returning({ id: options.id });
  return row.id;
}

/** Insert a `dinner_log` row directly and return its id. */
async function makeEntry(
  optionId: string,
  eatenOn: string,
  note?: string,
): Promise<string> {
  const [row] = await db
    .insert(dinnerLog)
    .values({ optionId, eatenOn, note: note ?? null })
    .returning({ id: dinnerLog.id });
  return row.id;
}

beforeEach(async () => {
  await truncateAll();
});

describe("pickTonight", () => {
  it("logs a dinner_log row for today in one tap", async () => {
    const pizza = await makeOption("Pizza");

    await pickTonight(pizza);

    const rows = await db.select().from(dinnerLog);
    expect(rows).toHaveLength(1);
    expect(rows[0].optionId).toBe(pizza);
    expect(rows[0].eatenOn).toBe(TODAY);
  });

  it("treats a double-tap as a no-op upsert on (option_id, eaten_on)", async () => {
    const pizza = await makeOption("Pizza");

    await pickTonight(pizza);
    await pickTonight(pizza);

    expect(await db.select().from(dinnerLog)).toHaveLength(1);
  });

  it("adds a second entry when a different Option is picked the same evening", async () => {
    const pizza = await makeOption("Pizza");
    const tacos = await makeOption("Tacos", "restaurant");

    await pickTonight(pizza);
    await pickTonight(tacos);

    // One Dinner, two Log entries — a multi-Option evening.
    const rows = await db.select().from(dinnerLog);
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.eatenOn === TODAY)).toBe(true);
  });
});

describe("logForDate", () => {
  it("backfills a past date", async () => {
    const pizza = await makeOption("Pizza");

    await logForDate(pizza, "2026-01-10");

    const rows = await db.select().from(dinnerLog);
    expect(rows).toHaveLength(1);
    expect(rows[0].eatenOn).toBe("2026-01-10");
  });

  it("logs a future date as a Planned dinner excluded from the Tonight ranking", async () => {
    const pizza = await makeOption("Pizza");

    await logForDate(pizza, "2099-12-31");

    const rows = await db.select().from(dinnerLog);
    expect(rows).toHaveLength(1);
    expect(rows[0].eatenOn).toBe("2099-12-31");

    // The future row is a Planned dinner — getTonightData excludes it.
    const { logEntries } = await getTonightData(TODAY);
    expect(logEntries).toHaveLength(0);
  });
});

describe("updateLogEntry", () => {
  it("changes the Option of an entry", async () => {
    const pizza = await makeOption("Pizza");
    const tacos = await makeOption("Tacos", "restaurant");
    const id = await makeEntry(pizza, "2026-05-01");

    const result = await updateLogEntry(id, {
      optionId: tacos,
      eatenOn: "2026-05-01",
      note: "",
    });

    expect(result).toEqual({ ok: true });
    const [row] = await db
      .select()
      .from(dinnerLog)
      .where(eq(dinnerLog.id, id));
    expect(row.optionId).toBe(tacos);
  });

  it("changes the date of an entry", async () => {
    const pizza = await makeOption("Pizza");
    const id = await makeEntry(pizza, "2026-05-01");

    const result = await updateLogEntry(id, {
      optionId: pizza,
      eatenOn: "2026-05-08",
      note: "",
    });

    expect(result).toEqual({ ok: true });
    const [row] = await db
      .select()
      .from(dinnerLog)
      .where(eq(dinnerLog.id, id));
    expect(row.eatenOn).toBe("2026-05-08");
  });

  it("edits the note of an entry, trimming a blank note to null", async () => {
    const pizza = await makeOption("Pizza");
    const id = await makeEntry(pizza, "2026-05-01", "leftovers");

    const noted = await updateLogEntry(id, {
      optionId: pizza,
      eatenOn: "2026-05-01",
      note: "takeout instead",
    });
    expect(noted).toEqual({ ok: true });
    const [withNote] = await db
      .select()
      .from(dinnerLog)
      .where(eq(dinnerLog.id, id));
    expect(withNote.note).toBe("takeout instead");

    const cleared = await updateLogEntry(id, {
      optionId: pizza,
      eatenOn: "2026-05-01",
      note: "   ",
    });
    expect(cleared).toEqual({ ok: true });
    const [withoutNote] = await db
      .select()
      .from(dinnerLog)
      .where(eq(dinnerLog.id, id));
    expect(withoutNote.note).toBeNull();
  });

  it("rejects an edit that collides with an existing (option_id, eaten_on)", async () => {
    const pizza = await makeOption("Pizza");
    await makeEntry(pizza, "2026-05-01");
    const second = await makeEntry(pizza, "2026-05-02");

    // Moving the 05-02 entry onto 05-01 would duplicate (pizza, 2026-05-01).
    const result = await updateLogEntry(second, {
      optionId: pizza,
      eatenOn: "2026-05-01",
      note: "",
    });

    expect(result).toEqual({
      ok: false,
      error: "Already logged for that date",
    });
    // The rejected entry is untouched — never silently merged.
    const [row] = await db
      .select()
      .from(dinnerLog)
      .where(eq(dinnerLog.id, second));
    expect(row.eatenOn).toBe("2026-05-02");
  });
});

describe("deleteLogEntry", () => {
  it("removes a Log entry", async () => {
    const pizza = await makeOption("Pizza");
    const id = await makeEntry(pizza, "2026-05-01");

    await deleteLogEntry(id);

    expect(await db.select().from(dinnerLog)).toHaveLength(0);
  });
});

describe("getLog", () => {
  it("returns entries newest eaten_on first, each joined to its Option", async () => {
    const pizza = await makeOption("Pizza");
    const tacos = await makeOption("Tacos", "restaurant");
    await makeEntry(pizza, "2026-05-01");
    await makeEntry(tacos, "2026-05-10");

    const log = await getLog();

    expect(log.map((entry) => entry.eatenOn)).toEqual([
      "2026-05-10",
      "2026-05-01",
    ]);
    expect(log[0].optionName).toBe("Tacos");
    expect(log[0].kind).toBe("restaurant");
  });
});
