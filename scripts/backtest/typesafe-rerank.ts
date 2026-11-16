/**
 * Saved Jev answers (`scripts/backtest/typesafe-eval.ts`) ranked again, offline, and
 * scored through the AI ranking backtest (`scripts/backtest/backtest.ts`) — no call.
 * Each arm reads the day's saved response from `<run>-noul-reasoning/` and
 * the deterministic Score's view of the day (`scripts/backtest/typesafe-lists.ts`),
 * and orders the candidates without a fitted weight:
 *
 *   - score — the deterministic Score alone, the baseline on the run's days;
 *   - noul-scoretie, choice-scoretie — by Jev's probability, a tie broken by
 *     the Score instead of the Catalog's alphabetical order;
 *   - noul+choice, choice+score, noul+choice+score — by the mean of each
 *     list's rank (a tie in a list shares the mean of the places it spans),
 *     a tie broken by the Score;
 *   - affinity-scoretie, readiness-scoretie, weekday-scoretie — the Score's
 *     two factors on their own, and the count of the Option's dinners on
 *     this weekday;
 *   - noul+choice+affinity+readiness — the Score split into its factors as
 *     two lists; noul+choice+score+readiness — readiness added as a brake;
 *     all+weekday — the three-way mean with the weekday count;
 *     score+weekday — the Score and the weekday count, no Jev at all.
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
 *     widened by the judgments' ranks;
 *   - all+due+regular+pointedAt@note — pointedAt joins the mean only on a
 *     day with a Day note; all+due+regular+readiness — the same mean with
 *     the Score's readiness beside the Score; all+due+regular+weekday,
 *     all+regular+weekday, all+judgments+weekday — the weekday count added.
 *
 * `--judge=<judge.json>` (a `typesafe-judge.ts` run on the same days) adds
 * the stored note's rows: stance-scoretie (for tonight less against),
 * note-scoretie (the note's own order), note+stance, all+stance.
 *
 *   npx tsx scripts/backtest/typesafe-rerank.ts --run=scripts/backtest-runs/jev-1.14.0-history --json
 *   npx tsx scripts/backtest/typesafe-rerank.ts --run=<run> --arms=noul+choice+score,all+weekday --json
 *
 * The days are the run's own (`<run>-noul.json`) unless `--days=` names
 * them (a prospective run has no `-noul.json`); `--json` writes
 * `<run>-rerank-<arm>.json` per arm. Free: `DATABASE_URL` and `APP_TZ` from
 * `.env.local` then `.env`.
 */
import "../load-env";
import { existsSync, readFileSync } from "node:fs";
import { type BuiltSnapshot } from "../../lib/snapshot";
import { parseBacktestArgs, runBacktest } from "./backtest";
import {
  JUDGMENTS,
  type JudgeRow,
  type Lists,
  type ScoreView,
  listsFor,
  meanOfRanks,
  order,
  readSaved,
  scoreView,
} from "./typesafe-lists";

/** A Noul above this reads as yes in the gates — the docs' starting threshold. */
const GATE = 0.7;

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

type Arm = (lists: Lists) => (id: string) => number;

