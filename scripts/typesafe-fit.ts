/**
 * Weights for the lists a saved Jev run gives (`scripts/typesafe-lists.ts`),
 * fitted with a month held out — the answer to "does the hand-picked mean
 * survive a weight that was not chosen on these days?". Offline, no call.
 *
 * Each candidate on each night is a row: its place in every list, scaled to
 * 0–1 (first place 0), as the features; the Pick as the label. A conditional
 * logit (`scripts/conditional-logit.ts`) is fitted on every month but one,
 * the held-out month is ranked by the fitted score, and the held-out
 * months together are read as one run — against the unweighted means on the
 * same days. Then the fit on every day, for its weights.
 *
 *   npx tsx scripts/typesafe-fit.ts --run=scripts/backtest-runs/jev-1.14.0-s6-j1-history
 *   npx tsx scripts/typesafe-fit.ts --run=<run> --features=noul,choice,score,weekday --l2=0.05
 *
 * `--features=` picks the lists (default: every list the run has);
 * `--days=` or `--days-file=` names the days (default: the run's own);
 * `--json=<path>` writes the held-out ranking as a backtest run file for
 * `scripts/typesafe-summary.ts`. Free: `DATABASE_URL` and `APP_TZ` from
 * `.env.local` then `.env`.
 */
import "./load-env";
import { readFileSync } from "node:fs";
import { getLog } from "../db/queries";
import { type BuiltSnapshot, snapshotForDay } from "../lib/snapshot";
import { RANK_CAP, parseBacktestArgs, runBacktest } from "./backtest";
import { type Fit, fitConditionalLogit, type Night, scoreNight } from "./conditional-logit";
import { JUDGMENTS, type Lists, listsFor, meanOfRanks, order, ranksOf, readSaved, scoreView } from "./typesafe-lists";

type Feature = "noul" | "choice" | "score" | "affinity" | "readiness" | "weekday" | (typeof JUDGMENTS)[number];
const ALL_FEATURES: Feature[] = ["noul", "choice", "score", "affinity", "readiness", "weekday", ...JUDGMENTS];

const listOf = (lists: Lists, feature: Feature): Map<string, number> =>
  (JUDGMENTS as readonly string[]).includes(feature)
    ? lists.judgments![feature as (typeof JUDGMENTS)[number]]
    : lists[feature as Exclude<Feature, (typeof JUDGMENTS)[number]>];

/** Each candidate's place in each list, scaled so first is 0 and last is 1. */
function featureRows(lists: Lists, features: Feature[]): { ids: string[]; rows: number[][] } {
  const ids = [...lists.score.keys()];
  const n = ids.length;
  const ranks = features.map((feature) => ranksOf(listOf(lists, feature)));
  const rows = ids.map((id) => ranks.map((rank) => (n > 1 ? (-rank.get(id)! - 1) / (n - 1) : 0)));
  return { ids, rows };
}

type Day = { day: string; built: BuiltSnapshot; lists: Lists; picked: Set<string> };

async function loadDays(run: string, days: string[]): Promise<Day[]> {
  const log = await getLog();
  const out: Day[] = [];
  for (const day of days) {
    const built = await snapshotForDay({ asOf: day, query: "", backtest: true });
    const lists = listsFor(built, readSaved(run, day), await scoreView(built));
    if (typeof lists === "string") {
      console.error(`${day}: ${lists}`);
      continue;
    }
    const picked = new Set(log.filter((entry) => entry.eatenOn === day).map((entry) => entry.optionId));
    if (![...picked].some((id) => lists.score.has(id))) continue;
    out.push({ day, built, lists, picked });
  }
  return out;
}

const nightOf = (day: Day, features: Feature[]): Night => {
  const { ids, rows } = featureRows(day.lists, features);
  return { features: rows, picked: ids.map((id) => day.picked.has(id)) };
};

/** The best Pick's rank in `ranking`, capped as the backtest caps it. */
function pickRank(day: Day, ranking: { id: string }[]): number {
  const places = ranking.flatMap((row, i) => (day.picked.has(row.id) ? [i + 1] : []));
  return Math.min(places.length > 0 ? Math.min(...places) : ranking.length + 1, RANK_CAP);
}

