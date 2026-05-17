import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { dinnerLog, optionTags, options, tags } from "../db/schema";
import { truncateAll } from "../db/test-support";
import {
  localMidnightUtc,
  mapPriorData,
  runImport,
  type PriorData,
} from "./import-prior-data";

const LA = "America/Los_Angeles";

/** A prior-app `Meal` row, with sensible defaults overridable per test. */
function meal(over: Partial<PriorData["meals"][number]> = {}) {
  return {
    id: "meal_cuid_1",
    name: "Pasta",
    notes: null,
    createdAt: "2024-01-02T03:04:05.000Z",
    hidden: false,
    tags: [],
    ...over,
  };
}

/** A prior-app `Restaurant` row, with sensible defaults overridable per test. */
function restaurant(over: Partial<PriorData["restaurants"][number]> = {}) {
  return {
    id: "rest_cuid_1",
    name: "El Comal",
    notes: null,
    createdAt: "2024-02-03T04:05:06.000Z",
    hidden: false,
    tags: [],
    phoneNumber: null,
    orderUrl: null,
    menuUrl: null,
    ...over,
  };
}

/** A prior-app `Dinner` row, with sensible defaults overridable per test. */
function dinner(over: Partial<PriorData["dinners"][number]> = {}) {
  return {
    id: "dinner_cuid_1",
    date: "2026-03-09",
    notes: null,
    type: "meal",
    mealId: "meal_cuid_1",
    restaurantId: null,
    ...over,
  };
}

function priorData(over: Partial<PriorData> = {}): PriorData {
  return { meals: [], restaurants: [], dinners: [], ...over };
}

describe("localMidnightUtc", () => {
  it("anchors a summer date at PDT (UTC-7) midnight", () => {
    expect(localMidnightUtc("2026-03-09", LA).toISOString()).toBe(
      "2026-03-09T07:00:00.000Z",
    );
  });

  it("anchors a winter date at PST (UTC-8) midnight", () => {
    expect(localMidnightUtc("2026-01-15", LA).toISOString()).toBe(
      "2026-01-15T08:00:00.000Z",
    );
  });

  it("treats midnight as UTC for the UTC zone", () => {
    expect(localMidnightUtc("2026-05-16", "UTC").toISOString()).toBe(
      "2026-05-16T00:00:00.000Z",
    );
  });
});

describe("mapPriorData", () => {
  it("maps a Meal to a home Option and a Restaurant to a restaurant Option", () => {
    const rows = mapPriorData(
      priorData({ meals: [meal()], restaurants: [restaurant()] }),
      LA,
    );

    const home = rows.options.find((o) => o.name === "Pasta");
    const rest = rows.options.find((o) => o.name === "El Comal");
    expect(home?.kind).toBe("home");
    expect(rest?.kind).toBe("restaurant");
    // Fresh uuids — the prior text cuids are not reused.
    expect(home?.id).not.toBe("meal_cuid_1");
    expect(rest?.id).not.toBe("rest_cuid_1");
    // Restaurant fields absent from the prior schema import as null.
    expect(rest?.address).toBeNull();
    expect(rest?.lat).toBeNull();
    expect(rest?.lng).toBeNull();
    expect(rest?.googlePlaceId).toBeNull();
    expect(rest?.mapsUrl).toBeNull();
    // A Home meal has no url.
    expect(home?.url).toBeNull();
  });

  it("inverts hidden into active", () => {
    const rows = mapPriorData(
      priorData({
        meals: [
          meal({ id: "m1", name: "Shown", hidden: false }),
          meal({ id: "m2", name: "Hidden", hidden: true }),
        ],
      }),
      LA,
    );

    expect(rows.options.find((o) => o.name === "Shown")?.active).toBe(true);
    expect(rows.options.find((o) => o.name === "Hidden")?.active).toBe(false);
  });

  it("coalesces orderUrl and menuUrl into a single url", () => {
    const rows = mapPriorData(
      priorData({
        restaurants: [
          restaurant({ id: "r1", name: "Order", orderUrl: "https://order" }),
          restaurant({ id: "r2", name: "Menu", menuUrl: "https://menu" }),
          restaurant({ id: "r3", name: "Neither" }),
        ],
      }),
      LA,
    );

    expect(rows.options.find((o) => o.name === "Order")?.url).toBe(
      "https://order",
    );
    expect(rows.options.find((o) => o.name === "Menu")?.url).toBe(
      "https://menu",
    );
    expect(rows.options.find((o) => o.name === "Neither")?.url).toBeNull();
  });

  it("maps phoneNumber to phone", () => {
    const rows = mapPriorData(
      priorData({ restaurants: [restaurant({ phoneNumber: "555-1234" })] }),
      LA,
    );
    expect(rows.options[0].phone).toBe("555-1234");
  });

  it("normalizes Tags and dedupes them across every Option", () => {
    const rows = mapPriorData(
      priorData({
        meals: [meal({ id: "m1", name: "A", tags: ["  Pasta ", "PASTA"] })],
        restaurants: [
          restaurant({ id: "r1", name: "B", tags: ["pasta", "Fish"] }),
        ],
      }),
      LA,
    );

    // "Pasta", "PASTA", "pasta" collapse to one shared Tag row; "Fish" is the second.
    expect(rows.tags.map((t) => t.name).sort()).toEqual(["fish", "pasta"]);
    // Meal A links only to "pasta" once despite listing it twice.
    const optionA = rows.options.find((o) => o.name === "A");
    const aLinks = rows.optionTags.filter((l) => l.optionId === optionA?.id);
    expect(aLinks).toHaveLength(1);
    // Both Options point at the same shared "pasta" Tag uuid.
    const optionB = rows.options.find((o) => o.name === "B");
    const pastaTagId = rows.tags.find((t) => t.name === "pasta")?.id;
    expect(aLinks[0].tagId).toBe(pastaTagId);
    expect(
      rows.optionTags.some(
        (l) => l.optionId === optionB?.id && l.tagId === pastaTagId,
      ),
    ).toBe(true);
  });

  it("rewires a Dinner's FK to the mapped Option and sets created_at to local midnight", () => {
    const rows = mapPriorData(
      priorData({
        meals: [meal({ id: "m1", name: "Pasta" })],
        dinners: [
          dinner({ id: "d1", date: "2026-03-09", notes: "tasty", mealId: "m1" }),
        ],
      }),
      LA,
    );

    const option = rows.options.find((o) => o.name === "Pasta");
    expect(rows.dinnerLog).toHaveLength(1);
    expect(rows.dinnerLog[0].optionId).toBe(option?.id);
    expect(rows.dinnerLog[0].eatenOn).toBe("2026-03-09");
    expect(rows.dinnerLog[0].note).toBe("tasty");
    expect((rows.dinnerLog[0].createdAt as Date).toISOString()).toBe(
      "2026-03-09T07:00:00.000Z",
    );
  });

  it("resolves a Dinner that references a Restaurant", () => {
    const rows = mapPriorData(
      priorData({
        restaurants: [restaurant({ id: "r1", name: "El Comal" })],
        dinners: [
          dinner({ id: "d1", type: "restaurant", mealId: null, restaurantId: "r1" }),
        ],
      }),
      LA,
    );
    const option = rows.options.find((o) => o.name === "El Comal");
    expect(rows.dinnerLog[0].optionId).toBe(option?.id);
  });

  it("throws on a Dinner whose Option FK cannot be resolved", () => {
    expect(() =>
      mapPriorData(
        priorData({ dinners: [dinner({ id: "d1", mealId: "missing" })] }),
        LA,
      ),
    ).toThrow(/unknown Option/);
  });
});

