/**
 * Saved backtest runs (`scripts/backtest/backtest.ts` `--json` files) summarized side
 * by side and by month: hit@3/5/10, the capped mean rank, too-soon days and
 * never-eaten top-5 slots, each over the days every run has. Offline.
 *
 *   npx tsx scripts/backtest/typesafe-summary.ts <run.json>…
 *   npx tsx scripts/backtest/typesafe-summary.ts --dir=scripts/backtest-runs --match=s6-j1-all-rerank
 *
 * `--match=` takes the files under `--dir` whose name contains it; `--from=`
 * and `--to=` cut the days (YYYY-MM-DD, inclusive).
 */
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { type DayRecord, summarize } from "./backtest";

type Run = { name: string; results: DayRecord[] };

function load(path: string): Run {
  const json = JSON.parse(readFileSync(path, "utf8")) as { results: DayRecord[] };
  return { name: basename(path).replace(/\.json$/, ""), results: json.results };
}

function line(run: Run, days: Set<string>): string {
  const records = run.results.filter((record) => days.has(record.day) && record.ok);
  const s = summarize(records);
  return (
    `${run.name.padEnd(56)} ${`${s.hit3}/${s.hit5}/${s.hit10}`.padEnd(11)}` +
    `mean ${String(s.meanRank ?? "—").padEnd(5)} med ${String(s.medianRank ?? "—").padEnd(3)} ` +
    `too-soon ${String(s.daysWithTooSoonMiss).padEnd(3)} never5 ${String(s.neverEatenTop5Slots).padEnd(4)} ` +
    `scored ${s.scored}/${s.days}`
  );
}

function main(): void {
  const args = process.argv.slice(2);
  const value = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const dir = value("dir");
  const match = value("match");
  const paths = [
    ...args.filter((a) => !a.startsWith("--")),
    ...(dir && match
      ? readdirSync(dir)
          .filter((f) => f.endsWith(".json") && f.includes(match))
          .sort()
          .map((f) => join(dir, f))
      : []),
  ];
  if (paths.length === 0) {
    console.error("Pass run files, or --dir=<dir> --match=<substring>.");
    process.exit(1);
  }
  const runs = paths.map(load);
  const from = value("from") ?? "0000-00-00";
  const to = value("to") ?? "9999-99-99";
  // The days every run has ok, inside the cut.
  const shared = runs
    .map((run) => new Set(run.results.filter((r) => r.ok && r.day >= from && r.day <= to).map((r) => r.day)))
    .reduce((acc, set) => new Set([...acc].filter((day) => set.has(day))));
  const months = [...new Set([...shared].map((day) => day.slice(0, 7)))].sort();

  console.log(`all ${shared.size} shared days`);
  for (const run of runs) console.log(`  ${line(run, shared)}`);
  for (const month of months) {
    const days = new Set([...shared].filter((day) => day.startsWith(month)));
    console.log(`\n${month}: ${days.size} days`);
    for (const run of runs) console.log(`  ${line(run, days)}`);
  }
}

main();
