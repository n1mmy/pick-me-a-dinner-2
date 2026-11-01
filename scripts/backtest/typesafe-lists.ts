/**
 * The lists a day's saved Jev answers (`scripts/backtest/typesafe-eval.ts`) and the
 * deterministic Score give, each a value per candidate id with higher first,
 * and the rank arithmetic that combines them. Shared by
 * `scripts/backtest/typesafe-rerank.ts` (arms with no fitted weight),
 * `scripts/backtest/typesafe-fit.ts` (weights fitted with a month held out),
 * `scripts/backtest/typesafe-stage2.ts` (a second Choice over the first pass's top
 * rows) and `scripts/backtest/typesafe-calibration.ts`. No call: everything reads
 * from `<run>-noul-reasoning/<day>.txt` and the live tables.
 */
import { readFileSync } from "node:fs";
import { getTonightData } from "../../db/queries";
import { weekdayName } from "../../lib/local-day";
import { type BuiltSnapshot } from "../../lib/snapshot";
import { tonightForDay } from "../../lib/tonight-day";

/** One day's saved request and response, as the eval writes them. */
export type Saved = {
  request: { questions: Record<string, { type: string; instructions: string | { question: string } }> };
  response: {
    answers: Record<string, { type: "noul"; noul: number } | { type: "choice"; probabilities: Record<string, number> }>;
  };
};

/** The judgments a `--judgments` run saves, by their question-name prefix. */
export const JUDGMENTS = ["tooSoon", "ruledOut", "pointedAt", "due", "regular"] as const;
export type Judgment = (typeof JUDGMENTS)[number];

/**
 * One day's lists. `tooSoon` and `ruledOut` are stored inverted (1 − p), so
 * every list reads "more likely to be eaten" upward; the judgments are
 * present on a `--judgments` run only. `affinity` and `readiness` are the
 * Score's two factors, `weekday` is how often the Option was had on this
 * weekday before today, and `stance` (from a `typesafe-judge.ts` run) is the
 * note row's for-tonight less its against-tonight.
 */
export type Lists = {
  noul: Map<string, number>;
  choice: Map<string, number>;
  score: Map<string, number>;
  affinity: Map<string, number>;
  readiness: Map<string, number>;
  weekday: Map<string, number>;
  hasDayNote: boolean;
  judgments?: Record<Judgment, Map<string, number>>;
  stance?: Map<string, number>;
  /** The stored note's own order, from the judge run's rows; negated place. */
  note?: Map<string, number>;
};

/** Each id's place in `values`, highest first; a tie shares the mean of its places. Negated. */
export function ranksOf(values: Map<string, number>): Map<string, number> {
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

/** The mean of each list's rank, a tie in a list sharing the mean of its places. */
export const meanOfRanks =
  (...lists: Map<string, number>[]) =>
  (id: string) =>
    lists.reduce((sum, list) => sum + ranksOf(list).get(id)!, 0) / lists.length;

/** Highest value first, a tie broken by the Score. */
export function order(value: (id: string) => number, score: Map<string, number>): { id: string; reason: string }[] {
  const ids = [...score.keys()];
  return ids
    .map((id) => ({ id, v: value(id), s: score.get(id)! }))
    .sort((a, b) => b.v - a.v || b.s - a.s)
    .map(({ id, v }) => ({ id, reason: v.toFixed(3) }));
}

/** The Score's view of the day: its order and its two factors, over today's candidates. */
export type ScoreView = {
  order: string[];
  affinity: Map<string, number>;
  readiness: Map<string, number>;
  weekday: Map<string, number>;
};

export async function scoreView(built: BuiltSnapshot): Promise<ScoreView> {
  const day = built.snapshot.today.slice(0, 10);
  const { options, logEntries } = await getTonightData(day);
  const before = logEntries.filter((entry) => entry.eatenOn < day);
  const view = tonightForDay({
    options,
    logEntries: before,
    dayEntries: [],
    rejections: [],
    selectedDay: day,
    today: day,
    dayNote: null,
  });
  const candidates = new Set(built.idByCode.values());
  const rows = view.picker.filter((row) => candidates.has(row.option.id));
  const weekday = weekdayName(day);
  const sameWeekday = new Map<string, number>();
  for (const entry of before) {
    if (weekdayName(entry.eatenOn) === weekday) {
      sameWeekday.set(entry.optionId, (sameWeekday.get(entry.optionId) ?? 0) + 1);
    }
  }
  return {
    order: rows.map((row) => row.option.id),
    affinity: new Map(rows.map((row) => [row.option.id, row.affinity])),
    readiness: new Map(rows.map((row) => [row.option.id, row.readiness])),
    weekday: new Map(rows.map((row) => [row.option.id, sameWeekday.get(row.option.id) ?? 0])),
  };
}

/** One judged note row, as `typesafe-judge.ts` saves it. */
export type JudgeRow = {
  rank: number;
  name: string;
  answers: { stance: { for_tonight: number; against_tonight: number; neither: number } };
};

export function readSaved(run: string, day: string): Saved {
  return JSON.parse(readFileSync(`${run}-noul-reasoning/${day}.txt`, "utf8")) as Saved;
}

/**
 * The day's lists out of its saved answers and the Score's view, or the
 * reason they cannot be read. `judgeRows` adds the stance and the note's
 * own order when given.
 */
export function listsFor(built: BuiltSnapshot, saved: Saved, score: ScoreView, judgeRows?: JudgeRow[]): Lists | string {
  const { answers } = saved.response;
  const { questions } = saved.request;
  const lists: Lists = {
    noul: new Map(),
    choice: new Map(),
    score: new Map(),
    affinity: score.affinity,
    readiness: score.readiness,
    weekday: score.weekday,
    hasDayNote: built.snapshot.todayDayNote !== null,
  };
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
    const asked = questions[`noul_${option.id}`]?.instructions;
    const text = typeof asked === "string" ? asked : asked?.question;
    // The codes are the Catalog's order now; a changed Catalog would shift them.
    if (noul?.type !== "noul" || !text?.includes(` ${option.name} `)) {
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
    const place = score.order.indexOf(id);
    lists.score.set(id, -(place === -1 ? score.order.length + 1 : place + 1));
  }
  if (judgeRows && judgeRows.length > 0) {
    const idByName = new Map([...built.nameById].map(([id, name]) => [name, id]));
    lists.stance = new Map();
    lists.note = new Map();
    // A candidate the note left out ranks below every row it has.
    for (const id of lists.noul.keys()) {
      lists.stance.set(id, -1);
      lists.note.set(id, -(judgeRows.length + 1));
    }
    for (const row of judgeRows) {
      const id = idByName.get(row.name);
      if (!id || !lists.noul.has(id)) continue;
      lists.stance.set(id, row.answers.stance.for_tonight - row.answers.stance.against_tonight);
      lists.note.set(id, -row.rank);
    }
  }
  return lists;
}
