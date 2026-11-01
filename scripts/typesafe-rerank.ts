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
 * A run made with `--judgments` (five more Nouls per candidate: tooSoon,
 * ruledOut, pointedAt, due, regular) adds arms that combine them in code:
 *
 *   - <judgment>-scoretie — each judgment alone, tooSoon and ruledOut
 *     inverted, so higher is more likely to be eaten;
 *   - gates+score, gates+choice, gates+all — a truth table over a base order
 *     (the Score, the Choice, or the three-way mean): a candidate ruled out
 *     or too soon above `GATE` goes to the bottom, one the Day note points at
 *     above `GATE` to the top, the rest keep the base order;
 *   - gates90+all, lift+all — the gates at 0.9, and the lift without the
 *     exclusions;
 *   - all+due+regular, all+judgments, all+judgments-due — the three-way mean
 *     widened by the judgments' ranks.
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

/** The judgments a `--judgments` run saves, by their question-name prefix. */
const JUDGMENTS = ["tooSoon", "ruledOut", "pointedAt", "due", "regular"] as const;
type Judgment = (typeof JUDGMENTS)[number];

/** A Noul above this reads as yes in the gates — the docs' starting threshold. */
const GATE = 0.7;

/**
 * One day's lists, each a value per candidate id, higher first. `tooSoon` and
 * `ruledOut` are stored inverted (1 − p), so every list reads "more likely
 * to be eaten" upward; the judgments are present on a `--judgments` run only.
 */
type Lists = {
  noul: Map<string, number>;
  choice: Map<string, number>;
  score: Map<string, number>;
  judgments?: Record<Judgment, Map<string, number>>;
};

/** The mean of each list's rank, a tie in a list sharing the mean of its places. */
const meanOfRanks = (...lists: Map<string, number>[]) => (id: string) =>
  lists.reduce((sum, list) => sum + ranksOf(list).get(id)!, 0) / lists.length;

/**
 * A truth table over `base`: ruled out or too soon above `GATE` sends a
 * candidate below every other; pointed at above `GATE` lifts it above. Inside
 * each band the base order holds.
 */
const gated = (lists: Lists, base: (id: string) => number, gate = GATE, exclude = true) => {
  const j = lists.judgments!;
  return (id: string) => {
    const out = exclude && (j.ruledOut.get(id)! < 1 - gate || j.tooSoon.get(id)! < 1 - gate);
    const lifted = j.pointedAt.get(id)! > gate;
    return base(id) + (out ? -1000 : 0) + (lifted && !out ? 1000 : 0);
  };
};

/** Each arm: a value per candidate, higher first; the Score breaks ties. */
const ARMS: Record<string, (lists: Lists) => (id: string) => number> = {
  "noul-scoretie": (l) => (id) => l.noul.get(id)!,
  "choice-scoretie": (l) => (id) => l.choice.get(id)!,
  "noul+choice": (l) => meanOfRanks(l.noul, l.choice),
  "choice+score": (l) => meanOfRanks(l.choice, l.score),
  "noul+choice+score": (l) => meanOfRanks(l.noul, l.choice, l.score),
};
const JUDGMENT_ARMS: Record<string, (lists: Lists) => (id: string) => number> = {
  ...Object.fromEntries(
    JUDGMENTS.map((judgment) => [`${judgment}-scoretie`, (l: Lists) => (id: string) => l.judgments![judgment].get(id)!]),
  ),
  "gates+score": (l) => gated(l, (id) => l.score.get(id)!),
  "gates+choice": (l) => gated(l, (id) => l.choice.get(id)!),
  "gates+all": (l) => gated(l, meanOfRanks(l.noul, l.choice, l.score)),
  // The gates at 0.9, and the lift alone: does a hard rule help when it is sure?
  "gates90+all": (l) => gated(l, meanOfRanks(l.noul, l.choice, l.score), 0.9),
  "lift+all": (l) => gated(l, meanOfRanks(l.noul, l.choice, l.score), GATE, false),
  "all+due+regular": (l) => meanOfRanks(l.noul, l.choice, l.score, l.judgments!.due, l.judgments!.regular),
  "all+judgments": (l) =>
    meanOfRanks(l.noul, l.choice, l.score, ...JUDGMENTS.map((judgment) => l.judgments![judgment])),
  // Without `due`, which alone ranks never-eaten Options as due.
  "all+judgments-due": (l) =>
    meanOfRanks(l.noul, l.choice, l.score, l.judgments!.tooSoon, l.judgments!.ruledOut, l.judgments!.pointedAt, l.judgments!.regular),
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
  const hasJudgments = JUDGMENTS.every((judgment) =>
    built.snapshot.options.every((option) => answers[`${judgment}_${option.id}`]?.type === "noul"),
  );
  if (hasJudgments) {
    lists.judgments = Object.fromEntries(JUDGMENTS.map((judgment) => [judgment, new Map()])) as Record<
      Judgment,
      Map<string, number>
    >;
  }
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
    for (const judgment of hasJudgments ? JUDGMENTS : []) {
      const answer = answers[`${judgment}_${option.id}`] as { type: "noul"; noul: number };
      const inverted = judgment === "tooSoon" || judgment === "ruledOut";
      lists.judgments![judgment].set(id, inverted ? 1 - answer.noul : answer.noul);
    }
  }
  // The Score is an order with no ties: its value is the negated place.
  for (const id of lists.noul.keys()) {
    const place = score.indexOf(id);
    lists.score.set(id, -(place === -1 ? score.length + 1 : place + 1));
  }
  return lists;
}

/** Highest value first, a tie broken by the Score. */
function order(value: (id: string) => number, score: Map<string, number>): Generation["ranking"] {
  const ids = [...score.keys()];
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

  // The judgment arms run when the run's first day saved the judgments.
  const firstDay = days.split(",")[0];
  const first = JSON.parse(readFileSync(`${run}-noul-reasoning/${firstDay}.txt`, "utf8")) as Saved;
  const withJudgments = JUDGMENTS.every((judgment) =>
    Object.keys(first.response.answers).some((name) => name.startsWith(`${judgment}_`)),
  );
  const arms = withJudgments ? { ...ARMS, ...JUDGMENT_ARMS } : ARMS;

  for (const [arm, valueOf] of Object.entries(arms)) {
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
        return { ok: true, ranking: order(valueOf(lists), lists.score) };
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
