/**
 * Does Jev's confidence predict a hit? For each day of a saved run
 * (`scripts/typesafe-eval.ts`) this reads the Choice's top probability, its
 * margin over the second, and the top Noul, and sets them against the Pick's
 * rank in the run's `-choice.json` (or another run file on the same days,
 * such as a re-rank arm). Days are split into quarters by each measure, and
 * each quarter's hit@1/3/5 and mean rank are printed. Offline, no call.
 *
 *   npx tsx scripts/typesafe-calibration.ts --run=scripts/backtest-runs/jev-1.14.0-s6-j1-history
 *   npx tsx scripts/typesafe-calibration.ts --run=<run> --scored=<run>-rerank-noul+choice+score.json
 */
import { readFileSync } from "node:fs";
import { type DayRecord, RANK_CAP } from "./backtest";
import { type Saved } from "./typesafe-lists";

type Measured = { day: string; top: number; margin: number; noulTop: number; noulSum: number; rank: number; ties: number };

function measure(run: string, scored: string): Measured[] {
  const file = JSON.parse(readFileSync(scored, "utf8")) as { results: DayRecord[] };
  return file.results
    .filter((record) => record.ok && record.scorable)
    .map((record) => {
      const saved = JSON.parse(readFileSync(`${run}-noul-reasoning/${record.day}.txt`, "utf8")) as Saved;
      const choice = saved.response.answers.choice;
      const ps = choice.type === "choice" ? Object.values(choice.probabilities).sort((a, b) => b - a) : [0, 0];
      const nouls = Object.entries(saved.response.answers)
        .filter(([name, answer]) => name.startsWith("noul_") && answer.type === "noul")
        .map(([, answer]) => (answer as { noul: number }).noul)
        .sort((a, b) => b - a);
      return {
        day: record.day,
        top: ps[0],
        margin: ps[0] - (ps[1] ?? 0),
        noulTop: nouls[0] ?? 0,
        noulSum: nouls.reduce((a, b) => a + b, 0),
        rank: Math.min(record.bestRank ?? record.candidates + 1, RANK_CAP),
        ties: ps.filter((p) => p === ps[0]).length,
      };
    });
}

function quarters(days: Measured[], by: (d: Measured) => number, label: string): void {
  const sorted = [...days].sort((a, b) => by(a) - by(b));
  const size = Math.ceil(sorted.length / 4);
  console.log(`\nby ${label}, lowest quarter first:`);
  console.log(`  ${"range".padEnd(16)} days  hit@1  hit@3  hit@5  mean rank`);
  for (let i = 0; i < sorted.length; i += size) {
    const q = sorted.slice(i, i + size);
    const hit = (n: number) => q.filter((d) => d.rank <= n).length;
    const mean = q.reduce((s, d) => s + d.rank, 0) / q.length;
    const range = `${by(q[0]).toFixed(3)}–${by(q[q.length - 1]).toFixed(3)}`;
    console.log(
      `  ${range.padEnd(16)} ${String(q.length).padStart(4)}  ${String(hit(1)).padStart(5)}  ${String(hit(3)).padStart(5)}  ${String(hit(5)).padStart(5)}  ${mean.toFixed(1).padStart(9)}`,
    );
  }
  // Spearman's rho between the measure and the rank: negative means more confidence, better rank.
  const rankOf = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return values.map((v) => (sorted.indexOf(v) + sorted.lastIndexOf(v)) / 2 + 1);
  };
  const x = rankOf(days.map(by));
  const y = rankOf(days.map((d) => d.rank));
  const mx = x.reduce((a, b) => a + b, 0) / x.length;
  const my = y.reduce((a, b) => a + b, 0) / y.length;
  const cov = x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0);
  const vx = Math.sqrt(x.reduce((s, xi) => s + (xi - mx) ** 2, 0));
  const vy = Math.sqrt(y.reduce((s, yi) => s + (yi - my) ** 2, 0));
  console.log(`  Spearman's rho with the Pick's rank: ${(cov / (vx * vy)).toFixed(2)}`);
}

function main(): void {
  const args = process.argv.slice(2);
  const value = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const run = value("run");
  if (!run) {
    console.error("Pass --run=<path of a typesafe-eval run, without -noul.json>.");
    process.exit(1);
  }
  const scored = value("scored") ?? `${run}-choice.json`;
  const days = measure(run, scored);
  console.log(`run: ${run}\nscored against: ${scored}\ndays: ${days.length}`);
  const tied = days.filter((d) => d.ties > 1).length;
  console.log(`days whose Choice top is a tie: ${tied}`);
  quarters(days, (d) => d.top, "the Choice's top probability");
  quarters(days, (d) => d.margin, "the Choice's margin over second");
  quarters(days, (d) => d.noulTop, "the top Noul");
  quarters(days, (d) => d.noulSum, "the Nouls' sum");
}

main();
