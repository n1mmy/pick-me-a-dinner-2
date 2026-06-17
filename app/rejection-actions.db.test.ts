import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { options, rejections } from "../db/schema";
import { getLogRejections, getOptionRejections } from "../db/queries";
import { truncateAll } from "../db/test-support";
import { todaySqlDate } from "../lib/local-day";
import {
  createRejection,
  deleteRejection,
  rejectOption,
  updateRejection,
} from "./rejection-actions";

// revalidatePath needs a Next request scope; tests exercise the DB writes only.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// The actions are authedAction-wrapped; stub the session check so the tests
// drive the action bodies directly. requireSession itself is covered by the
// auth-by-default tests.
vi.mock("../lib/require-session", () => ({
  requireSession: vi.fn(async () => {}),
}));

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

/** Insert a `rejections` row directly and return its id. */
async function makeRejection(
  optionId: string,
  rejectedOn: string,
  reason?: string,
): Promise<string> {
  const [row] = await db
    .insert(rejections)
    .values({ optionId, rejectedOn, reason: reason ?? null })
    .returning({ id: rejections.id });
  return row.id;
}

beforeEach(async () => {
  await truncateAll();
});

describe("createRejection", () => {
  it("inserts a dated rejections row", async () => {
    const pizza = await makeOption("Pizza");

    const result = await createRejection(pizza, "2026-01-10", "too heavy");

    expect(result).toEqual({ ok: true });
    const rows = await db.select().from(rejections);
    expect(rows).toHaveLength(1);
    expect(rows[0].optionId).toBe(pizza);
    expect(rows[0].rejectedOn).toBe("2026-01-10");
    expect(rows[0].reason).toBe("too heavy");
  });

  it("stores an empty or whitespace-only reason as null", async () => {
    const pizza = await makeOption("Pizza");

    await createRejection(pizza, "2026-01-10", "   ");

    const [row] = await db.select().from(rejections);
    expect(row.reason).toBeNull();
  });

  it("rejects a blank or malformed date with an inline error", async () => {
    const pizza = await makeOption("Pizza");

    expect(await createRejection(pizza, "", "")).toEqual({
      ok: false,
      error: "Pick a valid date",
    });
    expect(await createRejection(pizza, "2026-02-30", "")).toEqual({
      ok: false,
      error: "Pick a valid date",
    });
    expect(await db.select().from(rejections)).toHaveLength(0);
  });

  it("reports a malformed or stale Option id inline rather than throwing", async () => {
    // A well-formed but non-existent Option id — the FK insert fails (23503).
    const result = await createRejection(
      "00000000-0000-0000-0000-000000000000",
      "2026-01-10",
      "",
    );

    expect(result).toEqual({
      ok: false,
      error: "That option is no longer available",
    });
    expect(await db.select().from(rejections)).toHaveLength(0);
  });

  it("returns the inline collision error on a duplicate (option_id, rejected_on)", async () => {
    const pizza = await makeOption("Pizza");
    await makeRejection(pizza, "2026-01-10");

    const result = await createRejection(pizza, "2026-01-10", "again");

    expect(result).toEqual({
      ok: false,
      error: "Already rejected for that date",
    });
    // The collision is reported, not thrown — still one row.
    expect(await db.select().from(rejections)).toHaveLength(1);
  });
});

describe("updateRejection", () => {
  it("changes the Option, date, and reason of a Rejection", async () => {
    const pizza = await makeOption("Pizza");
    const tacos = await makeOption("Tacos", "restaurant");
    const id = await makeRejection(pizza, "2026-05-01", "too heavy");

    const result = await updateRejection(id, {
      optionId: tacos,
      rejectedOn: "2026-05-08",
      reason: "closed",
    });

    expect(result).toEqual({ ok: true });
    const [row] = await db
      .select()
      .from(rejections)
      .where(eq(rejections.id, id));
    expect(row.optionId).toBe(tacos);
    expect(row.rejectedOn).toBe("2026-05-08");
    expect(row.reason).toBe("closed");
  });

  it("stores a cleared reason as null", async () => {
    const pizza = await makeOption("Pizza");
    const id = await makeRejection(pizza, "2026-05-01", "too heavy");

    await updateRejection(id, {
      optionId: pizza,
      rejectedOn: "2026-05-01",
      reason: "   ",
    });

    const [row] = await db
      .select()
      .from(rejections)
      .where(eq(rejections.id, id));
    expect(row.reason).toBeNull();
  });

  it("rejects a blank date with an inline error, leaving the row untouched", async () => {
    const pizza = await makeOption("Pizza");
    const id = await makeRejection(pizza, "2026-05-01");

    const result = await updateRejection(id, {
      optionId: pizza,
      rejectedOn: "",
      reason: "",
    });

    expect(result).toEqual({ ok: false, error: "Pick a valid date" });
    const [row] = await db
      .select()
      .from(rejections)
      .where(eq(rejections.id, id));
    expect(row.rejectedOn).toBe("2026-05-01");
  });

  it("returns the inline collision error on a duplicate (option_id, rejected_on)", async () => {
    const pizza = await makeOption("Pizza");
    await makeRejection(pizza, "2026-05-01");
    const second = await makeRejection(pizza, "2026-05-02");

    // Moving the 05-02 Rejection onto 05-01 would duplicate (pizza, 2026-05-01).
    const result = await updateRejection(second, {
      optionId: pizza,
      rejectedOn: "2026-05-01",
      reason: "",
    });

    expect(result).toEqual({
      ok: false,
      error: "Already rejected for that date",
    });
    // The rejected edit is untouched — never silently merged.
    const [row] = await db
      .select()
      .from(rejections)
      .where(eq(rejections.id, second));
    expect(row.rejectedOn).toBe("2026-05-02");
  });
});

