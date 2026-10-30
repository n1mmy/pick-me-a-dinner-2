/**
 * How far runs of one backtest setup differ. It reads saved run files from
 * `scripts/backtest.ts` offline, groups them into arms (runs of one setup:
 * output, model, thinking, temperature, prompt version) and, for each arm
 * with two or more runs, reports day by day and in aggregate:
 *
 * - per day, over every pair of runs: how often they agree on the #1, the
 *   mean top-3 and top-5 overlap, and the mean Kendall tau-b over the
 *   Options both ranked; the Pick's median and lowest-to-highest rank; and
 *   for each Option in the averaged top 10, its mean rank and range — which
 *   Options sit firmly and which drift;
 * - per arm: hit@3/5/10 and the capped mean rank, each as a mean with its
 *   range across the runs, and the per-day measures averaged.
 *
 * Options are matched by name: run files carry no ids. A day counts when two
 * or more of the arm's runs have it ok.
 *
 * `--averaged` writes, for each arm with two or more runs, one averaged
 * ranking as a run file of its own (`<arm>-averaged-n<N>.json`), scored
 * against the Picks and readable by `scripts/backtest-compare.ts`.
 *
 *   npx tsx scripts/backtest-spread.ts <run.json>… [--averaged]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { type DayRecord, defaultRunPath, summarize } from "./backtest";

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
  output: string;
  model: string;
  thinking: string;
  temperature: string;
  promptVersion: string;
  /** An averaged ranking's run count: it is an arm of its own. */
  averagedFrom?: string;
};

/**
 * A run file's arm, from its `meta`. A file written before the eval recorded
 * `output`, `thinking` and `temperature` reads as a with-text run at the
 * default temperature, with its effort as its thinking.
 */
