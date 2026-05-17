import { describe, expect, it } from "vitest";
import type { TonightRow } from "./ranking";
import {
  decidedActions,
  splitTonight,
  type TodayLogEntry,
} from "./tonights-dinner";

/** A minimal ranked Tonight row — `splitTonight` only reads `option.id`. */
function row(id: string, name: string): TonightRow {
  return {
    option: { id, name, kind: "home", tags: [], url: null, phone: null },
    score: 0,
    explanation: "",
    tags: [],
    recencyDays: 0,
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

describe("decidedActions", () => {
  it("gives a Restaurant with both fields a Menu and a Call button", () => {
    expect(
      decidedActions({
        kind: "restaurant",
        url: "https://thai.example/menu",
        phone: "+1-555-0100",
      }),
    ).toEqual([
      { label: "Menu", href: "https://thai.example/menu" },
      { label: "Call", href: "tel:+1-555-0100" },
    ]);
  });

  it("gives a Restaurant with only a url just the Menu button", () => {
    expect(
      decidedActions({
        kind: "restaurant",
        url: "https://thai.example/order",
        phone: null,
      }),
    ).toEqual([{ label: "Menu", href: "https://thai.example/order" }]);
  });

  it("gives a Restaurant with only a phone just the Call button", () => {
    expect(
      decidedActions({ kind: "restaurant", url: null, phone: "+1-555-0100" }),
    ).toEqual([{ label: "Call", href: "tel:+1-555-0100" }]);
  });

  it("gives a Restaurant with neither field no buttons", () => {
    expect(
      decidedActions({ kind: "restaurant", url: null, phone: null }),
    ).toEqual([]);
  });

  it("gives a Home meal with a url a Recipe button", () => {
    expect(
      decidedActions({
        kind: "home",
        url: "https://recipes.example/stew",
        phone: null,
      }),
    ).toEqual([{ label: "Recipe", href: "https://recipes.example/stew" }]);
  });

  it("gives a Home meal without a url no buttons", () => {
    expect(decidedActions({ kind: "home", url: null, phone: null })).toEqual(
      [],
    );
  });

  it("never yields Menu or Call for a Home meal, even with a stray phone", () => {
    const actions = decidedActions({
      kind: "home",
      url: "https://recipes.example/stew",
      phone: "+1-555-0100",
    });
    expect(actions.map((a) => a.label)).toEqual(["Recipe"]);
  });
});
