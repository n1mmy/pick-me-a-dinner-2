import { describe, expect, it } from "vitest";
import type { DayRecord } from "./backtest";
import { averageDay, groupArms, kendallTauB, sameFirst, topKOverlap } from "./backtest-spread";

describe("kendallTauB", () => {
  it("is 1 for the same order and -1 for the reverse", () => {
    expect(kendallTauB(["A", "B", "C", "D"], ["A", "B", "C", "D"])).toBe(1);
    expect(kendallTauB(["A", "B", "C", "D"], ["D", "C", "B", "A"])).toBe(-1);
  });

  it("reads only the Options both rankings hold", () => {
    // Shared: A, B, C. Run one orders them A B C, run two A C B: of the three
    // pairs, two agree and one is swapped, so (2 - 1) / 3.
    expect(kendallTauB(["A", "X", "B", "C"], ["A", "C", "Y", "B"])).toBeCloseTo(1 / 3);
  });

  it("has no value with fewer than two Options in common", () => {
    expect(kendallTauB(["A", "B"], ["A", "C"])).toBeNull();
  });
});

describe("topKOverlap and sameFirst", () => {
  const one = ["A", "B", "C", "D", "E", "F"];
  const two = ["B", "A", "F", "C", "G", "D"];

  it("counts the Options two top-ks share, whatever their order inside", () => {
    expect(topKOverlap(one, two, 3)).toBe(2); // A, B
    expect(topKOverlap(one, two, 5)).toBe(3); // A, B, C
  });

  it("asks whether two rankings agree on the #1", () => {
    expect(sameFirst(one, two)).toBe(false);
    expect(sameFirst(one, ["A", "Z"])).toBe(true);
  });
});

describe("groupArms", () => {
  // An old with-text file: no output, thinking or temperature, only effort.
  const old = {
    path: "prepared-v20-qwen3.8-low.json",
    meta: { ranker: "prepared note", model: "qwen3.8", effort: "low", promptVersion: "20" },
  };
  // The same setup written after the eval recorded the new fields.
  const sameSetupNew = {
    path: "prepared-v20-qwen3.8-low-r2.json",
    meta: {
      ranker: "prepared note",
      output: "note",
      model: "qwen3.8",
      effort: "low",
      thinking: "low",
      temperature: "default",
      promptVersion: "20",
      repeat: "2/3",
    },
  };
  const rankOff = {
    path: "rank-v20-qwen3.8-off-t0-r1.json",
    meta: { output: "rank", model: "qwen3.8", thinking: "off", temperature: "0", promptVersion: "20" },
  };
  const otherVersion = { path: "v19.json", meta: { ...old.meta, promptVersion: "19" } };

  it("reads an old file as a with-text run at the default temperature, its effort as its thinking", () => {
    const arms = groupArms([old, sameSetupNew, rankOff, otherVersion]);
    expect(arms).toHaveLength(3);
    expect(arms[0]).toEqual({
      arm: { output: "note", model: "qwen3.8", thinking: "low", temperature: "default", promptVersion: "20" },
      paths: [old.path, sameSetupNew.path],
    });
    expect(arms[1]).toEqual({
      arm: { output: "rank", model: "qwen3.8", thinking: "off", temperature: "0", promptVersion: "20" },
      paths: [rankOff.path],
    });
    expect(arms[2].paths).toEqual([otherVersion.path]);
  });

  it("keeps an averaged file in an arm of its own", () => {
    const averaged = { path: "avg.json", meta: { ...sameSetupNew.meta, averagedFrom: "3" } };
    expect(groupArms([old, averaged]).map((a) => a.paths)).toEqual([[old.path], [averaged.path]]);
  });
});