/** Each arm: a value per candidate, higher first; the Score breaks ties. */
const ARMS: Record<string, Arm> = {
  score: (l) => (id) => l.score.get(id)!,
  "noul-scoretie": (l) => (id) => l.noul.get(id)!,
  "choice-scoretie": (l) => (id) => l.choice.get(id)!,
  "noul+choice": (l) => meanOfRanks(l.noul, l.choice),
  "choice+score": (l) => meanOfRanks(l.choice, l.score),
  "noul+choice+score": (l) => meanOfRanks(l.noul, l.choice, l.score),
  "affinity-scoretie": (l) => (id) => l.affinity.get(id)!,
  "readiness-scoretie": (l) => (id) => l.readiness.get(id)!,
  "weekday-scoretie": (l) => (id) => l.weekday.get(id)!,
  "noul+choice+affinity+readiness": (l) => meanOfRanks(l.noul, l.choice, l.affinity, l.readiness),
  "noul+choice+score+readiness": (l) => meanOfRanks(l.noul, l.choice, l.score, l.readiness),
  "all+weekday": (l) => meanOfRanks(l.noul, l.choice, l.score, l.weekday),
  "score+weekday": (l) => meanOfRanks(l.score, l.weekday),
};
const JUDGMENT_ARMS: Record<string, Arm> = {
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
  // pointedAt has nothing to read without a Day note: on those days it is left out.
  "all+due+regular+pointedAt@note": (l) =>
    l.hasDayNote
      ? meanOfRanks(l.noul, l.choice, l.score, l.judgments!.due, l.judgments!.regular, l.judgments!.pointedAt)
      : meanOfRanks(l.noul, l.choice, l.score, l.judgments!.due, l.judgments!.regular),
  "all+due+regular+readiness": (l) =>
    meanOfRanks(l.noul, l.choice, l.score, l.judgments!.due, l.judgments!.regular, l.readiness),
  "all+due+regular+weekday": (l) =>
    meanOfRanks(l.noul, l.choice, l.score, l.judgments!.due, l.judgments!.regular, l.weekday),
  "all+regular+weekday": (l) => meanOfRanks(l.noul, l.choice, l.score, l.judgments!.regular, l.weekday),
  "all+judgments+weekday": (l) =>
    meanOfRanks(l.noul, l.choice, l.score, ...JUDGMENTS.map((judgment) => l.judgments![judgment]), l.weekday),
};
const JUDGE_ARMS: Record<string, Arm> = {
  "stance-scoretie": (l) => (id) => l.stance!.get(id)!,
  "note-scoretie": (l) => (id) => l.note!.get(id)!,
  "note+stance": (l) => meanOfRanks(l.note!, l.stance!),
  "all+stance": (l) => meanOfRanks(l.noul, l.choice, l.score, l.stance!),
  "all+due+regular+stance": (l) => meanOfRanks(l.noul, l.choice, l.score, l.judgments!.due, l.judgments!.regular, l.stance!),
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const run = args.find((a) => a.startsWith("--run="))?.slice(6);
  if (!run) {
    console.error("Pass --run=<path of a typesafe-eval run, without -noul.json>.");
    process.exit(1);
  }
  const daysArg = args.find((a) => a.startsWith("--days="));
  const days =
    daysArg?.slice(7) ??
    (JSON.parse(readFileSync(`${run}-noul.json`, "utf8")) as { meta: { days: string } }).meta.days;
  const parsed = parseBacktestArgs([...args.filter((a) => a !== daysArg), `--days=${days}`], `${run}-rerank.json`);
  const only = args.find((a) => a.startsWith("--arms="))?.slice(7).split(",");

  const judgePath = args.find((a) => a.startsWith("--judge="))?.slice(8);
  const judgeByDay = new Map<string, JudgeRow[]>();
  if (judgePath) {
    const judge = JSON.parse(readFileSync(judgePath, "utf8")) as { days: { day: string; ok: boolean; rows: JudgeRow[] }[] };
    for (const day of judge.days) if (day.ok) judgeByDay.set(day.day, day.rows);
  }

  // The judgment arms run when the run's first day saved the judgments.
  const firstDay = days.split(",")[0];
  const first = readSaved(run, firstDay);
  const withJudgments = JUDGMENTS.every((judgment) =>
    Object.keys(first.response.answers).some((name) => name.startsWith(`${judgment}_`)),
  );
  const arms = {
    ...ARMS,
    ...(withJudgments ? JUDGMENT_ARMS : {}),
    ...(judgePath ? JUDGE_ARMS : {}),
  };
  const unknown = only?.filter((arm) => !(arm in arms)) ?? [];
  if (unknown.length > 0) {
    console.error(`unknown arm(s): ${unknown.join(", ")}; known: ${Object.keys(arms).join(", ")}`);
    process.exit(1);
  }

  // One Score view and one set of lists per day, shared by every arm.
  const listsByDay = new Map<string, Promise<Lists | string>>();
  const listsOf = (built: BuiltSnapshot) => {
    const day = built.snapshot.today.slice(0, 10);
    if (!listsByDay.has(day)) {
      listsByDay.set(
        day,
        scoreView(built).then((view: ScoreView) => {
          if (!existsSync(`${run}-noul-reasoning/${day}.txt`)) return `no saved answers for ${day}`;
          return listsFor(built, readSaved(run, day), view, judgePath ? judgeByDay.get(day) ?? [] : undefined);
        }),
      );
    }
    return listsByDay.get(day)!;
  };

  for (const [arm, valueOf] of Object.entries(arms)) {
    if (only && !only.includes(arm)) continue;
    await runBacktest({
      args: { ...parsed, jsonPath: parsed.jsonPath?.replace(/(\.json)?$/, `-${arm}.json`) },
      meta: { ranker: `TypeSafe rerank ${arm}`, source: run },
      generate: async (built) => {
        const lists = await listsOf(built);
        if (typeof lists === "string") {
          console.error(`${built.snapshot.today.slice(0, 10)}: ${lists}`);
          return { ok: false, ranking: [] };
        }
        // A judge arm has nothing to read on a day the judge run skipped.
        if (arm in JUDGE_ARMS && !lists.stance) return { ok: false, ranking: [] };
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
