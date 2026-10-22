import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";
import { dayNotes, dinnerLog, options } from "../db/schema";
import { truncateAll } from "../db/test-support";
import type { PreparedNoteClient } from "./prepared-note";
import { runSweep } from "./prepared-notes-job";
import { tonightPreparedNote } from "./tonight-prepared-note";

const SATURDAY = "2026-10-24";

/** A stand-in for the local model: one brief per date, every candidate ranked. */
const client: PreparedNoteClient = {
  async prepare(snapshot, idByIndex) {
    return {
      ok: true,
      note: {
        brief: `Brief for ${snapshot.today}`,
        ranking: [...idByIndex.values()].map((id) => ({ id, reason: "Fits." })),
      },
    };
  },
};

/** One sweep at Thursday 2026-10-22, noon in Los Angeles: notes for the week. */
function sweep(): Promise<void> {
  return runSweep({
    now: new Date("2026-10-22T19:00:00Z"),
    timeZone: "America/Los_Angeles",
    client,
    model: "qwen",
  });
}

let phoId: string;

beforeEach(async () => {
  await truncateAll();
  const [pho] = await db
    .insert(options)
    .values({ name: "Pho", kind: "restaurant" })
    .returning({ id: options.id });
  phoId = pho.id;
});

describe("tonightPreparedNote", () => {
  it("is null for a date with no note", async () => {
    expect(
      await tonightPreparedNote({ day: SATURDAY, decided: false, model: "qwen" }),
    ).toBeNull();
  });

  it("returns a freshly prepared note, not out of date", async () => {
    await sweep();

    expect(
      await tonightPreparedNote({ day: SATURDAY, decided: false, model: "qwen" }),
    ).toEqual({
      brief: "Brief for 2026-10-24 (Saturday)",
      ranking: [{ id: phoId, reason: "Fits." }],
      preparedAt: expect.any(Date),
      outOfDate: false,
    });
  });

  it("is out of date once the date's input changes after the note was written", async () => {
    await sweep();
    await db.insert(dayNotes).values({ notedOn: SATURDAY, note: "Guests over" });

    expect(
      await tonightPreparedNote({ day: SATURDAY, decided: false, model: "qwen" }),
    ).toMatchObject({ brief: "Brief for 2026-10-24 (Saturday)", outOfDate: true });
  });

  it("never marks a decided date's frozen note out of date", async () => {
    await sweep();
    await db.insert(dinnerLog).values({ optionId: phoId, eatenOn: SATURDAY });
    await db.insert(dayNotes).values({ notedOn: SATURDAY, note: "Guests over" });

    expect(
      await tonightPreparedNote({ day: SATURDAY, decided: true, model: "qwen" }),
    ).toMatchObject({ brief: "Brief for 2026-10-24 (Saturday)", outOfDate: false });
  });
});