function armOf(meta: Record<string, string>): Arm {
  return {
    output: meta.output ?? "note",
    model: meta.model ?? meta.ranker ?? "?",
    thinking: meta.thinking ?? meta.effort ?? "?",
    temperature: meta.temperature ?? "default",
    promptVersion: meta.promptVersion ?? "?",
    ...(meta.averagedFrom !== undefined && { averagedFrom: meta.averagedFrom }),
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
 * One day's ranking averaged over runs: the Options by mean rank, an Option
 * a run left out counted at the day's candidate count. A tie goes to the
 * Option ranked above the other in more runs, then to name order.
 */
export function averageDay(records: DayRecord[]): DayRecord {
  const names = [...new Set(records.flatMap((record) => record.ranking.map((row) => row.name)))];
  const ranks = new Map(names.map((name) => [name, ranksOf(records, name)]));
  // Sums, not means: every Option has one rank per run, and integer sums
  // compare exactly.
  const total = (name: string) => ranks.get(name)!.reduce((a, b) => a + b, 0);
  const runsAbove = (a: string, b: string) =>
    ranks.get(a)!.filter((rank, run) => rank < ranks.get(b)![run]).length;
  // Then name order, standing in for the Score: run files don't carry it.
  names.sort(
    (a, b) => total(a) - total(b) || runsAbove(b, a) - runsAbove(a, b) || a.localeCompare(b),
  );
  // The day's facts come from the source records; the rest is scored afresh.
  const source = records[0];
  const rankOf = new Map(names.map((name, i) => [name, i + 1]));
  const picks = source.picks.map((pick) => ({ ...pick, rank: rankOf.get(pick.name) ?? null }));
  const pickRanks = picks.flatMap((pick) => (pick.rank === null ? [] : [pick.rank]));
  const bestRank = pickRanks.length > 0 ? Math.min(...pickRanks) : null;
  const scorable = picks.some((pick) => pick.candidate);
  const within = (n: number) => scorable && bestRank !== null && bestRank <= n;
  return {
    day: source.day,
    weekday: source.weekday,
    dayNote: source.dayNote,
    ok: true,
    candidates: source.candidates,
    picks,
    bestRank,
    scorable,
    hit3: within(3),
    hit5: within(5),
    hit10: within(10),
    pickTiming: source.pickTiming,
    // A too-soon miss needs the day's Rejections, which a run file lacks.
    tooSoonMisses: [],
    emptyTop10: 0,
    catalogOrder: false,
    ranking: names.map((name, i) => ({ rank: i + 1, name, reason: "" })),
  };
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
  const averaged = averageDay(records);
  return {
    sameFirst: mean(pairs.map(([a, b]) => (sameFirst(a, b) ? 1 : 0))),
    top3: mean(pairs.map(([a, b]) => topKOverlap(a, b, 3))),
    top5: mean(pairs.map(([a, b]) => topKOverlap(a, b, 5))),
    tau: taus.length > 0 ? mean(taus) : null,
    pickMedian: median(pickRanks),
    pickRange: [Math.min(...pickRanks), Math.max(...pickRanks)] as const,
    averaged,
    top10: averaged.ranking.slice(0, 10).map((row) => ({
      name: row.name,
      ranks: ranksOf(records, row.name),
    })),
  };
}

/** The averaged run file's path for an arm of `n` runs. */
function averagedPath(arm: Arm, n: number): string {
  return defaultRunPath({
    output: arm.output === "rank" ? "rank" : "note",
    version: arm.promptVersion,
    model: arm.model,
    thinking: arm.thinking,
    temperature: arm.temperature === "default" ? undefined : Number(arm.temperature),
  }).replace(/\.json$/, `-averaged-n${n}.json`);
}

function reportArm(arm: Arm, runs: RunFile[], writeAveraged: boolean): void {
  console.log(
    `\n=== ${arm.output} · ${arm.model} · thinking ${arm.thinking} · temperature ${arm.temperature} · ` +
      `prompt v${arm.promptVersion}${arm.averagedFrom ? ` · averaged from ${arm.averagedFrom}` : ""} ===`,
  );
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

  const summaries = runs.map((run) => summarize(run.results.filter((r) => days.includes(r.day))));
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
    `hit@3 ${across((s) => s.hit3)}   hit@5 ${across((s) => s.hit5)}   ` +
      `hit@10 ${across((s) => s.hit10)}   mean rank ${across((s) => s.meanRank)}   (mean, lowest–highest run)`,
  );
  console.log(
    `same #1 ${fixed(mean(perDay.map((d) => d.sameFirst)) * days.length, 1)}/${days.length} days   ` +
      `top-3 overlap ${fixed(mean(perDay.map((d) => d.top3)))}   ` +
      `top-5 overlap ${fixed(mean(perDay.map((d) => d.top5)))}   ` +
      `tau ${tauDays.length > 0 ? fixed(mean(tauDays)) : "—"}`,
  );

  const averaged = perDay.map((d) => d.averaged);
  const averagedSummary = summarize(averaged);
  console.log(
    `averaged ranking: hit@3 ${averagedSummary.hit3}   hit@5 ${averagedSummary.hit5}   ` +
      `hit@10 ${averagedSummary.hit10}   mean rank ${averagedSummary.meanRank ?? "—"}`,
  );
  if (!writeAveraged) return;
  const path = averagedPath(arm, runs.length);
  const meta: Record<string, string> = {
    ranker: "averaged",
    ...arm,
    averagedFrom: String(runs.length),
    sources: runs.map((run) => run.path).join(","),
    days: days.join(","),
  };
  writeFileSync(
    path,
    JSON.stringify({ meta, inProgress: false, aggregate: averagedSummary, results: averaged }, null, 2) + "\n",
  );
  console.log(`recorded → ${path}`);
}

function main(): void {
  const args = process.argv.slice(2);
  const paths = args.filter((arg) => !arg.startsWith("--"));
  if (paths.length === 0) {
    console.error("usage: npx tsx scripts/backtest-spread.ts <run.json>… [--averaged]");
    process.exit(2);
  }
  const files: RunFile[] = paths.map((path) => {
    const { meta, results } = JSON.parse(readFileSync(path, "utf8")) as Omit<RunFile, "path">;
    return { path, meta, results };
  });
  const byPath = new Map(files.map((file) => [file.path, file]));
  for (const { arm, paths: armPaths } of groupArms(files)) {
    reportArm(arm, armPaths.map((path) => byPath.get(path)!), args.includes("--averaged"));
  }
}

if (process.argv[1]?.endsWith("backtest-spread.ts")) main();
