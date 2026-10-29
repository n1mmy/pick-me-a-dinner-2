import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";
import { dayNotes, dinnerLog, options, rejections } from "../db/schema";
import { truncateAll } from "../db/test-support";
import { snapshotForDay } from "./snapshot";

const SATURDAY = "2026-10-24";

beforeEach(async () => {
  await truncateAll();
});

async function seed(
  name: string,
  values: Partial<typeof options.$inferInsert> = {},
): Promise<string> {
  const [row] = await db
    .insert(options)
    .values({ name, kind: "home", ...values })
    .returning({ id: options.id });
  return row.id;
}

/** The candidate names, in snapshot order. */
function candidateNames(snapshot: { options: { name: string }[] }): string[] {
  return snapshot.options.map((option) => option.name);
}

describe("snapshotForDay", () => {
  it("drops the Options Picked, Rejected, and Closed for the date from the candidates", async () => {
    const apple = await seed("Apple Crumble");
    const banana = await seed("Banana Bread");
    const carrot = await seed("Carrot Cake");
    await seed("Dumpling Bar", {
      kind: "restaurant",
      closedDays: [6], // Saturdays
    });
    await db.insert(dinnerLog).values({ optionId: apple, eatenOn: SATURDAY });
    await db
      .insert(rejections)
      .values({ optionId: banana, rejectedOn: SATURDAY, reason: "Too sweet" });

    const { snapshot, idByCode, nameById } = await snapshotForDay({
      asOf: SATURDAY,
      query: "",
    });

    expect(candidateNames(snapshot)).toEqual(["Carrot Cake"]);
    expect([...idByCode.values()]).toEqual([carrot]);
    expect(nameById.get(apple)).toBe("Apple Crumble");
  });

  it("carries Log entries, Rejections, and Day notes as dated history", async () => {
    const apple = await seed("Apple Crumble");
    const banana = await seed("Banana Bread");
    await db
      .insert(dinnerLog)
      .values([
        { optionId: apple, eatenOn: "2026-10-20", note: "Leftovers" },
        { optionId: banana, eatenOn: "2026-10-31" },
      ]);
    await db
      .insert(rejections)
      .values({ optionId: banana, rejectedOn: "2026-10-21", reason: "Too sweet" });
    await db.insert(dayNotes).values([
      { notedOn: "2026-10-22", note: "Guests over" },
      { notedOn: SATURDAY, note: "Out late" },
    ]);

    const { snapshot } = await snapshotForDay({ asOf: SATURDAY, query: "" });

    expect(snapshot.today).toBe("2026-10-24 (Saturday)");
    expect(snapshot.log.map((entry) => entry.date)).toEqual([
      "2026-10-31 (Saturday)",
      "2026-10-20 (Tuesday)",
    ]);
    expect(snapshot.rejections.notTodayRejections).toMatchObject([
      {
        date: "2026-10-21 (Wednesday)",
        reason: "Too sweet",
      },
    ]);
    expect(snapshot.dayNotes).toEqual([
      {
        date: "2026-10-22 (Thursday)",
        note: "Guests over",
      },
    ]);
    expect(snapshot.todayDayNote).toBe("Out late");
  });
});
