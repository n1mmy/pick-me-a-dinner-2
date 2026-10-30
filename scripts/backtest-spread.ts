/**
 * How far runs of one backtest setup differ. It reads saved run files from
 * `scripts/backtest.ts` offline, groups them into arms (runs of one setup:
 * model, thinking, prompt version) and, for each arm with two or more runs,
 * reports day by day and in aggregate:
 *
 * - per day, over every pair of runs: how often they agree on the #1, the
 *   mean top-3 and top-5 overlap, and the mean Kendall tau-b over the
 *   Options both ranked; the Pick's median and lowest-to-highest rank; and
 *   for each of the ten Options with the lowest mean rank, its mean rank and
 *   range — which Options sit firmly and which drift;
 * - per arm: the per-day measures averaged, and hit@3/5/10 and the capped
 *   mean rank, each as a mean with its range across the runs.
 *
 * Options are matched by name: run files carry no ids. A day's measures
 * count when two or more of the arm's runs have it ok. The hits count only
 * the days every run has ok, so a run that stopped early doesn't drag the
 * arm's hits down with days it never ranked.
 *
 *   npx tsx scripts/backtest-spread.ts <run.json>…
 */
import { readFileSync } from "node:fs";
import { type DayRecord, summarize } from "./backtest";

/**
 * Kendall's tau-b between two rankings (names, best first), over the names
 * both hold: +1 the same order, -1 reversed. A ranking names each Option
 * once, so there are no ties and tau-b is concordant minus discordant pairs
 * over all pairs. `null` with fewer than two names in common.
 */
export function kendallTauB(a: string[], b: string[]): number | null {
  const rankInB = new Map(b.map((name, i) => [name, i]));
  const shared = a.filter((name) => rankInB.has(name));
  if (shared.length < 2) return null;
  let score = 0;
  let pairs = 0;
  for (let i = 0; i < shared.length; i++) {
    for (let j = i + 1; j < shared.length; j++) {
      score += Math.sign(rankInB.get(shared[j])! - rankInB.get(shared[i])!);
      pairs++;
    }
  }
  return score / pairs;
}

/** How many Options two rankings' top `k` share, whatever their order. */
export function topKOverlap(a: string[], b: string[], k: number): number {
  const top = new Set(b.slice(0, k));
  return a.slice(0, k).filter((name) => top.has(name)).length;
}

/** Whether two rankings put the same Option at #1. */
export function sameFirst(a: string[], b: string[]): boolean {
  return a.length > 0 && a[0] === b[0];
}

/** What makes runs repeats of one setup. */
export type Arm = {
  model: string;
  thinking: string;
  promptVersion: string;
};

/**
 * A run file's arm, from its `meta`. A file written before the eval recorded
 * `thinking` reads its effort as its thinking.
 */
function armOf(meta: Record<string, string>): Arm {
  return {
    model: meta.model ?? meta.ranker ?? "?",
    thinking: meta.thinking ?? meta.effort ?? "?",
    promptVersion: meta.promptVersion ?? "?",
  };
}

/** Run files grouped into arms, in the order each arm first appears. */
export function groupArms(
  runs: { path: string; meta: Record<string, string> }[],
): { arm: Arm; paths: string[] }[] {
  const arms = new Map<string, { arm: Arm; paths: string[] }>();
  for (const { path, meta } of runs) {
    const arm = armOf(meta);
    const key = JSON.stringify(arm);
    if (!arms.has(key)) arms.set(key, { arm, paths: [] });
    arms.get(key)!.paths.push(path);
  }
  return [...arms.values()];
}

/**
 * Each run's rank of `name` on its day — the day's candidate count where the
 * run left it out.
 */
function ranksOf(records: DayRecord[], name: string): number[] {
  return records.map(
    (record) => record.ranking.find((row) => row.name === name)?.rank ?? record.candidates,
  );
}

/**
 * One day's Options across runs, by mean rank, an Option a run left out
 * counted at the day's candidate count; a tie goes to name order.
 */
export function byMeanRank(records: DayRecord[]): string[] {
  const names = [...new Set(records.flatMap((record) => record.ranking.map((row) => row.name)))];
  // Sums, not means: every Option has one rank per run, and integer sums
  // compare exactly.
  const total = new Map(names.map((name) => [name, ranksOf(records, name).reduce((a, b) => a + b, 0)]));
  return names.sort((a, b) => total.get(a)! - total.get(b)! || a.localeCompare(b));
}

/**
 * The days every run has ok — the days an arm's hits are counted on, so each
 * run is scored on the same days.
 */
export function sharedDays(runs: { results: DayRecord[] }[]): string[] {
  const okDays = runs.map((run) => new Set(run.results.filter((r) => r.ok).map((r) => r.day)));
  return [...okDays[0]].filter((day) => okDays.every((days) => days.has(day))).sort();
}

type RunFile = { path: string; meta: Record<string, string>; results: DayRecord[] };

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function median(xs: number[]): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const fixed = (x: number, digits = 2) => x.toFixed(digits);
/** A mean with its lowest and highest, as `4.5 (3–6)`. */
const spread = (xs: number[]) => `${fixed(mean(xs), 1)} (${Math.min(...xs)}–${Math.max(...xs)})`;

