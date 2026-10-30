import { describe, expect, it } from "vitest";
import type { DayRecord } from "./backtest";
import { byMeanRank, groupArms, kendallTauB, sameFirst, sharedDays, topKOverlap } from "./backtest-spread";

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
  // An old file: no thinking, only effort.
  const old = {
    path: "qwen3.8-v20-low.json",
    meta: { ranker: "prepared note", model: "qwen3.8", effort: "low", promptVersion: "20" },
  };
  // The same setup written after the eval recorded thinking.
  const sameSetupNew = {
    path: "prepared-v20-qwen3.8-low-r2.json",
    meta: { ...old.meta, thinking: "low", repeat: "2/3" },
  };
  const off = {
    path: "prepared-v20-qwen3.8-off-r1.json",
    meta: { ranker: "prepared note", model: "qwen3.8", thinking: "off", promptVersion: "20" },
  };
  const otherVersion = { path: "v19.json", meta: { ...old.meta, promptVersion: "19" } };

  it("groups runs by model, thinking and prompt version, an old file's effort as its thinking", () => {
    const arms = groupArms([old, sameSetupNew, off, otherVersion]);
    expect(arms).toEqual([
      { arm: { model: "qwen3.8", thinking: "low", promptVersion: "20" }, paths: [old.path, sameSetupNew.path] },
      { arm: { model: "qwen3.8", thinking: "off", promptVersion: "20" }, paths: [off.path] },
      { arm: { model: "qwen3.8", thinking: "low", promptVersion: "19" }, paths: [otherVersion.path] },
    ]);
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

describe("byMeanRank", () => {
  it("orders the Options by their mean rank across the runs", () => {
    // Mean ranks: A (1+3+1)/3 = 1.67, B (2+1+3)/3 = 2, C (3+2+2)/3 = 2.33.
    const runs = [["A", "B", "C"], ["B", "C", "A"], ["A", "C", "B"]].map((names) => dayRecord(names));
    expect(byMeanRank(runs)).toEqual(["A", "B", "C"]);
  });

  it("counts an Option a run left out at the day's candidate count", () => {
    // Six candidates. D is #1 once and missing twice: (1 + 6 + 6) / 3 = 4.33.
    // E sits at #4 in every run: 4. So E ranks above D.
    const runs = [
      dayRecord(["D", "A", "B", "E"]),
      dayRecord(["A", "B", "C", "E"]),
      dayRecord(["A", "C", "B", "E"]),
    ];
    expect(byMeanRank(runs)).toEqual(["A", "B", "C", "E", "D"]);
  });

  it("breaks a tie in mean rank by name", () => {
    const runs = [
      dayRecord(["Zeta", "Alpha"], { candidates: 2 }),
      dayRecord(["Alpha", "Zeta"], { candidates: 2 }),
    ];
    expect(byMeanRank(runs)).toEqual(["Alpha", "Zeta"]);
  });
});

describe("sharedDays", () => {
  const on = (day: string, ok = true) => ({ ...dayRecord(["P"]), day, ok });

  it("keeps only the days every run has ok, so a run that stopped early is scored on the same days", () => {
    const full = { results: [on("2026-10-20"), on("2026-10-21"), on("2026-10-22")] };
    const stopped = { results: [on("2026-10-21"), on("2026-10-20")] };
    const failed = { results: [on("2026-10-20", false), on("2026-10-21"), on("2026-10-22")] };
    expect(sharedDays([full, stopped])).toEqual(["2026-10-20", "2026-10-21"]);
    expect(sharedDays([full, stopped, failed])).toEqual(["2026-10-21"]);
  });
});
