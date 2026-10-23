import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db";
import { getPreparedNote } from "../db/queries";
import { dayNotes, dinnerLog, options, preparedNotes } from "../db/schema";
import { truncateAll } from "../db/test-support";
import type { PreparedNoteClient } from "./prepared-note";
import { claimDay, preparedNoteFor, runSweep } from "./prepared-notes";

const FRIDAY = "2026-10-23";

beforeEach(async () => {
  await truncateAll();
  vi.stubEnv("LOCAL_AI_MODEL", "qwen");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("claimDay", () => {
  it("claims a date nobody holds, and a live claim blocks a second one", async () => {
    expect(await claimDay(FRIDAY)).toEqual({ inputHash: null });
    expect(await claimDay(FRIDAY)).toBeNull();
  });

  it("gives exactly one of two simultaneous claims the date", async () => {
    const claims = await Promise.all([claimDay(FRIDAY), claimDay(FRIDAY)]);

    expect(claims.filter((claim) => claim !== null)).toHaveLength(1);
  });

  it("lets an expired claim be taken again", async () => {
    await claimDay(FRIDAY);
    // Nothing in the interface moves the lease clock, so age it directly: this
    // stands in for a replica that died twenty minutes into a generation.
    await db
      .update(preparedNotes)
      .set({ claimedUntil: sql`now() - interval '1 minute'` })
      .where(eq(preparedNotes.preparedFor, FRIDAY));

    expect(await claimDay(FRIDAY)).toEqual({ inputHash: null });
  });
});

/** 19:00 UTC on Thursday 2026-10-22 — noon in Los Angeles. */
const THURSDAY_NOON = new Date("2026-10-22T19:00:00Z");
const LA = "America/Los_Angeles";
const WEEK = [
  "2026-10-22",
  "2026-10-23",
  "2026-10-24",
  "2026-10-25",
  "2026-10-26",
  "2026-10-27",
  "2026-10-28",
];

/**
 * A stand-in for the local model: records which dates it was asked about, and
 * writes a note naming the date and ranking every candidate. `fail` lists the
 * dates whose generation comes back unavailable; `during` runs while a date is
 * being generated, standing in for the Household acting mid-sweep.
 */
function stubClient({
  fail = [] as string[],
  during = async (date: string) => void date,
} = {}) {
  const asked: string[] = [];
  const client: PreparedNoteClient = {
    async prepare({ snapshot, idByIndex }) {
      const date = snapshot.today.slice(0, 10);
      asked.push(date);
      await during(date);
      if (fail.includes(date)) return { ok: false };
      return {
        ok: true,
        note: {
          brief: `Brief for ${snapshot.today}`,
          ranking: [...idByIndex.values()].map((id) => ({ id, reason: "Fits." })),
        },
      };
    },
  };
  return { client, asked };
}

/** One sweep, by default at Thursday noon in Los Angeles. */
function sweep(client: PreparedNoteClient, now = THURSDAY_NOON): Promise<void> {
  return runSweep({ now, timeZone: LA, client });
}

async function seedPho(): Promise<string> {
  const [pho] = await db
    .insert(options)
    .values({ name: "Pho", kind: "restaurant" })
    .returning({ id: options.id });
  return pho.id;
}

/** Change a date's input, so its note goes stale. */
async function addDayNote(date: string): Promise<void> {
  await db.insert(dayNotes).values({ notedOn: date, note: "Guests over" });
}

describe("runSweep", () => {
  it("writes a note for each of the next seven dates, one at a time, today first", async () => {
    const phoId = await seedPho();
    const { client, asked } = stubClient();

    await sweep(client);

    expect(asked).toEqual(WEEK);
    expect(await getPreparedNote("2026-10-24")).toMatchObject({
      brief: "Brief for 2026-10-24 (Saturday)",
      ranking: [{ id: phoId, reason: "Fits." }],
      model: "qwen",
    });
  });

  it("starts from the Household's day, not UTC's, late in the evening", async () => {
    await seedPho();
    const { client, asked } = stubClient();

    // 22:30 on Thursday the 22nd in Los Angeles is already Friday in UTC.
    await sweep(client, new Date("2026-10-23T05:30:00Z"));

    expect(asked).toEqual(WEEK);
  });

  it("rolls over the end of a month", async () => {
    await seedPho();
    const { client, asked } = stubClient();

    await sweep(client, new Date("2026-10-29T19:00:00Z"));

    expect(asked).toEqual([
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
    ]);
  });

  it("prepares nothing on a second pass when nothing has changed", async () => {
    await seedPho();
    await sweep(stubClient().client);
    const second = stubClient();

    await sweep(second.client);

    expect(second.asked).toEqual([]);
  });

  it("regenerates the notes once their input changes", async () => {
    await seedPho();
    await sweep(stubClient().client);
    const before = await getPreparedNote("2026-10-24");
    await addDayNote("2026-10-24");
    const second = stubClient();

    await sweep(second.client);

    expect(second.asked).toEqual(WEEK);
    expect((await getPreparedNote("2026-10-24"))?.inputHash).not.toBe(
      before?.inputHash,
    );
  });

  it("keeps the last good note and frees the date when a generation fails", async () => {
    await seedPho();
    await sweep(stubClient().client);
    const before = await getPreparedNote("2026-10-24");
    await addDayNote("2026-10-24");

    await sweep(stubClient({ fail: ["2026-10-24"] }).client);

    expect(await getPreparedNote("2026-10-24")).toEqual(before);
    expect(await claimDay("2026-10-24")).toEqual({
      inputHash: before?.inputHash,
    });
  });

  it("freezes a date's note once it has a Pick, and thaws it when the Pick goes", async () => {
    const phoId = await seedPho();
    await sweep(stubClient().client);
    const frozen = await getPreparedNote("2026-10-24");
    const [pick] = await db
      .insert(dinnerLog)
      .values({ optionId: phoId, eatenOn: "2026-10-24" })
      .returning({ id: dinnerLog.id });
    // Something changes while the date is decided: its note must not follow.
    await addDayNote("2026-10-24");
    const decided = stubClient();

    await sweep(decided.client);

    expect(decided.asked).toEqual(WEEK.filter((day) => day !== "2026-10-24"));
    expect(await getPreparedNote("2026-10-24")).toEqual(frozen);

    await db.delete(dinnerLog).where(eq(dinnerLog.id, pick.id));
    const undecided = stubClient();

    await sweep(undecided.client);

    expect(undecided.asked).toContain("2026-10-24");
    expect(await getPreparedNote("2026-10-24")).not.toEqual(frozen);
  });

  it("freezes a date whose only Pick is of an Option since Archived", async () => {
    const phoId = await seedPho();
    await sweep(stubClient().client);
    const frozen = await getPreparedNote("2026-10-24");
    await db.insert(dinnerLog).values({ optionId: phoId, eatenOn: "2026-10-24" });
    await db.update(options).set({ active: false }).where(eq(options.id, phoId));
    await addDayNote("2026-10-24");
    const second = stubClient();

    await sweep(second.client);

    expect(second.asked).not.toContain("2026-10-24");
    expect(await getPreparedNote("2026-10-24")).toEqual(frozen);
  });

  it("leaves the stored note alone when a Pick lands while the date is being generated", async () => {
    const phoId = await seedPho();
    await sweep(stubClient().client);
    const before = await getPreparedNote("2026-10-24");
    await addDayNote("2026-10-24");
    const second = stubClient({
      during: async (date) => {
        if (date === "2026-10-24") {
          await db.insert(dinnerLog).values({ optionId: phoId, eatenOn: date });
        }
      },
    });

    await sweep(second.client);

    expect(second.asked).toContain("2026-10-24");
    expect(await getPreparedNote("2026-10-24")).toEqual(before);
    expect(await claimDay("2026-10-24")).toEqual({
      inputHash: before?.inputHash,
    });
  });

  it("leaves a date to the replica that holds its claim", async () => {
    await seedPho();
    await claimDay("2026-10-23");
    const { client, asked } = stubClient();

    await sweep(client);

    expect(asked).toEqual(WEEK.filter((day) => day !== "2026-10-23"));
    expect(await getPreparedNote("2026-10-23")).toBeNull();
  });

  it("regenerates the notes when the model changes", async () => {
    await seedPho();
    await sweep(stubClient().client);
    vi.stubEnv("LOCAL_AI_MODEL", "qwen-next");
    const second = stubClient();

    await sweep(second.client);

    expect(second.asked).toEqual(WEEK);
    expect((await getPreparedNote("2026-10-22"))?.model).toBe("qwen-next");
  });
});

describe("preparedNoteFor", () => {
  const SATURDAY = "2026-10-24";
  const THURSDAY = "2026-10-22";

  it("is null for a date with no note, even while it is claimed", async () => {
    expect(await preparedNoteFor({ day: SATURDAY, today: THURSDAY })).toBeNull();

    await claimDay(SATURDAY);

    expect(await preparedNoteFor({ day: SATURDAY, today: THURSDAY })).toBeNull();
  });

  it("returns a freshly prepared note as current", async () => {
    const phoId = await seedPho();
    await sweep(stubClient().client);

    expect(await preparedNoteFor({ day: SATURDAY, today: THURSDAY })).toEqual({
      brief: "Brief for 2026-10-24 (Saturday)",
      ranking: [{ id: phoId, reason: "Fits." }],
      preparedAt: expect.any(Date),
      status: "current",
    });
  });

  it("is out of date once the date's input changes after the note was written", async () => {
    await seedPho();
    await sweep(stubClient().client);
    await addDayNote(SATURDAY);

    expect(await preparedNoteFor({ day: SATURDAY, today: THURSDAY })).toMatchObject({
      brief: "Brief for 2026-10-24 (Saturday)",
      status: "out-of-date",
    });
  });

  it("is frozen once the date has a Pick, whatever changes after", async () => {
    const phoId = await seedPho();
    await sweep(stubClient().client);
    await db.insert(dinnerLog).values({ optionId: phoId, eatenOn: SATURDAY });
    await addDayNote(SATURDAY);

    expect(await preparedNoteFor({ day: SATURDAY, today: THURSDAY })).toMatchObject({
      brief: "Brief for 2026-10-24 (Saturday)",
      status: "frozen",
    });
  });

  it("is frozen when the date's only Pick is of an Option since Archived", async () => {
    const phoId = await seedPho();
    await sweep(stubClient().client);
    await db.insert(dinnerLog).values({ optionId: phoId, eatenOn: SATURDAY });
    await db.update(options).set({ active: false }).where(eq(options.id, phoId));

    expect(await preparedNoteFor({ day: SATURDAY, today: THURSDAY })).toMatchObject({
      status: "frozen",
    });
  });

  it("is frozen once the date has passed, though its input has changed since", async () => {
    await seedPho();
    await sweep(stubClient().client);
    await addDayNote(THURSDAY);

    expect(
      await preparedNoteFor({ day: THURSDAY, today: "2026-10-23" }),
    ).toMatchObject({
      brief: "Brief for 2026-10-22 (Thursday)",
      status: "frozen",
    });
  });
});
