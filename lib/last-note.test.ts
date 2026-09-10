import { describe, expect, it } from "vitest";
import { lastNotesByOption, noteAge, type NotedLogEntry } from "./last-note";

/** Day 100 stands in for the Selected day throughout; entries are dated around it. */
const ANCHOR = 100;

/**
 * A Log entry. `createdAt` defaults to a fixed instant — only the same-date
 * tie-break test varies it, so every other case reads without the noise.
 */
function entry(
  optionId: string,
  eatenOn: number,
  note: string | null,
  createdAt = "2026-01-01T18:00:00Z",
): NotedLogEntry {
  return { optionId, eatenOn, note, createdAt: new Date(createdAt) };
}

describe("lastNotesByOption", () => {
  it("takes the newest noted entry before the anchor day", () => {
    const notes = lastNotesByOption(
      [
        entry("o1", 60, "the old one"),
        entry("o1", 82, "got the katsu curry"),
        entry("o1", 71, "in between"),
      ],
      ANCHOR,
    );

    expect(notes.get("o1")).toEqual({
      text: "got the katsu curry",
      daysAgo: 18,
    });
  });

  it("skips entries with no note, so the newest *noted* one wins", () => {
    // Eaten 3 days ago with nothing written; the note that survives is older.
    const notes = lastNotesByOption(
      [entry("o1", 97, null), entry("o1", 60, "too much rice")],
      ANCHOR,
    );

    expect(notes.get("o1")).toEqual({ text: "too much rice", daysAgo: 40 });
  });

  it("treats a whitespace-only note as empty and trims the one it keeps", () => {
    const notes = lastNotesByOption(
      [entry("o1", 97, "   \n  "), entry("o1", 60, "  too much rice  ")],
      ANCHOR,
    );

    expect(notes.get("o1")).toEqual({ text: "too much rice", daysAgo: 40 });
  });

  it("ignores the anchor day itself, so a Pick is never its own Last note", () => {
    // The Selected day's own Pick is shown and edited on the decided row; it
    // must not also be that row's "Last time".
    const notes = lastNotesByOption(
      [entry("o1", ANCHOR, "tonight's note"), entry("o1", 88, "last time")],
      ANCHOR,
    );

    expect(notes.get("o1")).toEqual({ text: "last time", daysAgo: 12 });
  });

  it("ignores entries dated after the anchor day", () => {
    // A Planned dinner's note is not something that has happened yet.
    const notes = lastNotesByOption([entry("o1", 105, "for Friday")], ANCHOR);

    expect(notes.has("o1")).toBe(false);
  });

  it("omits an Option whose every note is empty", () => {
    const notes = lastNotesByOption(
      [entry("o1", 90, null), entry("o1", 95, "")],
      ANCHOR,
    );

    expect(notes.has("o1")).toBe(false);
    expect(notes.size).toBe(0);
  });

  it("keys each Option's note separately", () => {
    const notes = lastNotesByOption(
      [entry("o1", 90, "curry"), entry("o2", 95, "pizza")],
      ANCHOR,
    );

    expect(notes.get("o1")?.text).toBe("curry");
    expect(notes.get("o2")?.text).toBe("pizza");
  });

  it("breaks a same-date tie by createdAt", () => {
    const notes = lastNotesByOption(
      [
        entry("o1", 90, "first sitting", "2026-01-01T12:00:00Z"),
        entry("o1", 90, "second sitting", "2026-01-01T20:00:00Z"),
      ],
      ANCHOR,
    );

    expect(notes.get("o1")?.text).toBe("second sitting");
  });

  it("returns an empty Map for an empty Log", () => {
    expect(lastNotesByOption([], ANCHOR).size).toBe(0);
  });
});

describe("noteAge", () => {
  it("counts days below the recency cap", () => {
    expect(noteAge(1)).toBe("1d");
    expect(noteAge(18)).toBe("18d");
    expect(noteAge(59)).toBe("59d");
  });

  it("switches to months at the cap instead of saturating at 60d+", () => {
    // The Recency chip stops at `60d+` because the ranking saturates there; a
    // note's age keeps counting, in a coarser unit.
    expect(noteAge(60)).toBe("2mo");
    expect(noteAge(425)).toBe("14mo");
  });

  it("switches to years past two years", () => {
    expect(noteAge(730)).toBe("2y");
    expect(noteAge(1100)).toBe("3y");
  });
});
