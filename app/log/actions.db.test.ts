import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { dinnerLog, options, rejections } from "../../db/schema";
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

// The actions are authedAction-wrapped (F1); stub the session check so the
// tests drive the action bodies directly. requireSession itself is covered by
// the auth-by-default tests.
vi.mock("../../lib/require-session", () => ({
  requireSession: vi.fn(async () => {}),
}));

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

/** Insert a `rejections` row directly and return its id. */
async function makeRejection(optionId: string, rejectedOn: string): Promise<string> {
  const [row] = await db
    .insert(rejections)
    .values({ optionId, rejectedOn })
    .returning({ id: rejections.id });
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

  it("reports a failure instead of flashing success when the Option is gone", async () => {
    // A well-formed but non-existent Option id — the FK insert fails. The
    // caller must see ok:false so the row never flashes a false "Logged ✓".
    const result = await pickTonight("00000000-0000-0000-0000-000000000000");

    expect(result.ok).toBe(false);
    expect(await db.select().from(dinnerLog)).toHaveLength(0);
  });

  it("logs a Planned dinner when given a future Selected day", async () => {
    // ADR-0009: a Pick from Tonight with a future Selected day creates a
    // Planned dinner dated that day — the same write `pickTonight` already
    // does, just to a different `eaten_on`.
    const pizza = await makeOption("Pizza");
    const future = futureSqlDate(7);

    const result = await pickTonight(pizza, future);

    expect(result.ok).toBe(true);
    const rows = await db.select().from(dinnerLog);
    expect(rows).toHaveLength(1);
    expect(rows[0].eatenOn).toBe(future);
  });

  it("backfills a forgotten dinner when given a past Selected day", async () => {
    // ADR-0009 (amended): the Selected day can step into the past, so a Pick
    // with a past Selected day backfills a Log entry dated that day rather than
    // mis-dating it to today.
    const pizza = await makeOption("Pizza");

    const result = await pickTonight(pizza, "2025-01-01");

    expect(result.ok).toBe(true);
    const rows = await db.select().from(dinnerLog);
    expect(rows).toHaveLength(1);
    expect(rows[0].eatenOn).toBe("2025-01-01");
  });

  it("clamps a malformed Selected day to today", async () => {
    const pizza = await makeOption("Pizza");

    await pickTonight(pizza, "not-a-date");

    const rows = await db.select().from(dinnerLog);
    expect(rows[0].eatenOn).toBe(TODAY);
  });
});

/**
 * A SQL date `daysAhead` days from today — used by the Planned-dinner tests
 * so the future cases stay relative to whenever the suite runs.
 */
function futureSqlDate(daysAhead: number): string {
  const ms = Date.now() + daysAhead * 86_400_000;
  return todaySqlDate(new Date(ms), process.env.APP_TZ ?? "UTC");
}

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

  it("stores a note when one is given", async () => {
    const pizza = await makeOption("Pizza");

    const result = await logForDate(pizza, "2026-01-10", "  family night  ");

    expect(result).toEqual({ ok: true });
    const [row] = await db.select().from(dinnerLog);
    expect(row.note).toBe("family night");
  });

  it("rejects a date the Option is already logged for, inline", async () => {
    const pizza = await makeOption("Pizza");
    await makeEntry(pizza, "2026-01-10");

    const result = await logForDate(pizza, "2026-01-10");

    expect(result).toEqual({
      ok: false,
      error: "Already logged for that date",
    });
    // The collision is reported, not silently swallowed — still one row.
    expect(await db.select().from(dinnerLog)).toHaveLength(1);
  });

  it("rejects a blank or malformed date with an inline error", async () => {
    const pizza = await makeOption("Pizza");

    expect(await logForDate(pizza, "")).toEqual({
      ok: false,
      error: "Pick a valid date",
    });
    expect(await logForDate(pizza, "2026-02-30")).toEqual({
      ok: false,
      error: "Pick a valid date",
    });
    expect(await db.select().from(dinnerLog)).toHaveLength(0);
  });
});

