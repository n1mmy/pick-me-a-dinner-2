import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db";
import { getTodayRejections, getTonightData } from "../db/queries";
import { dayNotes, dinnerLog, options, rejections } from "../db/schema";
import { truncateAll } from "../db/test-support";
import { setDayNote } from "./day-note-actions";

// revalidatePath needs a Next request scope; tests exercise the DB writes only.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// The action is authedAction-wrapped (F1); stub the session check so the tests
// drive the action body directly.
vi.mock("../lib/require-session", () => ({
  requireSession: vi.fn(async () => {}),
}));

const FRIDAY = "2026-10-16";
const SATURDAY = "2026-10-17";

/** The Selected day's Day note as Tonight reads it. */
async function dayNoteOn(day: string): Promise<string | null> {
  return (await getTonightData(day)).dayNote;
}

beforeEach(async () => {
  await truncateAll();
});

describe("setDayNote", () => {
  it("saves a Day note that Tonight reads back for that date", async () => {
    const result = await setDayNote(FRIDAY, "Jen won't be around");

    expect(result).toEqual({ ok: true });
    expect(await dayNoteOn(FRIDAY)).toBe("Jen won't be around");
  });

  it("replaces the date's existing Day note, keeping one row per date", async () => {
    await setDayNote(FRIDAY, "Jen won't be around");

    const result = await setDayNote(FRIDAY, "Guests over");

    expect(result).toEqual({ ok: true });
    expect(await dayNoteOn(FRIDAY)).toBe("Guests over");
    expect(await db.select().from(dayNotes)).toHaveLength(1);
  });

  it.each([
    ["empty", ""],
    ["whitespace-only", "   "],
  ])("deletes the date's Day note when given %s text", async (_, text) => {
    await setDayNote(FRIDAY, "Jen won't be around");

    const result = await setDayNote(FRIDAY, text);

    expect(result).toEqual({ ok: true });
    expect(await dayNoteOn(FRIDAY)).toBeNull();
    expect(await db.select().from(dayNotes)).toHaveLength(0);
  });

  it("does nothing when clearing a date that has no Day note", async () => {
    await setDayNote(SATURDAY, "Guests over");

    const result = await setDayNote(FRIDAY, "");

    expect(result).toEqual({ ok: true });
    expect(await dayNoteOn(FRIDAY)).toBeNull();
    expect(await dayNoteOn(SATURDAY)).toBe("Guests over");
  });

  it("trims the note the way a Log entry's Note is trimmed", async () => {
    await setDayNote(FRIDAY, "  Late back from the airport \n");

    expect(await dayNoteOn(FRIDAY)).toBe("Late back from the airport");
  });

  it("leaves that date's Log entries and Rejections untouched", async () => {
    const [pizza] = await db
      .insert(options)
      .values({ name: "Pizza", kind: "restaurant" })
      .returning({ id: options.id });
    await db
      .insert(dinnerLog)
      .values({ optionId: pizza.id, eatenOn: FRIDAY, note: "extra cheese" });
    await db
      .insert(rejections)
      .values({ optionId: pizza.id, rejectedOn: FRIDAY, reason: "too far" });

    await setDayNote(FRIDAY, "Jen won't be around");
    await setDayNote(FRIDAY, "");

    const { todayEntries } = await getTonightData(FRIDAY);
    expect(todayEntries.map((entry) => entry.note)).toEqual(["extra cheese"]);
    const fridayRejections = await getTodayRejections(FRIDAY);
    expect(fridayRejections.map((r) => r.reason)).toEqual(["too far"]);
  });
});

describe("getTonightData — Day note", () => {
  it("returns null for a date with no Day note", async () => {
    expect(await dayNoteOn(FRIDAY)).toBeNull();
  });
});
