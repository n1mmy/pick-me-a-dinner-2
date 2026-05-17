import { describe, expect, it } from "vitest";
import type { TonightRow } from "./ranking";
import { splitTonight, type TodayLogEntry } from "./tonights-dinner";

/** A minimal ranked Tonight row — `splitTonight` only reads `option.id`. */
function row(id: string, name: string): TonightRow {
  return {
    option: { id, name, kind: "home", tags: [] },
    score: 0,
    explanation: "",
    tags: [],
  };
}

/** A today Log entry with its pick instant as an ISO string. */
function entry(id: string, optionId: string, createdAt: string): TodayLogEntry {
  return { id, optionId, createdAt: new Date(createdAt) };
}

const ROWS: TonightRow[] = [
  row("a", "Apple Crumble"),
  row("b", "Banana Bread"),
  row("c", "Cherry Pie"),
];

describe("splitTonight", () => {
  it("with no Log entry dated today, the dinner is empty and the picker is the full ranked list", () => {
    const { tonightsDinner, picker } = splitTonight(ROWS, []);
    expect(tonightsDinner).toEqual([]);
    expect(picker).toEqual(ROWS);
  });

  it("moves one Picked Option into the dinner and out of the picker", () => {
    const { tonightsDinner, picker } = splitTonight(ROWS, [
      entry("e1", "b", "2026-05-17T18:00:00Z"),
    ]);
    expect(tonightsDinner).toEqual([{ entryId: "e1", row: row("b", "Banana Bread") }]);
    expect(picker.map((r) => r.option.id)).toEqual(["a", "c"]);
  });

  it("orders a multi-Option dinner by created_at, oldest first", () => {
    // Entries supplied newest-first; pick order must still come out oldest-first.
    const { tonightsDinner, picker } = splitTonight(ROWS, [
      entry("e2", "a", "2026-05-17T20:30:00Z"),
      entry("e1", "c", "2026-05-17T18:15:00Z"),
    ]);
    expect(tonightsDinner.map((d) => d.entryId)).toEqual(["e1", "e2"]);
    expect(tonightsDinner.map((d) => d.row.option.id)).toEqual(["c", "a"]);
    expect(picker.map((r) => r.option.id)).toEqual(["b"]);
  });

  it("keeps the pick order stable as another Option is added", () => {
    const first = splitTonight(ROWS, [entry("e1", "c", "2026-05-17T18:15:00Z")]);
    const then = splitTonight(ROWS, [
      entry("e1", "c", "2026-05-17T18:15:00Z"),
      entry("e2", "a", "2026-05-17T20:30:00Z"),
    ]);
    // The Option Picked first stays first; the new one is appended, not interleaved.
    expect(first.tonightsDinner.map((d) => d.entryId)).toEqual(["e1"]);
    expect(then.tonightsDinner.map((d) => d.entryId)).toEqual(["e1", "e2"]);
  });

  it("leaves the picker empty once every Option is Picked", () => {
    const { tonightsDinner, picker } = splitTonight(ROWS, [
      entry("e1", "a", "2026-05-17T18:00:00Z"),
      entry("e2", "b", "2026-05-17T19:00:00Z"),
      entry("e3", "c", "2026-05-17T20:00:00Z"),
    ]);
    expect(tonightsDinner.map((d) => d.row.option.id)).toEqual(["a", "b", "c"]);
    expect(picker).toEqual([]);
  });

  it("ignores a today entry for an Option not in the ranked set", () => {
    // An Option Archived after it was Picked is no longer in the ranked rows.
    const { tonightsDinner, picker } = splitTonight(ROWS, [
      entry("e1", "ghost", "2026-05-17T18:00:00Z"),
      entry("e2", "b", "2026-05-17T19:00:00Z"),
    ]);
    expect(tonightsDinner.map((d) => d.row.option.id)).toEqual(["b"]);
    expect(picker.map((r) => r.option.id)).toEqual(["a", "c"]);
  });
});