describe("deleteRejection", () => {
  it("removes the rejections row entirely", async () => {
    const pizza = await makeOption("Pizza");
    const id = await makeRejection(pizza, "2026-05-01");

    await deleteRejection(id);

    expect(await db.select().from(rejections)).toHaveLength(0);
  });
});

describe("rejectOption", () => {
  afterEach(() => {
    delete process.env.APP_TZ;
  });

  it("creates a Rejection dated the Household's calendar day", async () => {
    process.env.APP_TZ = "America/Los_Angeles";
    const today = todaySqlDate(new Date(), process.env.APP_TZ);
    const pizza = await makeOption("Pizza");

    const result = await rejectOption(pizza, "too heavy tonight");

    expect(result).toEqual({ ok: true });
    const rows = await db.select().from(rejections);
    expect(rows).toHaveLength(1);
    expect(rows[0].optionId).toBe(pizza);
    expect(rows[0].rejectedOn).toBe(today);
    expect(rows[0].reason).toBe("too heavy tonight");
  });

  it("stores an empty or whitespace-only reason as null", async () => {
    const pizza = await makeOption("Pizza");

    await rejectOption(pizza, "   ");

    const [row] = await db.select().from(rejections);
    expect(row.reason).toBeNull();
  });

  it("returns the inline collision error when the Option is already rejected today — no uncaught 500", async () => {
    process.env.APP_TZ = "America/Los_Angeles";
    const today = todaySqlDate(new Date(), process.env.APP_TZ);
    const pizza = await makeOption("Pizza");
    // A today-dated Rejection for this Option already exists — a Reject from
    // the Option detail page, or a double-tap race on Tonight's Reject.
    await makeRejection(pizza, today);

    const result = await rejectOption(pizza, "again");

    expect(result).toEqual({
      ok: false,
      error: "Already rejected for that date",
    });
    // The collision is reported inline, not thrown — still one row.
    expect(await db.select().from(rejections)).toHaveLength(1);
  });

  it("reports a stale Option id inline rather than throwing", async () => {
    const result = await rejectOption(
      "00000000-0000-0000-0000-000000000000",
      "",
    );

    expect(result).toEqual({
      ok: false,
      error: "That option is no longer available",
    });
    expect(await db.select().from(rejections)).toHaveLength(0);
  });

  it("dates a Rejection to a future Selected day when one is passed", async () => {
    // ADR-0009: live Reject on Tonight with a future Selected day creates a
    // Rejection dated that day — the same row a Planned rejection would
    // otherwise be entered from the Log screen.
    const pizza = await makeOption("Pizza");
    const future = futureSqlDate(7);

    const result = await rejectOption(
      pizza,
      "closed next Sunday",
      future,
    );

    expect(result).toEqual({ ok: true });
    const rows = await db.select().from(rejections);
    expect(rows).toHaveLength(1);
    expect(rows[0].rejectedOn).toBe(future);
  });

  it("records a past Selected day as-is (ADR-0009 amended)", async () => {
    // The Selected day can step into the past, so a Reject anchored to a past
    // day is dated that day rather than clamped to today.
    const pizza = await makeOption("Pizza");

    await rejectOption(pizza, "stale", "2025-01-01");

    const [row] = await db.select().from(rejections);
    expect(row.rejectedOn).toBe("2025-01-01");
  });
});

/**
 * A SQL date `daysAhead` days from today — used by the Selected-day tests so
 * they stay relative to whenever the suite runs.
 */
function futureSqlDate(daysAhead: number): string {
  const ms = Date.now() + daysAhead * 86_400_000;
  return todaySqlDate(new Date(ms), process.env.APP_TZ ?? "UTC");
}

describe("getLogRejections", () => {
  it("returns Rejections newest rejected_on first, each joined to its Option", async () => {
    const pizza = await makeOption("Pizza");
    const tacos = await makeOption("Tacos", "restaurant");
    await makeRejection(pizza, "2026-05-01", "too heavy");
    await makeRejection(tacos, "2026-05-10");

    const log = await getLogRejections();

    expect(log.map((row) => row.rejectedOn)).toEqual([
      "2026-05-10",
      "2026-05-01",
    ]);
    expect(log[0].optionName).toBe("Tacos");
    expect(log[0].kind).toBe("restaurant");
    expect(log[1].reason).toBe("too heavy");
  });
});

describe("getOptionRejections", () => {
  it("returns one Option's Rejections newest first, each joined to its Option", async () => {
    const pizza = await makeOption("Pizza", "restaurant");
    const tacos = await makeOption("Tacos");
    await makeRejection(pizza, "2026-05-01", "too heavy");
    await makeRejection(pizza, "2026-05-10");
    // A Rejection of another Option must not leak into Pizza's history.
    await makeRejection(tacos, "2026-05-12");

    const history = await getOptionRejections(pizza);

    expect(history).toHaveLength(2);
    expect(history.map((row) => row.rejectedOn)).toEqual([
      "2026-05-10",
      "2026-05-01",
    ]);
    // Joined to its Option — the row carries the same shape RejectionRow needs.
    expect(history[0].optionId).toBe(pizza);
    expect(history[0].optionName).toBe("Pizza");
    expect(history[0].kind).toBe("restaurant");
    expect(history[1].reason).toBe("too heavy");
  });
});
