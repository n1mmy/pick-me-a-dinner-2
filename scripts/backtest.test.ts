import { describe, expect, it, vi } from "vitest";
import { buildSnapshot, type SnapshotOption } from "../lib/snapshot";
import {
  type BacktestDay,
  parseBacktestArgs,
  sampleAcrossWeekdays,
  scoreDay,
  summarize,
} from "./backtest";

describe("parseBacktestArgs", () => {
  it("reads a day list to exclude from the sample, empty by default", () => {
    expect(parseBacktestArgs([], "x.json").exclude).toEqual([]);
    expect(
      parseBacktestArgs(["--exclude=2026-10-02, 2026-10-06", "--count=40"], "x.json"),
    ).toMatchObject({ exclude: ["2026-10-02", "2026-10-06"], count: 40, days: undefined });
  });

  it("takes a custom --json path over the default", () => {
    expect(parseBacktestArgs(["--json=out.json"], "x.json").jsonPath).toBe("out.json");
    expect(parseBacktestArgs(["--json"], "x.json").jsonPath).toBe("x.json");
  });

  it("refuses a --count or --window that is not a positive integer", () => {
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exit");
    }) as never);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => parseBacktestArgs(["--count=abc"], "x.json")).toThrow("exit");
    expect(() => parseBacktestArgs(["--window=0"], "x.json")).toThrow("exit");
    exit.mockRestore();
    error.mockRestore();
  });
});

function option(id: string, name: string, tags: string[] = [], notes: string | null = null): SnapshotOption {
  return { id, name, kind: "restaurant", tags, notes, closedDays: [] };
}

describe("sampleAcrossWeekdays", () => {
  // 2026-10-05 is a Monday; two weeks of days, Monday to Sunday.
  const twoWeeks = Array.from({ length: 14 }, (_, i) =>
    `2026-10-${String(5 + i).padStart(2, "0")}`,
  );

  it("takes the newest day of each weekday before any weekday's second", () => {
    expect(sampleAcrossWeekdays(twoWeeks, 7)).toEqual(twoWeeks.slice(7));
  });

  it("comes out chronological, and stops when the days run out", () => {
    expect(sampleAcrossWeekdays(twoWeeks, 9)).toEqual([
      "2026-10-05", // round two, from Sunday: the first week's Monday …
      "2026-10-11", // … and Sunday
      ...twoWeeks.slice(7),
    ]);
    expect(sampleAcrossWeekdays(twoWeeks.slice(0, 3), 20)).toHaveLength(3);
  });
});

describe("scoreDay", () => {
  const DAY = "2026-10-20"; // a Tuesday
  const built = buildSnapshot({
    options: [
      option("a", "Aji Ichi"),
      option("n", "Ninja Sushi", ["sushi"], "Mission Bay delivery is better"),
      option("q", "Quiche"),
      option("s", "Societea Tea House"),
      option("t", "Taqueria"),
    ],
    logEntries: [
      { optionId: "n", eatenOn: "2026-10-06", note: null },
      { optionId: "n", eatenOn: DAY, note: null },
      { optionId: "s", eatenOn: "2026-10-13", note: null },
    ],
    rejections: [{ optionId: "q", rejectedOn: DAY, reason: "too soon", optionName: "Quiche", kind: "home", tags: [] }],
    asOf: DAY,
    query: "",
    backtest: true,
  });
  const truth: BacktestDay = {
    day: DAY,
    picks: [{ optionId: "n", name: "Ninja Sushi" }],
    rejections: [{ optionId: "q", name: "Quiche", reason: "too soon" }],
    dayNote: "Swim night",
  };
  const record = scoreDay(truth, built, {
    ok: true,
    brief: "A swim evening: Societea leads, with Ninja Sushi close behind.",
    ranking: [
      { id: "s", reason: "The standing Tuesday swim-night place." },
      { id: "a", reason: "Its usual stretch is up. Due again." },
      { id: "q", reason: "Quick if there is one in the freezer." },
      { id: "n", reason: "Mission Bay delivery — and its stretch is up." },
      { id: "t", reason: "Fine." },
    ],
  });

  it("ranks the Pick and scores the hits", () => {
    expect(record.picks).toEqual([{ name: "Ninja Sushi", rank: 4, candidate: true }]);
    expect(record).toMatchObject({ bestRank: 4, scorable: true, hit3: false, hit5: true, hit10: true });
  });

  it("flags a too-soon Rejection ranked in the top 5", () => {
    expect(record.tooSoonMisses).toEqual([{ rank: 3, name: "Quiche", reason: "too soon" }]);
  });

  it("marks a day unscorable when no Pick is a candidate", () => {
    const archived = scoreDay(
      { ...truth, picks: [{ optionId: "gone", name: "Gone" }] },
      built,
      { ok: true, ranking: [] },
    );
    expect(archived).toMatchObject({ scorable: false, bestRank: null, hit10: false });
    expect(summarize([record, archived])).toMatchObject({
      days: 2,
      scored: 1,
      unscorable: [DAY],
      hit5: 1,
      daysWithTooSoonMiss: 1,
    });
  });

  it("counts never-eaten top-5 slots on scored days only", () => {
    const archived = scoreDay(
      { ...truth, picks: [{ optionId: "gone", name: "Gone" }] },
      built,
      { ok: true, ranking: [{ id: "a", reason: "Due." }] },
    );
    // The scored day's top 5 holds four Options never eaten in the window.
    expect(summarize([record, archived]).neverEatenTop5Slots).toBe(4);
  });
});