/** One day's measures over an arm's runs that have it ok. */
function daySpread(records: DayRecord[]) {
  const rankings = records.map((record) => record.ranking.map((row) => row.name));
  const pairs: [string[], string[]][] = [];
  for (let i = 0; i < rankings.length; i++) {
    for (let j = i + 1; j < rankings.length; j++) pairs.push([rankings[i], rankings[j]]);
  }
  const taus = pairs.flatMap(([a, b]) => {
    const tau = kendallTauB(a, b);
    return tau === null ? [] : [tau];
  });
  const pickRanks = records.map((record) => record.bestRank ?? record.candidates + 1);
  return {
    sameFirst: mean(pairs.map(([a, b]) => (sameFirst(a, b) ? 1 : 0))),
    top3: mean(pairs.map(([a, b]) => topKOverlap(a, b, 3))),
    top5: mean(pairs.map(([a, b]) => topKOverlap(a, b, 5))),
    tau: taus.length > 0 ? mean(taus) : null,
    pickMedian: median(pickRanks),
    pickRange: [Math.min(...pickRanks), Math.max(...pickRanks)] as const,
    top10: byMeanRank(records)
      .slice(0, 10)
      .map((name) => ({ name, ranks: ranksOf(records, name) })),
  };
}

function reportArm(arm: Arm, runs: RunFile[]): void {
  console.log(`\n=== ${arm.model} · thinking ${arm.thinking} · prompt v${arm.promptVersion} ===`);
  for (const run of runs) console.log(`  ${run.path}`);
  if (runs.length < 2) {
    console.log("  one run: no spread to measure");
    return;
  }

  const allDays = [...new Set(runs.flatMap((run) => run.results.map((r) => r.day)))].sort();
  const okRecords = (day: string) =>
    runs.flatMap((run) => run.results.filter((r) => r.day === day && r.ok));
  const days = allDays.filter((day) => okRecords(day).length >= 2);
  if (days.length === 0) {
    console.log("  no day is ok in two runs");
    return;
  }

  console.log("\nday         runs  same#1  top3  top5   tau   pick median (range)");
  const perDay = days.map((day) => {
    const measures = daySpread(okRecords(day));
    console.log(
      [
        day,
        String(okRecords(day).length).padStart(5),
        fixed(measures.sameFirst).padStart(7),
        fixed(measures.top3).padStart(5),
        fixed(measures.top5).padStart(5),
        (measures.tau === null ? "—" : fixed(measures.tau)).padStart(5),
        `  #${measures.pickMedian} (#${measures.pickRange[0]}–#${measures.pickRange[1]})`,
      ].join(" "),
    );
    console.log(
      "            " +
        measures.top10
          .map(({ name, ranks }) => `${name} ${fixed(mean(ranks), 1)} (${Math.min(...ranks)}–${Math.max(...ranks)})`)
          .join(" · "),
    );
    return { day, ...measures };
  });

  const hitDays = sharedDays(runs);
  const summaries = runs.map((run) => summarize(run.results.filter((r) => hitDays.includes(r.day))));
  const across = (of: (summary: ReturnType<typeof summarize>) => number | null) => {
    const xs = summaries.flatMap((summary) => {
      const x = of(summary);
      return x === null ? [] : [x];
    });
    return xs.length > 0 ? spread(xs) : "—";
  };
  const tauDays = perDay.flatMap((d) => (d.tau === null ? [] : [d.tau]));
  console.log(`\n--- arm: ${runs.length} runs, ${days.length} days ---`);
  console.log(
    `same #1 ${fixed(mean(perDay.map((d) => d.sameFirst)) * days.length, 1)}/${days.length} days   ` +
      `top-3 overlap ${fixed(mean(perDay.map((d) => d.top3)))}   ` +
      `top-5 overlap ${fixed(mean(perDay.map((d) => d.top5)))}   ` +
      `tau ${tauDays.length > 0 ? fixed(mean(tauDays)) : "—"}`,
  );
  if (hitDays.length === 0) {
    console.log("hits: no day is ok in every run");
    return;
  }
  console.log(
    `on the ${hitDays.length} days every run has: hit@3 ${across((s) => s.hit3)}   hit@5 ${across((s) => s.hit5)}   ` +
      `hit@10 ${across((s) => s.hit10)}   mean rank ${across((s) => s.meanRank)}   (mean, lowest–highest run)`,
  );
}

function main(): void {
  const args = process.argv.slice(2);
  const paths = args.filter((arg) => !arg.startsWith("--"));
  if (paths.length === 0) {
    console.error("usage: npx tsx scripts/backtest-spread.ts <run.json>…");
    process.exit(2);
  }
  const files: RunFile[] = paths.map((path) => {
    const { meta, results } = JSON.parse(readFileSync(path, "utf8")) as Omit<RunFile, "path">;
    return { path, meta, results };
  });
  const byPath = new Map(files.map((file) => [file.path, file]));
  for (const { arm, paths: armPaths } of groupArms(files)) {
    reportArm(arm, armPaths.map((path) => byPath.get(path)!));
  }
}

if (process.argv[1]?.endsWith("backtest-spread.ts")) main();
