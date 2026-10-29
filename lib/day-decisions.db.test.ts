import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";
import { dinnerLog, options, rejections } from "../db/schema";
import { truncateAll } from "../db/test-support";
import {
  addPick,
  addRejection,
  editLogEntry,
  editRejection,
} from "./day-decisions";

// CONTEXT.md, Day decision: an Option has a Pick or a Rejection on a date,
// never both, and a Pick wins.

const FRIDAY = "2026-10-23";
const SATURDAY = "2026-10-24";

beforeEach(async () => {
  await truncateAll();
});

async function makeOption(name: string): Promise<string> {
  const [row] = await db
    .insert(options)
    .values({ name, kind: "home" })
    .returning({ id: options.id });
  return row.id;
}

async function makeEntry(optionId: string, eatenOn: string): Promise<string> {
  const [row] = await db
    .insert(dinnerLog)
    .values({ optionId, eatenOn })
    .returning({ id: dinnerLog.id });
  return row.id;
}

async function makeRejection(
  optionId: string,
  rejectedOn: string,
  reason: string | null = null,
): Promise<string> {
  const [row] = await db
    .insert(rejections)
    .values({ optionId, rejectedOn, reason })
    .returning({ id: rejections.id });
  return row.id;
}

/** Each table as (Option, date) pairs, so an assertion reads as the Day decisions. */
async function picks() {
  const rows = await db.select().from(dinnerLog);
  return rows.map((row) => [row.optionId, row.eatenOn]);
}

async function rejected() {
  const rows = await db.select().from(rejections);
  return rows.map((row) => [row.optionId, row.rejectedOn]);
}

describe("addPick", () => {
  it("removes that date's Rejection of the same Option, and no other", async () => {
    const pizza = await makeOption("Pizza");
    const tacos = await makeOption("Tacos");
    await makeRejection(pizza, FRIDAY);
    await makeRejection(pizza, SATURDAY);
    await makeRejection(tacos, FRIDAY);

    await addPick({ optionId: pizza, eatenOn: FRIDAY, repeat: "refuse" });

    expect(await picks()).toEqual([[pizza, FRIDAY]]);
    expect(await rejected()).toEqual([
      [pizza, SATURDAY],
      [tacos, FRIDAY],
    ]);
  });

  it("ignores a repeat one-tap Pick but still clears a lingering Rejection", async () => {
    const pizza = await makeOption("Pizza");
    await makeEntry(pizza, FRIDAY);
    await makeRejection(pizza, FRIDAY);

    await addPick({ optionId: pizza, eatenOn: FRIDAY, repeat: "ignore" });

    expect(await picks()).toEqual([[pizza, FRIDAY]]);
    expect(await rejected()).toEqual([]);
  });

  it("throws on a repeat typed Pick and leaves the Rejection in place", async () => {
    const pizza = await makeOption("Pizza");
    await makeEntry(pizza, FRIDAY);
    await makeRejection(pizza, FRIDAY);

    await expect(
      addPick({ optionId: pizza, eatenOn: FRIDAY, repeat: "refuse" }),
    ).rejects.toThrow();

    expect(await picks()).toEqual([[pizza, FRIDAY]]);
    expect(await rejected()).toEqual([[pizza, FRIDAY]]);
  });

  it("rolls the Log entry back when clearing the Rejection fails after it", async () => {
    const pizza = await makeOption("Pizza");
    await makeRejection(pizza, FRIDAY);
    // The Rejection delete is the last statement, after the insert has
    // landed. It is private to the module, so a trigger refuses it instead.
    await db.execute(sql`
      create function refuse_delete() returns trigger language plpgsql as
        $$ begin raise exception 'delete refused'; end $$`);
    await db.execute(sql`
      create trigger refuse_rejection_delete before delete on rejections
        for each row execute function refuse_delete()`);
    try {
      await expect(
        addPick({ optionId: pizza, eatenOn: FRIDAY, repeat: "refuse" }),
      ).rejects.toThrow();
    } finally {
      await db.execute(sql`drop trigger refuse_rejection_delete on rejections`);
      await db.execute(sql`drop function refuse_delete()`);
    }

    expect(await picks()).toEqual([]);
    expect(await rejected()).toEqual([[pizza, FRIDAY]]);
  });
});

