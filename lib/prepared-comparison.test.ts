import { describe, expect, it } from "vitest";
import { noteComparison } from "./prepared-comparison";

const RANKING = [
  { id: "o1", reason: "Top of the note." },
  { id: "o2", reason: "Second." },
  { id: "o3", reason: "Third." },
  { id: "o4", reason: "Fourth." },
];

describe("noteComparison", () => {
  it("ranks what was eaten #1 when the note put it first", () => {
    expect(noteComparison(RANKING, [{ id: "o1", name: "Katsu curry" }])).toEqual([
      { name: "Katsu curry", rank: 1 },
    ]);
  });

  it("gives a mid-list Option its 1-based place", () => {
    expect(noteComparison(RANKING, [{ id: "o3", name: "Pad thai" }])).toEqual([
      { name: "Pad thai", rank: 3 },
    ]);
  });

  it("leaves the rank empty for an Option the note didn't rank", () => {
    expect(noteComparison(RANKING, [{ id: "o9", name: "Leftovers" }])).toEqual([
      { name: "Leftovers", rank: null },
    ]);
  });

  it("gives one line per Log entry, in Log order", () => {
    expect(
      noteComparison(RANKING, [
        { id: "o4", name: "Pizza" },
        { id: "o9", name: "Leftovers" },
        { id: "o2", name: "Salad" },
      ]),
    ).toEqual([
      { name: "Pizza", rank: 4 },
      { name: "Leftovers", rank: null },
      { name: "Salad", rank: 2 },
    ]);
  });

  it("ranks nothing against an empty ranking", () => {
    expect(noteComparison([], [{ id: "o1", name: "Katsu curry" }])).toEqual([
      { name: "Katsu curry", rank: null },
    ]);
  });
});
