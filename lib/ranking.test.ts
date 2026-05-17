import { describe, expect, it } from "vitest";
import { CAP, OVERDUE_THRESHOLD, W_OPTION, W_TAG } from "./ranking.config";
import {
  daysSince,
  lastEaten,
  lastTagUse,
  optionScore,
  rankTonight,
  type LogEntry,
  type RankOption,
} from "./ranking";

const TODAY = 100;

/** Build an active Option for the tests. */
function option(
  id: string,
  name: string,
  tags: string[] = [],
  kind: "home" | "restaurant" = "home",
): RankOption {
  return { id, name, kind, tags, url: null, phone: null };
}

describe("daysSince", () => {
  it("returns CAP for a null date (never eaten / never used)", () => {
    expect(daysSince(null, TODAY)).toBe(CAP);
  });

  it("returns the plain difference for a recent date", () => {
    expect(daysSince(95, TODAY)).toBe(5);
  });

  it("caps a very old date at CAP", () => {
    expect(daysSince(10, TODAY)).toBe(CAP);
  });

  it("guards a future date to 0 so a Score can never go negative", () => {
    expect(daysSince(TODAY + 5, TODAY)).toBe(0);
  });
});

describe("lastEaten", () => {
  it("returns the most-recent non-future eatenOn for the Option", () => {
    const entries: LogEntry[] = [
      { optionId: "o1", eatenOn: 80 },
      { optionId: "o1", eatenOn: 95 },
      { optionId: "o2", eatenOn: 99 },
    ];
    expect(lastEaten(entries, "o1", TODAY)).toBe(95);
  });

  it("excludes future entries (Planned dinners)", () => {
    const entries: LogEntry[] = [
      { optionId: "o1", eatenOn: 90 },
      { optionId: "o1", eatenOn: 110 },
    ];
    expect(lastEaten(entries, "o1", TODAY)).toBe(90);
  });

  it("returns null when the Option has no Log history", () => {
    expect(lastEaten([{ optionId: "o2", eatenOn: 90 }], "o1", TODAY)).toBe(
      null,
    );
  });
});

describe("lastTagUse", () => {
  const options = [
    option("o1", "Salmon", ["fish"]),
    option("o2", "Cod", ["fish"]),
    option("o3", "Pasta", ["pasta"]),
  ];

  it("returns the most-recent non-future use across every carrier of the Tag", () => {
    const entries: LogEntry[] = [
      { optionId: "o1", eatenOn: 80 },
      { optionId: "o2", eatenOn: 95 },
    ];
    expect(lastTagUse(entries, options, "fish", TODAY)).toBe(95);
  });

  it("excludes future entries", () => {
    const entries: LogEntry[] = [
      { optionId: "o1", eatenOn: 80 },
      { optionId: "o2", eatenOn: 120 },
    ];
    expect(lastTagUse(entries, options, "fish", TODAY)).toBe(80);
  });

  it("returns null when no carrier of the Tag has Log history", () => {
    const entries: LogEntry[] = [{ optionId: "o3", eatenOn: 90 }];
    expect(lastTagUse(entries, options, "fish", TODAY)).toBe(null);
  });
});

describe("optionScore", () => {
  it("uses the mean of the Tag recencies as variety for a tagged Option", () => {
    // anti_repeat 10, tagDays mean (20 + 30) / 2 = 25.
    expect(optionScore(10, [20, 30])).toBe(W_OPTION * 10 + W_TAG * 25);
  });

  it("mirrors anti_repeat as variety for a tagless Option", () => {
    expect(optionScore(12, [])).toBe(W_OPTION * 12 + W_TAG * 12);
  });

  it("ties every Option at (W_OPTION + W_TAG) * CAP on cold start", () => {
    const coldTagged = optionScore(CAP, [CAP, CAP]);
    const coldTagless = optionScore(CAP, []);
    expect(coldTagged).toBe((W_OPTION + W_TAG) * CAP);
    expect(coldTagless).toBe((W_OPTION + W_TAG) * CAP);
  });
});

describe("rankTonight", () => {
  it("renders per-Tag recency and flags a Tag overdue exactly at the threshold", () => {
    const options = [option("o1", "Fish Tacos", ["fish"])];
    const overdue = rankTonight(
      options,
      [{ optionId: "o1", eatenOn: TODAY - OVERDUE_THRESHOLD }],
      TODAY,
    );
    expect(overdue[0].tags[0]).toEqual({
      tag: "fish",
      days: OVERDUE_THRESHOLD,
      overdue: true,
    });

    const notYet = rankTonight(
      options,
      [{ optionId: "o1", eatenOn: TODAY - OVERDUE_THRESHOLD + 1 }],
      TODAY,
    );
    expect(notYet[0].tags[0].overdue).toBe(false);
  });

  it("ranks a more-overdue Option above a recently-eaten one", () => {
    const options = [
      option("recent", "Recent Stir Fry"),
      option("stale", "Stale Roast"),
    ];
    const entries: LogEntry[] = [
      { optionId: "recent", eatenOn: TODAY - 2 },
      { optionId: "stale", eatenOn: TODAY - 30 },
    ];
    const rows = rankTonight(options, entries, TODAY);
    expect(rows.map((row) => row.option.id)).toEqual(["stale", "recent"]);
    // Both Options have a non-future Log entry, so neither reads as never eaten.
    expect(rows.every((row) => row.neverEaten === false)).toBe(true);
  });

  it("falls back to alphabetical order on cold start (zero non-future entries)", () => {
    const options = [
      option("b", "Banana Bread"),
      option("a", "Apple Crumble"),
    ];
    const rows = rankTonight(options, [], TODAY);
    expect(rows.map((row) => row.option.name)).toEqual([
      "Apple Crumble",
      "Banana Bread",
    ]);
    expect(rows.every((row) => row.score === (W_OPTION + W_TAG) * CAP)).toBe(
      true,
    );
  });

  it("excludes future Log entries so a Planned dinner does not skew the Score", () => {
    const options = [option("o1", "Tomorrow's Pick")];
    const rows = rankTonight(
      options,
      [{ optionId: "o1", eatenOn: TODAY + 3 }],
      TODAY,
    );
    // The only entry is in the future, so the Option reads as never eaten.
    expect(rows[0].neverEaten).toBe(true);
    expect(rows[0].recencyDays).toBe(CAP);
    expect(rows[0].score).toBe((W_OPTION + W_TAG) * CAP);
  });
});