/** One run's record of a day: `names` best first, scored against `pick`. */
function dayRecord(names: string[], { pick = "P", candidates = 6 } = {}): DayRecord {
  const rank = names.indexOf(pick) + 1 || null;
  return {
    day: "2026-10-22",
    weekday: "Thursday",
    dayNote: null,
    ok: true,
    candidates,
    picks: [{ name: pick, rank, candidate: true }],
    bestRank: rank,
    scorable: true,
    hit3: rank !== null && rank <= 3,
    hit5: rank !== null && rank <= 5,
    hit10: rank !== null && rank <= 10,
    pickTiming: [{ name: pick, daysSinceLast: 9 }],
    tooSoonMisses: [],
    emptyTop10: 0,
    catalogOrder: false,
    ranking: names.map((name, i) => ({ rank: i + 1, name, reason: "" })),
  };
}

const namesOf = (record: DayRecord) => record.ranking.map((row) => row.name);

describe("averageDay", () => {
  it("orders the Options by their mean rank across the runs", () => {
    // Mean ranks: A (1+3+1)/3 = 1.67, B (2+1+3)/3 = 2, C (3+2+2)/3 = 2.33.
    const runs = [["A", "B", "C"], ["B", "C", "A"], ["A", "C", "B"]].map((names) => dayRecord(names));
    expect(namesOf(averageDay(runs))).toEqual(["A", "B", "C"]);
  });

  it("counts an Option a run left out at the day's candidate count", () => {
    // Six candidates. D is #1 once and missing twice: (1 + 6 + 6) / 3 = 4.33.
    // E sits at #4 in every run: 4. So E ranks above D.
    const runs = [
      dayRecord(["D", "A", "B", "E"]),
      dayRecord(["A", "B", "C", "E"]),
      dayRecord(["A", "C", "B", "E"]),
    ];
    expect(namesOf(averageDay(runs))).toEqual(["A", "B", "C", "E", "D"]);
  });

  it("breaks a tie in mean rank for the Option ranked above the other in more runs", () => {
    // Zeta (4+1+1)/3 = 2 and Alpha (2+2+2)/3 = 2 tie; Zeta is above Alpha in two runs of three.
    const runs = [
      dayRecord(["M", "Alpha", "N", "Zeta"], { candidates: 4 }),
      dayRecord(["Zeta", "Alpha", "M", "N"], { candidates: 4 }),
      dayRecord(["Zeta", "Alpha", "M", "N"], { candidates: 4 }),
    ];
    expect(namesOf(averageDay(runs))).toEqual(["Zeta", "Alpha", "M", "N"]);
  });

  it("breaks a tie that survives both for the Option first in name order", () => {
    // Run files carry no Score, so name order stands in for it.
    const runs = [
      dayRecord(["Zeta", "Alpha"], { candidates: 2 }),
      dayRecord(["Alpha", "Zeta"], { candidates: 2 }),
    ];
    expect(namesOf(averageDay(runs))).toEqual(["Alpha", "Zeta"]);
  });

  it("scores the averaged ranking against the Picks afresh", () => {
    // The Pick P is #1, #5 and #6 in the runs. Averaged: A 1.33, B 2.33,
    // C 3.33, P 4, D 4.33, E 5.67, so P sits at #4.
    const first = {
      ...dayRecord(["P", "A", "B", "C", "D", "E"]),
      tooSoonMisses: [{ rank: 2, name: "A", reason: "too soon" }],
    };
    const averaged = averageDay([
      first,
      dayRecord(["A", "B", "C", "D", "P", "E"]),
      dayRecord(["A", "B", "C", "D", "E", "P"]),
    ]);
    expect(averaged).toMatchObject({
      day: "2026-10-22",
      candidates: 6,
      ok: true,
      scorable: true,
      picks: [{ name: "P", rank: 4, candidate: true }],
      pickTiming: [{ name: "P", daysSinceLast: 9 }],
      bestRank: 4,
      hit3: false,
      hit5: true,
      hit10: true,
      tooSoonMisses: [],
      emptyTop10: 0,
    });
  });
});