describe("a Pick supersedes that date's Rejection", () => {
  // CONTEXT.md, Pick: picking an Option on a date it carries a Rejection
  // removes that Rejection.

  it("pickTonight deletes a same-date Rejection of the same Option", async () => {
    const pizza = await makeOption("Pizza");
    await makeRejection(pizza, TODAY);

    const result = await pickTonight(pizza);

    expect(result.ok).toBe(true);
    expect(await db.select().from(dinnerLog)).toHaveLength(1);
    expect(await db.select().from(rejections)).toHaveLength(0);
  });

  it("pickTonight on an already-logged Option still clears a lingering same-date Rejection", async () => {
    const pizza = await makeOption("Pizza");
    await makeEntry(pizza, TODAY);
    await makeRejection(pizza, TODAY);

    const result = await pickTonight(pizza);

    expect(result.ok).toBe(true);
    expect(await db.select().from(dinnerLog)).toHaveLength(1);
    expect(await db.select().from(rejections)).toHaveLength(0);
  });

  it("pickTonight leaves a Rejection of the same Option on a different date untouched", async () => {
    const pizza = await makeOption("Pizza");
    const otherDate = await makeRejection(pizza, "2025-01-01");

    await pickTonight(pizza);

    const rows = await db.select().from(rejections);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(otherDate);
  });

  it("pickTonight leaves a same-date Rejection of a different Option untouched", async () => {
    const pizza = await makeOption("Pizza");
    const tacos = await makeOption("Tacos", "restaurant");
    const otherOption = await makeRejection(tacos, TODAY);

    await pickTonight(pizza);

    const rows = await db.select().from(rejections);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(otherOption);
  });

  it("logForDate on a past date deletes a same-date Rejection of the same Option", async () => {
    const pizza = await makeOption("Pizza");
    await makeRejection(pizza, "2026-01-10");

    const result = await logForDate(pizza, "2026-01-10");

    expect(result).toEqual({ ok: true });
    expect(await db.select().from(rejections)).toHaveLength(0);
  });

  it("logForDate on today deletes a same-date Rejection of the same Option", async () => {
    const pizza = await makeOption("Pizza");
    await makeRejection(pizza, TODAY);

    const result = await logForDate(pizza, TODAY);

    expect(result).toEqual({ ok: true });
    expect(await db.select().from(rejections)).toHaveLength(0);
  });

  it("logForDate on a future date deletes a same-date Planned rejection of the same Option", async () => {
    const pizza = await makeOption("Pizza");
    const future = futureSqlDate(7);
    await makeRejection(pizza, future);

    const result = await logForDate(pizza, future);

    expect(result).toEqual({ ok: true });
    expect(await db.select().from(rejections)).toHaveLength(0);
  });

  it("logForDate leaves a Rejection of the same Option on a different date untouched", async () => {
    const pizza = await makeOption("Pizza");
    const otherDate = await makeRejection(pizza, "2025-06-01");

    await logForDate(pizza, "2026-01-10");

    const rows = await db.select().from(rejections);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(otherDate);
  });

  it("logForDate leaves a same-date Rejection of a different Option untouched", async () => {
    const pizza = await makeOption("Pizza");
    const tacos = await makeOption("Tacos", "restaurant");
    const otherOption = await makeRejection(tacos, "2026-01-10");

    await logForDate(pizza, "2026-01-10");

    const rows = await db.select().from(rejections);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(otherOption);
  });

  it("logForDate on an already-logged date reports the duplicate and leaves the Rejection in place", async () => {
    const pizza = await makeOption("Pizza");
    await makeEntry(pizza, "2026-01-10");
    await makeRejection(pizza, "2026-01-10");

    const result = await logForDate(pizza, "2026-01-10");

    expect(result).toEqual({
      ok: false,
      error: "Already logged for that date",
    });
    // The insert threw before the delete ran — the Rejection survives.
    expect(await db.select().from(rejections)).toHaveLength(1);
  });

  it("pickTonight rolls back its Log insert when the Rejection delete fails (transactional)", async () => {
    const pizza = await makeOption("Pizza");
    await makeRejection(pizza, TODAY);

    const result = await withFailingRejectionDelete(() => pickTonight(pizza));

    expect(result.ok).toBe(false);
    expect(await db.select().from(dinnerLog)).toHaveLength(0);
    expect(await db.select().from(rejections)).toHaveLength(1);
  });

  it("logForDate rolls back its Log insert when the Rejection delete fails (transactional)", async () => {
    const pizza = await makeOption("Pizza");
    await makeRejection(pizza, "2026-01-10");

    const result = await withFailingRejectionDelete(() =>
      logForDate(pizza, "2026-01-10"),
    );

    expect(result.ok).toBe(false);
    expect(await db.select().from(dinnerLog)).toHaveLength(0);
    expect(await db.select().from(rejections)).toHaveLength(1);
  });
});

/**
 * Runs `action` with the next `db.transaction`'s `delete` throwing. The Log
 * insert has already landed inside the transaction by then, so only a real
 * rollback leaves the table empty — the insert-first duplicate case above
 * can't tell a transaction from none.
 */
async function withFailingRejectionDelete<T>(
  action: () => Promise<T>,
): Promise<T> {
  const realTransaction = db.transaction.bind(db);
  const spy = vi.spyOn(db, "transaction").mockImplementationOnce((run) =>
    realTransaction((tx) =>
      run(
        new Proxy(tx, {
          get: (target, prop, receiver) =>
            prop === "delete"
              ? () => {
                  throw new Error("injected Rejection delete failure");
                }
              : Reflect.get(target, prop, receiver),
        }),
      ),
    ),
  );
  try {
    return await action();
  } finally {
    spy.mockRestore();
  }
}

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

  it("rejects a blank date with an inline error, leaving the entry untouched", async () => {
    const pizza = await makeOption("Pizza");
    const id = await makeEntry(pizza, "2026-05-01");

    const result = await updateLogEntry(id, {
      optionId: pizza,
      eatenOn: "",
      note: "",
    });

    expect(result).toEqual({ ok: false, error: "Pick a valid date" });
    const [row] = await db
      .select()
      .from(dinnerLog)
      .where(eq(dinnerLog.id, id));
    expect(row.eatenOn).toBe("2026-05-01");
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

    const result = await deleteLogEntry(id);

    expect(result).toEqual({ ok: true });
    expect(await db.select().from(dinnerLog)).toHaveLength(0);
  });
});

describe("getTonightData", () => {
  it("excludes an archived Option's Log rows from the ranking data", async () => {
    const active = await makeOption("Pizza");
    const archived = await makeOption("Old Diner", "restaurant");
    await makeEntry(active, "2026-05-01");
    await makeEntry(archived, "2026-05-02");
    await db
      .update(options)
      .set({ active: false })
      .where(eq(options.id, archived));

    const { logEntries } = await getTonightData(TODAY);

    // Archiving is rare and must not move the ranking — only the active
    // Option's Log row feeds recency (review fix F5).
    expect(logEntries).toHaveLength(1);
    expect(logEntries[0].optionId).toBe(active);
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