describe("runImport", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("imports the prior Catalog and Log into the v1 schema in one pass", async () => {
    const summary = await runImport(
      priorData({
        meals: [
          meal({ id: "m1", name: "Pasta", hidden: false, tags: ["quick"] }),
        ],
        restaurants: [
          restaurant({
            id: "r1",
            name: "El Comal",
            hidden: true,
            phoneNumber: "555-1234",
            orderUrl: "https://order",
            tags: ["quick", "mexican"],
          }),
        ],
        dinners: [
          dinner({ id: "d1", date: "2026-03-09", mealId: "m1" }),
          dinner({
            id: "d2",
            date: "2026-01-15",
            type: "restaurant",
            mealId: null,
            restaurantId: "r1",
          }),
        ],
      }),
      LA,
    );

    expect(summary).toEqual({ options: 2, tags: 2, dinnerLog: 2 });
    expect(await db.select().from(options)).toHaveLength(2);
    expect(await db.select().from(tags)).toHaveLength(2);
    expect(await db.select().from(optionTags)).toHaveLength(3);
    expect(await db.select().from(dinnerLog)).toHaveLength(2);

    const [archived] = await db
      .select()
      .from(options)
      .where(eq(options.name, "El Comal"));
    expect(archived.active).toBe(false);
    expect(archived.url).toBe("https://order");
    expect(archived.phone).toBe("555-1234");

    const [logged] = await db
      .select()
      .from(dinnerLog)
      .where(eq(dinnerLog.eatenOn, "2026-03-09"));
    expect(logged.createdAt.toISOString()).toBe("2026-03-09T07:00:00.000Z");
  });

  it("rolls the whole import back on any failure, leaving the DB untouched", async () => {
    // Two Dinners on the same Option and date violate UNIQUE(option_id, eaten_on).
    const doomed = priorData({
      meals: [meal({ id: "m1", name: "Pasta", tags: ["quick"] })],
      dinners: [
        dinner({ id: "d1", date: "2026-03-09", mealId: "m1" }),
        dinner({ id: "d2", date: "2026-03-09", mealId: "m1" }),
      ],
    });

    await expect(runImport(doomed, LA)).rejects.toThrow();

    // The Option and Tag inserted earlier in the transaction are rolled back too.
    expect(await db.select().from(options)).toHaveLength(0);
    expect(await db.select().from(tags)).toHaveLength(0);
    expect(await db.select().from(optionTags)).toHaveLength(0);
    expect(await db.select().from(dinnerLog)).toHaveLength(0);
  });
});
