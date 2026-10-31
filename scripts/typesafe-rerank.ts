/**
 * Saved Jev answers (`scripts/typesafe-eval.ts`) ranked again, offline, and
 * scored through the AI ranking backtest (`scripts/backtest.ts`) — no call.
 * Each arm reads the day's saved response from `<run>-noul-reasoning/` and
 * the deterministic Score's order for the day, and orders the candidates
 * without a fitted weight:
 *
 *   - noul-scoretie, choice-scoretie — by Jev's probability, a tie broken by
 *     the Score instead of the Catalog's alphabetical order;
 *   - noul+choice, choice+score, noul+choice+score — by the mean of each
 *     list's rank (a tie in a list shares the mean of the places it spans),
 *     a tie broken by the Score.
 *
 *   npx tsx scripts/typesafe-rerank.ts --run=scripts/backtest-runs/jev-1.14.0-history --json
 *
 * The days are the run's own (`<run>-noul.json`); `--json` writes
 * `<run>-rerank-<arm>.json` per arm. Free: `DATABASE_URL` and `APP_TZ` from
 * `.env.local` then `.env`.
 */
import "./load-env";
import { readFileSync } from "node:fs";
import { getTonightData } from "../db/queries";
import { type BuiltSnapshot } from "../lib/snapshot";
import { tonightForDay } from "../lib/tonight-day";
import { type Generation, parseBacktestArgs, runBacktest } from "./backtest";

type Saved = {
  request: { questions: Record<string, { type: string; instructions: string }> };
  response: {
    answers: Record<string, { type: "noul"; noul: number } | { type: "choice"; probabilities: Record<string, number> }>;
  };
};

/** One day's lists, each a value per candidate id, higher first. */
type Lists = { noul: Map<string, number>; choice: Map<string, number>; score: Map<string, number> };

const ARMS: Record<string, (lists: Lists) => Map<string, number>[]> = {
  "noul-scoretie": (l) => [l.noul],
  "choice-scoretie": (l) => [l.choice],
  "noul+choice": (l) => [ranksOf(l.noul), ranksOf(l.choice)],
  "choice+score": (l) => [ranksOf(l.choice), ranksOf(l.score)],
  "noul+choice+score": (l) => [ranksOf(l.noul), ranksOf(l.choice), ranksOf(l.score)],
};

/** Each id's place in `values`, highest first; a tie shares the mean of its places. Negated. */
function ranksOf(values: Map<string, number>): Map<string, number> {
  const sorted = [...values].sort((a, b) => b[1] - a[1]);
  const ranks = new Map<string, number>();
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j < sorted.length && sorted[j][1] === sorted[i][1]) j++;
    for (let k = i; k < j; k++) ranks.set(sorted[k][0], -((i + 1 + j) / 2));
    i = j;
  }
  return ranks;
}

async function scoreOrder(built: BuiltSnapshot): Promise<string[]> {
  const day = built.snapshot.today.slice(0, 10);
  const { options, logEntries } = await getTonightData(day);
  const view = tonightForDay({
    options,
    logEntries: logEntries.filter((entry) => entry.eatenOn < day),
    dayEntries: [],
    rejections: [],
    selectedDay: day,
    today: day,
    dayNote: null,
  });
  const candidates = new Set(built.idByCode.values());
  return view.picker.map((row) => row.option.id).filter((id) => candidates.has(id));
}

function listsFor(built: BuiltSnapshot, saved: Saved, score: string[]): Lists | string {
  const { answers } = saved.response;
  const { questions } = saved.request;
  const lists: Lists = { noul: new Map(), choice: new Map(), score: new Map() };
  for (const option of built.snapshot.options) {
    const id = built.idByCode.get(option.id)!;
    const noul = answers[`noul_${option.id}`];
    // The codes are the Catalog's order now; a changed Catalog would shift them.
    if (noul?.type !== "noul" || !questions[`noul_${option.id}`].instructions.includes(` ${option.name} `)) {
      return `noul_${option.id} is not ${option.name}`;
    }
    const choice = answers.choice;
    const p = choice?.type === "choice" ? choice.probabilities[option.name] : undefined;
    if (p === undefined) return `no Choice probability for ${option.name}`;
    lists.noul.set(id, noul.noul);
    lists.choice.set(id, p);
  }
  // The Score is an order with no ties: its value is the negated place.
  for (const id of lists.noul.keys()) {
    const place = score.indexOf(id);
    lists.score.set(id, -(place === -1 ? score.length + 1 : place + 1));
  }
  return lists;
}

/** Highest combined value first: the mean over `parts`, a tie broken by the Score. */
function order(parts: Map<string, number>[], score: Map<string, number>): Generation["ranking"] {
  const ids = [...score.keys()];
  const value = (id: string) => parts.reduce((sum, part) => sum + part.get(id)!, 0) / parts.length;
  return ids
    .map((id) => ({ id, v: value(id), s: score.get(id)! }))
    .sort((a, b) => b.v - a.v || b.s - a.s)
    .map(({ id, v }) => ({ id, reason: v.toFixed(3) }));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const run = args.find((a) => a.startsWith("--run="))?.slice(6);
  if (!run) {
    console.error("Pass --run=<path of a typesafe-eval run, without -noul.json>.");
    process.exit(1);
  }
  const days = (JSON.parse(readFileSync(`${run}-noul.json`, "utf8")) as { meta: { days: string } }).meta.days;
  const parsed = parseBacktestArgs([...args, `--days=${days}`], `${run}-rerank.json`);
  const scoreByDay = new Map<string, Promise<string[]>>();

  for (const [arm, partsOf] of Object.entries(ARMS)) {
    await runBacktest({
      args: { ...parsed, jsonPath: parsed.jsonPath?.replace(/(\.json)?$/, `-${arm}.json`) },
      meta: { ranker: `TypeSafe rerank ${arm}`, source: run },
      generate: async (built) => {
        const day = built.snapshot.today.slice(0, 10);
        if (!scoreByDay.has(day)) scoreByDay.set(day, scoreOrder(built));
        const saved = JSON.parse(readFileSync(`${run}-noul-reasoning/${day}.txt`, "utf8")) as Saved;
        const lists = listsFor(built, saved, await scoreByDay.get(day)!);
        if (typeof lists === "string") {
          console.error(`${day}: ${lists}`);
          return { ok: false, ranking: [] };
        }
        return { ok: true, ranking: order(partsOf(lists), lists.score) };
      },
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("TypeSafe rerank failed.");
    console.error(error);
    process.exit(1);
  });
