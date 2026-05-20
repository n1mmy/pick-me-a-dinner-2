import { describe, expect, it } from "vitest";
import { CAP, OVERDUE_THRESHOLD, W_OPTION, W_TAG } from "./ranking.config";
import {
  daysSince,
  lastEaten,
  lastTagUse,
  optionScore,
  rankOption,
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

  it(
    "shifts the anchor day to the Selected day — a Planned dinner between " +
      "today and the anchor counts toward that day's recency",
    () => {
      // Picking for the Selected day, three days from today (ADR-0009). A
      // Planned dinner sitting two days ahead is "yesterday" relative to that
      // anchor, so it shapes the anchor day's per-Option *and* per-Tag recency
      // even though it would be excluded as future from a today-anchored
      // ranking.
      const options = [
        option("planned", "Planned Pasta", ["pasta"]),
        option("companion", "Other Pasta", ["pasta"]),
        option("untouched", "Fresh Salad", ["salad"]),
      ];
      const selectedDay = TODAY + 3;
      const entries: LogEntry[] = [
        { optionId: "planned", eatenOn: TODAY + 2 }, // Planned dinner before the anchor
      ];
      const rows = rankTonight(options, entries, selectedDay);
      const planned = rows.find((row) => row.option.id === "planned")!;
      const companion = rows.find((row) => row.option.id === "companion")!;
      const untouched = rows.find((row) => row.option.id === "untouched")!;

      // The planned dish reads one day overdue against the Selected day —
      // not "never eaten", not 60d+.
      expect(planned.recencyDays).toBe(1);
      expect(planned.neverEaten).toBe(false);
      // Its Tag-mate inherits the same per-Tag recency (it shares "pasta") —
      // the variety side of the Score rotates with the anchor too.
      expect(companion.tags[0]).toEqual({ tag: "pasta", days: 1, overdue: false });
      // An unrelated Option is unaffected by a planned dinner it has no Tag in
      // common with — still cold-start.
      expect(untouched.neverEaten).toBe(true);
      expect(untouched.recencyDays).toBe(CAP);
    },
  );

  it("excludes a Log entry dated after the anchor day", () => {
    // From a Selected day's perspective, an entry dated after that day is
    // "future" and excluded — same rule today's view uses, just relative to
    // the anchor (ADR-0009).
    const options = [option("o1", "Future Pick")];
    const selectedDay = TODAY + 2;
    const entries: LogEntry[] = [
      { optionId: "o1", eatenOn: selectedDay + 1 }, // a day after the Selected day
    ];
    const rows = rankTonight(options, entries, selectedDay);
    expect(rows[0].neverEaten).toBe(true);
    expect(rows[0].recencyDays).toBe(CAP);
  });

  it(
    "ties tie-break and cold-start fallback for a future anchor day too",
    () => {
      // No Log history on or before the Selected day → every Score ties at
      // the cold-start ceiling → alphabetical order, identical to today's
      // cold-start branch (ADR-0009).
      const options = [
        option("b", "Banana Bread"),
        option("a", "Apple Crumble"),
      ];
      const rows = rankTonight(options, [], TODAY + 10);
      expect(rows.map((row) => row.option.name)).toEqual([
        "Apple Crumble",
        "Banana Bread",
      ]);
      expect(rows.every((row) => row.score === (W_OPTION + W_TAG) * CAP)).toBe(
        true,
      );
    },
  );
});

describe("rankOption", () => {
  /** This Option's own Log entries — the `targetLog` `rankOption` expects. */
  function logFor(entries: LogEntry[], optionId: string): LogEntry[] {
    return entries.filter((entry) => entry.optionId === optionId);
  }

  it("matches that Option's rankTonight row for an active Option", () => {
    const options = [
      option("o1", "Salmon", ["fish"]),
      option("o2", "Cod", ["fish"]),
      option("o3", "Pasta", ["pasta", "comfort"]),
    ];
    const entries: LogEntry[] = [
      { optionId: "o1", eatenOn: TODAY - 20 },
      { optionId: "o2", eatenOn: TODAY - 5 },
      { optionId: "o3", eatenOn: TODAY - 30 },
    ];
    const rows = rankTonight(options, entries, TODAY);

    // The detail page and Tonight read the same inputs through the same
    // recency internals, so every field must agree for every active Option.
    for (const target of options) {
      const row = rows.find((r) => r.option.id === target.id);
      const ranked = rankOption({
        target,
        activeOptions: options,
        activeLog: entries,
        targetLog: logFor(entries, target.id),
        asOf: TODAY,
      });
      expect(ranked.score).toBe(row?.score);
      expect(ranked.recencyDays).toBe(row?.recencyDays);
      expect(ranked.neverEaten).toBe(row?.neverEaten);
      expect(ranked.tags).toEqual(row?.tags);
    }
  });

  it("reports the never-eaten flag and CAP recency for an Option with no Log history", () => {
    const options = [option("o1", "Tofu Stir Fry", ["soy"])];
    const ranked = rankOption({
      target: options[0],
      activeOptions: options,
      activeLog: [],
      targetLog: [],
      asOf: TODAY,
    });
    expect(ranked.neverEaten).toBe(true);
    expect(ranked.recencyDays).toBe(CAP);
    // A tagged but never-used Option ties at the cold-start Score.
    expect(ranked.score).toBe((W_OPTION + W_TAG) * CAP);
    expect(ranked.tags[0]).toEqual({ tag: "soy", days: CAP, overdue: true });
  });

  it("ranks an Archived Option with a null Score but factual per-Option recency", () => {
    // The active Catalog excludes the Archived `target`, so its own Log is
    // absent from `activeLog` — `rankOption` reads per-Option recency from
    // `targetLog` instead.
    const activeOptions = [
      option("o1", "Salmon", ["fish"]),
      option("o2", "Cod", ["fish"]),
    ];
    const target = option("archived", "Old Roast", ["roast"]);
    const activeLog: LogEntry[] = [{ optionId: "o1", eatenOn: TODAY - 5 }];
    const targetLog: LogEntry[] = [{ optionId: "archived", eatenOn: TODAY - 12 }];

    const ranked = rankOption({
      target,
      activeOptions,
      activeLog,
      targetLog,
      asOf: TODAY,
    });
    // An Archived Option takes no part in the ranking — no Score.
    expect(ranked.score).toBe(null);
    // Per-Option recency still comes from the Option's own history.
    expect(ranked.recencyDays).toBe(12);
    expect(ranked.neverEaten).toBe(false);
    // No active carrier of "roast", so its per-Tag recency caps at CAP.
    expect(ranked.tags[0]).toEqual({
      tag: "roast",
      days: CAP,
      overdue: true,
    });
  });
});