describe("editLogEntry", () => {
  it("removes the Rejection of the (Option, date) an entry is moved onto", async () => {
    const pizza = await makeOption("Pizza");
    const tacos = await makeOption("Tacos");
    const id = await makeEntry(pizza, FRIDAY);
    await makeRejection(pizza, SATURDAY);
    await makeRejection(tacos, FRIDAY);

    // Onto a new date, then onto a new Option: each lands on a Rejected pair.
    await editLogEntry(id, { optionId: pizza, eatenOn: SATURDAY, note: "" });
    expect(await rejected()).toEqual([[tacos, FRIDAY]]);

    await editLogEntry(id, { optionId: tacos, eatenOn: FRIDAY, note: "" });
    expect(await rejected()).toEqual([]);
  });

  it("throws on a collision with another entry and leaves the Rejection in place", async () => {
    const pizza = await makeOption("Pizza");
    await makeEntry(pizza, FRIDAY);
    const id = await makeEntry(pizza, SATURDAY);
    // A lingering Rejection on the occupied pair: the refused move must not
    // take it with it.
    await makeRejection(pizza, FRIDAY);

    await expect(
      editLogEntry(id, { optionId: pizza, eatenOn: FRIDAY, note: "" }),
    ).rejects.toThrow();

    expect(await rejected()).toEqual([[pizza, FRIDAY]]);
  });

  it("removes nothing when the entry no longer exists", async () => {
    const pizza = await makeOption("Pizza");
    await makeRejection(pizza, FRIDAY);

    await editLogEntry("00000000-0000-0000-0000-000000000000", {
      optionId: pizza,
      eatenOn: FRIDAY,
      note: "",
    });

    expect(await picks()).toEqual([]);
    expect(await rejected()).toEqual([[pizza, FRIDAY]]);
  });
});

describe("addRejection", () => {
  it("is refused, writing nothing, when the Option is Picked that date", async () => {
    const pizza = await makeOption("Pizza");
    await makeEntry(pizza, FRIDAY);

    expect(
      await addRejection({ optionId: pizza, rejectedOn: FRIDAY, reason: "" }),
    ).toBe("already-picked");

    expect(await rejected()).toEqual([]);
  });

  it("is saved when the Pick is on another date or of another Option", async () => {
    const pizza = await makeOption("Pizza");
    const tacos = await makeOption("Tacos");
    await makeEntry(pizza, FRIDAY);

    expect(
      await addRejection({ optionId: pizza, rejectedOn: SATURDAY, reason: "" }),
    ).toBe("saved");
    expect(
      await addRejection({ optionId: tacos, rejectedOn: FRIDAY, reason: "" }),
    ).toBe("saved");

    expect(await rejected()).toEqual([
      [pizza, SATURDAY],
      [tacos, FRIDAY],
    ]);
  });
});

describe("editRejection", () => {
  it("is refused, leaving the Rejection as it was, when moved onto a Picked date", async () => {
    const pizza = await makeOption("Pizza");
    await makeEntry(pizza, FRIDAY);
    const id = await makeRejection(pizza, SATURDAY, "Too heavy");

    expect(
      await editRejection(id, {
        optionId: pizza,
        rejectedOn: FRIDAY,
        reason: "Changed",
      }),
    ).toBe("already-picked");

    const [row] = await db.select().from(rejections);
    expect(row).toMatchObject({ rejectedOn: SATURDAY, reason: "Too heavy" });
  });

  it("is refused when moved onto an Option Picked that date", async () => {
    const pizza = await makeOption("Pizza");
    const tacos = await makeOption("Tacos");
    await makeEntry(tacos, FRIDAY);
    const id = await makeRejection(pizza, FRIDAY);

    expect(
      await editRejection(id, { optionId: tacos, rejectedOn: FRIDAY, reason: "" }),
    ).toBe("already-picked");

    expect(await rejected()).toEqual([[pizza, FRIDAY]]);
  });
});
