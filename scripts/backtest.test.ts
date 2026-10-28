import { describe, expect, it } from "vitest";
import { buildSnapshot, type SnapshotOption } from "../lib/snapshot";
import {
  type BacktestDay,
  RHYTHM_CLAIM_SUSPECTS,
  sampleAcrossWeekdays,
  scoreDay,
  summarize,
} from "./backtest";

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

describe("RHYTHM_CLAIM_SUSPECTS", () => {
  const suspects = (text: string) => text.match(RHYTHM_CLAIM_SUSPECTS) ?? [];

  it("catches relative elapsed-time phrasing", () => {
    expect(suspects("They just had it last week.")).toEqual(["just had", "last week"]);
    expect(suspects("Ninja was just this past Sunday")).toEqual(["this past Sunday"]);
    expect(suspects("eaten Tuesday, so skip")).toEqual(["eaten Tuesday"]);
    expect(suspects("Last night was pizza")).toEqual(["Last night"]);
  });

  it("leaves a rhythm claim alone", () => {
    expect(suspects("The standing Thursday choice, and its stretch is up.")).toEqual([]);
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

  it("checks the brief's named Options against the top 3 and its Day note", () => {
    expect(record.briefNamed).toEqual([
      { rank: 4, name: "Ninja Sushi" },
      { rank: 1, name: "Societea Tea House" },
    ]);
    expect(record.briefMentionsDayNote).toBe(true);
  });

  it("prints a weekday claim with the Option's weekday counts", () => {
    expect(record.flags.weekdayClaims).toEqual([
      expect.objectContaining({ rank: 1, name: "Societea Tea House", weekdays: { Tuesday: 1 } }),
    ]);
  });

  it("flags a top row that says nothing but timing, not one drawing on a Note", () => {
    expect(record.flags.timingOnly.map((row) => row.name)).toEqual(["Aji Ichi"]);
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
      briefNamedOutsideTop3: 1,
      timingOnlyTopRows: 1,
    });
  });
});