function tally(name: string, ranks: number[]): string {
  const hit = (n: number) => ranks.filter((r) => r <= n).length;
  const mean = ranks.reduce((a, b) => a + b, 0) / ranks.length;
  return `${name.padEnd(44)} ${`${hit(3)}/${hit(5)}/${hit(10)}`.padEnd(11)} mean ${mean.toFixed(1)}   (${ranks.length} days)`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const value = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const run = value("run");
  if (!run) {
    console.error("Pass --run=<path of a typesafe-eval run, without -noul.json>.");
    process.exit(1);
  }
  const daysFile = value("days-file");
  const dayList =
    value("days") ??
    (daysFile ? readFileSync(daysFile, "utf8").trim().split(/\s+/).join(",") : undefined) ??
    (JSON.parse(readFileSync(`${run}-noul.json`, "utf8")) as { meta: { days: string } }).meta.days;
  const l2 = Number(value("l2") ?? 0.01);
  const days = await loadDays(run, dayList.split(","));
  const hasJudgments = days.every((day) => day.lists.judgments);
  const features = (value("features")?.split(",") as Feature[] | undefined) ??
    ALL_FEATURES.filter((f) => hasJudgments || !(JUDGMENTS as readonly string[]).includes(f));
  const unknown = features.filter((f) => !ALL_FEATURES.includes(f));
  if (unknown.length > 0) {
    console.error(`unknown feature(s): ${unknown.join(", ")}`);
    process.exit(1);
  }
  console.log(`run: ${run}\ndays: ${days.length} scorable\nfeatures: ${features.join(", ")}\nl2: ${l2}\n`);

  // Leave one month out.
  const months = [...new Set(days.map((d) => d.day.slice(0, 7)))].sort();
  const heldOut = new Map<string, { id: string; reason: string }[]>();
  const fits: { month: string; fit: Fit; trained: number }[] = [];
  for (const month of months) {
    const train = days.filter((d) => !d.day.startsWith(month));
    const test = days.filter((d) => d.day.startsWith(month));
    const fit = fitConditionalLogit(train.map((d) => nightOf(d, features)), { l2 });
    fits.push({ month, fit, trained: train.length });
    for (const day of test) {
      const { ids, rows } = featureRows(day.lists, features);
      const scores = scoreNight(fit, rows);
      const value = new Map(ids.map((id, i) => [id, scores[i]]));
      heldOut.set(day.day, order((id) => value.get(id)!, day.lists.score));
    }
  }

  console.log("held out, each month ranked by a fit on the other months:");
  const fitted = days.map((d) => pickRank(d, heldOut.get(d.day)!));
  console.log(`  ${tally("fitted (held out)", fitted)}`);
  const baselines: Record<string, (l: Lists) => (id: string) => number> = {
    "noul+choice+score": (l) => meanOfRanks(l.noul, l.choice, l.score),
    ...(hasJudgments
      ? {
          "all+due+regular": (l: Lists) => meanOfRanks(l.noul, l.choice, l.score, l.judgments!.due, l.judgments!.regular),
          "all+judgments": (l: Lists) => meanOfRanks(l.noul, l.choice, l.score, ...JUDGMENTS.map((j) => l.judgments![j])),
        }
      : {}),
    "all+weekday": (l) => meanOfRanks(l.noul, l.choice, l.score, l.weekday),
    "score alone": (l) => (id) => l.score.get(id)!,
  };
  for (const [name, arm] of Object.entries(baselines)) {
    console.log(`  ${tally(name, days.map((d) => pickRank(d, order(arm(d.lists), d.lists.score))))}`);
  }
  console.log("\nby held-out month (fitted / noul+choice+score):");
  for (const month of months) {
    const inMonth = days.filter((d) => d.day.startsWith(month));
    const a = inMonth.map((d) => pickRank(d, heldOut.get(d.day)!));
    const b = inMonth.map((d) => pickRank(d, order(meanOfRanks(d.lists.noul, d.lists.choice, d.lists.score), d.lists.score)));
    console.log(`  ${month}  ${tally("fitted", a)}\n           ${tally("noul+choice+score", b)}`);
  }

  console.log("\nweights (standardized; a negative weight on a place means higher in that list helps):");
  const header = `  ${"fold".padEnd(10)} ${features.map((f) => f.padStart(10)).join("")}`;
  console.log(header);
  for (const { month, fit } of fits) {
    console.log(`  ${`-${month}`.padEnd(10)} ${fit.weights.map((w) => w.toFixed(2).padStart(10)).join("")}`);
  }
  const all = fitConditionalLogit(days.map((d) => nightOf(d, features)), { l2 });
  console.log(`  ${"all days".padEnd(10)} ${all.weights.map((w) => w.toFixed(2).padStart(10)).join("")}`);

  const jsonPath = value("json");
  if (jsonPath) {
    const parsed = parseBacktestArgs([`--days=${days.map((d) => d.day).join(",")}`, `--json=${jsonPath}`], jsonPath);
    await runBacktest({
      args: parsed,
      meta: { ranker: "TypeSafe fit (held out by month)", source: run, features: features.join(","), l2: String(l2) },
      generate: async (built) => {
        const ranking = heldOut.get(built.snapshot.today.slice(0, 10));
        return ranking ? { ok: true, ranking } : { ok: false, ranking: [] };
      },
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("TypeSafe fit failed.");
    console.error(error);
    process.exit(1);
  });

