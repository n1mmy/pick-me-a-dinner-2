import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";
import { getPreparedNote } from "../db/queries";
import { dayNotes, dinnerLog, options, preparedNotes } from "../db/schema";
import { truncateAll } from "../db/test-support";
import type { PreparedNoteClient } from "./prepared-note";
import {
  claimDay,
  releaseClaim,
  runSweep,
  storeNote,
} from "./prepared-notes-job";

const FRIDAY = "2026-10-23";

beforeEach(async () => {
  await truncateAll();
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

const KATSU = "11111111-1111-4111-8111-111111111111";
const PHO = "33333333-3333-4333-8333-333333333333";

const note = {
  brief: "A quiet Friday.",
  ranking: [
    { id: PHO, reason: "The standing Friday choice." },
    { id: KATSU, reason: "Long cook." },
  ],
};

describe("storeNote", () => {
  it("writes the note for Tonight to read and frees the date for the next claim", async () => {
    await claimDay(FRIDAY);

    await storeNote(FRIDAY, { note, inputHash: "hash-1", model: "qwen" });

    expect(await getPreparedNote(FRIDAY)).toEqual({
      brief: "A quiet Friday.",
      ranking: note.ranking,
      inputHash: "hash-1",
      model: "qwen",
      preparedAt: expect.any(Date),
    });
    expect(await claimDay(FRIDAY)).toEqual({ inputHash: "hash-1" });
  });
});

describe("releaseClaim", () => {
  it("frees the date and keeps the previous note untouched", async () => {
    await claimDay(FRIDAY);
    await storeNote(FRIDAY, { note, inputHash: "hash-1", model: "qwen" });
    const stored = await getPreparedNote(FRIDAY);
    await claimDay(FRIDAY);

    await releaseClaim(FRIDAY);

    expect(await getPreparedNote(FRIDAY)).toEqual(stored);
    expect(await claimDay(FRIDAY)).toEqual({ inputHash: "hash-1" });
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
 * dates whose generation comes back unavailable.
 */
function stubClient({ fail = [] as string[] } = {}) {
  const asked: string[] = [];
  const client: PreparedNoteClient = {
    async prepare(snapshot, idByIndex) {
      const date = snapshot.today.slice(0, 10);
      asked.push(date);
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

/** One sweep at Thursday noon in Los Angeles. */
function sweep(client: PreparedNoteClient, model = "qwen"): Promise<void> {
  return runSweep({ now: THURSDAY_NOON, timeZone: LA, client, model });
}

async function seedPho(): Promise<string> {
  const [pho] = await db
    .insert(options)
    .values({ name: "Pho", kind: "restaurant" })
    .returning({ id: options.id });
  return pho.id;
}

describe("runSweep", () => {
  it("writes a note for each of the next seven dates, one at a time, today first", async () => {
    const phoId = await seedPho();
    const { client, asked } = stubClient();

    await runSweep({ now: THURSDAY_NOON, timeZone: LA, client, model: "qwen" });

    expect(asked).toEqual(WEEK);
    expect(await getPreparedNote("2026-10-24")).toMatchObject({
      brief: "Brief for 2026-10-24 (Saturday)",
      ranking: [{ id: phoId, reason: "Fits." }],
      model: "qwen",
    });
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
    await db
      .insert(dayNotes)
      .values({ notedOn: "2026-10-24", note: "Guests over" });
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
    await db
      .insert(dayNotes)
      .values({ notedOn: "2026-10-24", note: "Guests over" });

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
    await db
      .insert(dayNotes)
      .values({ notedOn: "2026-10-24", note: "Guests over" });
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
    const second = stubClient();

    await sweep(second.client, "qwen-next");

    expect(second.asked).toEqual(WEEK);
    expect((await getPreparedNote("2026-10-22"))?.model).toBe("qwen-next");
  });
});

describe("getPreparedNote", () => {
  it("is null for a date with no note, even while it is claimed", async () => {
    expect(await getPreparedNote(FRIDAY)).toBeNull();

    await claimDay(FRIDAY);

    expect(await getPreparedNote(FRIDAY)).toBeNull();
  });
});
