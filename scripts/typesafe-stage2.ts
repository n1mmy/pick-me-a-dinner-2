/**
 * A second pass over the first pass's top rows — the re-ranking cookbook's
 * shape. For each day of a saved Jev run (`scripts/typesafe-eval.ts`), the
 * three-way mean of the Noul's, the Choice's and the Score's ranks
 * (`scripts/typesafe-lists.ts`) picks the top ten, and one more request over
 * the same state 6 asks:
 *
 *   - choice10 — one Choice among the ten, in an order shuffled by the date;
 *   - pair_<i>_<j> — a two-way Choice for every pair among the top eight
 *     (28), each pair's order shuffled too.
 *
 * Fewer options leave less probability to spread and fewer two-decimal ties.
 * The arms, each scored through the backtest with the rows past the top ten
 * in the first pass's order:
 *
 *   - stage2-choice        — the ten by the Choice, a tie broken by the first pass;
 *   - stage2-choice+base   — the ten by the mean of their first-pass rank and
 *                            their Choice rank;
 *   - stage2-pairwise      — the eight by Bradley–Terry strength from the
 *                            pairs (`scripts/pairwise-order.ts`), 9 and 10 kept;
 *   - stage2-pairwise+base — the eight by the mean of first-pass rank and
 *                            Bradley–Terry rank.
 *
 *   npx tsx scripts/typesafe-stage2.ts --run=scripts/backtest-runs/jev-1.14.0-s6-j1-history --dry-run
 *   npx tsx scripts/typesafe-stage2.ts --run=<run> --json
 *
 * Billed per input token, one request a day (the state is read once; ~35k
 * tokens): state the call count and get approval first (`CLAUDE.md`). The
 * days are the run's own; `--json` writes `<run>-stage2-<arm>.json` and the
 * request and response beside them (`<run>-stage2-reasoning/<day>.txt`).
 */
import "./load-env";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { type BuiltSnapshot } from "../lib/snapshot";
import { type Generation, parseBacktestArgs, runBacktest } from "./backtest";
import { bradleyTerry } from "./pairwise-order";
import { type JevCall, type JevResponse, MODEL, jevStateWithOptionHistory, seededShuffle, sendJev } from "./typesafe-eval";
import { type Lists, listsFor, meanOfRanks, order, readSaved, scoreView } from "./typesafe-lists";

const TOP_CHOICE = 10;
const TOP_PAIRS = 8;
const CHOICE_INSTRUCTIONS = "Which of these will the Household eat for dinner on the evening of `today`?";

type Stage1 = { lists: Lists; base: { id: string; reason: string }[] };

/** The second request: the top ten's Choice and the top eight's pairs. */
export function stage2Request(built: BuiltSnapshot, base: { id: string }[]) {
  const name = (id: string) => built.nameById.get(id)!;
  const ten = base.slice(0, TOP_CHOICE).map((row) => name(row.id));
  const eight = base.slice(0, TOP_PAIRS).map((row) => name(row.id));
  const questions: Record<string, unknown> = {
    choice10: {
      type: "choice",
      instructions: CHOICE_INSTRUCTIONS,
      criteria: Object.fromEntries(seededShuffle(ten, built.snapshot.today).map((n) => [n, null])),
    },
  };
  for (let i = 0; i < eight.length; i++) {
    for (let j = i + 1; j < eight.length; j++) {
      const pair = seededShuffle([eight[i], eight[j]], `${built.snapshot.today}/${i}/${j}`);
      questions[`pair_${i}_${j}`] = {
        type: "choice",
        instructions: CHOICE_INSTRUCTIONS,
        criteria: Object.fromEntries(pair.map((n) => [n, null])),
      };
    }
  }
  return { model: MODEL, state: jevStateWithOptionHistory(built), questions };
}

type Saved2 = { request: ReturnType<typeof stage2Request>; response: JevResponse };

/** Each arm's ranking out of the first pass and the second's answers. */
function rankings(built: BuiltSnapshot, stage1: Stage1, saved: Saved2): Record<string, Generation["ranking"]> {
  const { base } = stage1;
  const idByName = new Map([...built.nameById].map(([id, n]) => [n, id]));
  const rest = (from: number) => base.slice(from).map((row) => ({ id: row.id, reason: `base ${row.reason}` }));
  const basePlace = new Map(base.map((row, i) => [row.id, -(i + 1)]));

  const choice = saved.response.answers.choice10;
  if (choice.type !== "choice") throw new Error("no choice10");
  const choiceValue = new Map(
    base.slice(0, TOP_CHOICE).map((row) => [row.id, choice.probabilities[built.nameById.get(row.id)!]]),
  );
  const tenBase = new Map(base.slice(0, TOP_CHOICE).map((row) => [row.id, basePlace.get(row.id)!]));
  const byChoice = order((id) => choiceValue.get(id)!, tenBase);
  const byChoiceAndBase = order(meanOfRanks(choiceValue, tenBase), tenBase);

  const pairs = Object.entries(saved.response.answers).flatMap(([key, answer]) => {
    const m = /^pair_(\d+)_(\d+)$/.exec(key);
    if (!m || answer.type !== "choice") return [];
    const [a, b] = Object.keys(answer.probabilities);
    return [{ a: idByName.get(a)!, b: idByName.get(b)!, p: answer.probabilities[a] }];
  });
  const strength = bradleyTerry(pairs);
  const eightBase = new Map(base.slice(0, TOP_PAIRS).map((row) => [row.id, basePlace.get(row.id)!]));
  const strengthValue = new Map(base.slice(0, TOP_PAIRS).map((row) => [row.id, strength.get(row.id) ?? 0]));
  const byPairs = order((id) => strengthValue.get(id)!, eightBase);
  const byPairsAndBase = order(meanOfRanks(strengthValue, eightBase), eightBase);

  return {
    "stage2-choice": [...byChoice.map((r) => ({ ...r, reason: `choice10 ${r.reason}` })), ...rest(TOP_CHOICE)],
    "stage2-choice+base": [...byChoiceAndBase.map((r) => ({ ...r, reason: `mean ${r.reason}` })), ...rest(TOP_CHOICE)],
    "stage2-pairwise": [...byPairs.map((r) => ({ ...r, reason: `bt ${r.reason}` })), ...rest(TOP_PAIRS)],
    "stage2-pairwise+base": [...byPairsAndBase.map((r) => ({ ...r, reason: `mean ${r.reason}` })), ...rest(TOP_PAIRS)],
  };
}
const ARMS = ["stage2-choice", "stage2-choice+base", "stage2-pairwise", "stage2-pairwise+base"];

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const run = args.find((a) => a.startsWith("--run="))?.slice(6);
  if (!run) {
    console.error("Pass --run=<path of a typesafe-eval run, without -noul.json>.");
    process.exit(1);
  }
  const days = (JSON.parse(readFileSync(`${run}-noul.json`, "utf8")) as { meta: { days: string } }).meta.days;
  const parsed = parseBacktestArgs([...args, `--days=${days}`], `${run}-stage2.json`);
  const dir = `${run}-stage2-reasoning`;

  const stage1ByDay = new Map<string, Promise<Stage1 | string>>();
  const stage1Of = (built: BuiltSnapshot) => {
    const day = built.snapshot.today.slice(0, 10);
    if (!stage1ByDay.has(day)) {
      stage1ByDay.set(
        day,
        scoreView(built).then((view) => {
          const lists = listsFor(built, readSaved(run, day), view);
          if (typeof lists === "string") return lists;
          return { lists, base: order(meanOfRanks(lists.noul, lists.choice, lists.score), lists.score) };
        }),
      );
    }
    return stage1ByDay.get(day)!;
  };

  if (args.includes("--dry-run")) {
    const { snapshotForDay } = await import("../lib/snapshot");
    const day = days.split(",").at(-1)!;
    const built = await snapshotForDay({ asOf: day, query: "", backtest: true });
    const stage1 = await stage1Of(built);
    if (typeof stage1 === "string") throw new Error(stage1);
    const request = stage2Request(built, stage1.base);
    const chars = JSON.stringify(request).length;
    console.log(`day: ${day}   questions: ${Object.keys(request.questions).length}   request: ${chars} chars (~${Math.round(chars / 4)} tokens)`);
    console.log(`days: ${days.split(",").length}   choice10: ${JSON.stringify(request.questions.choice10)}`);
    console.log(`pair_0_1: ${JSON.stringify(request.questions.pair_0_1)}`);
    return;
  }

  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    console.error("TYPESAFE_API_KEY is not set — add it to .env.local.");
    process.exit(1);
  }
  // One call per day, shared by every arm; a day already saved is read back.
  const calls = new Map<string, Promise<JevCall>>();
  const callFor = (built: BuiltSnapshot, stage1: Stage1) => {
    const day = built.snapshot.today.slice(0, 10);
    if (!calls.has(day)) {
      const file = `${dir}/${day}.txt`;
      if (existsSync(file)) {
        const saved = JSON.parse(readFileSync(file, "utf8")) as Saved2;
        calls.set(day, Promise.resolve({ ok: true, request: saved.request, response: saved.response, latencyMs: 0 }));
      } else {
        calls.set(
          day,
          sendJev(apiKey, built, stage2Request(built, stage1.base), true).then((call) => {
            if (call.ok) {
              mkdirSync(dir, { recursive: true });
              writeFileSync(file, JSON.stringify({ request: call.request, response: call.response }, null, 2));
              console.log(`jev: ${call.response.model}, ${call.response.usage.input_tokens} input tokens, ${(call.latencyMs / 1000).toFixed(1)}s`);
            }
            return call;
          }),
        );
      }
    }
    return calls.get(day)!;
  };

  for (const arm of ARMS) {
    await runBacktest({
      args: { ...parsed, jsonPath: parsed.jsonPath?.replace(/(\.json)?$/, `-${arm}.json`) },
      meta: { ranker: `TypeSafe stage 2 ${arm}`, model: MODEL, source: run },
      generate: async (built) => {
        const stage1 = await stage1Of(built);
        if (typeof stage1 === "string") {
          console.error(`${built.snapshot.today.slice(0, 10)}: ${stage1}`);
          return { ok: false, ranking: [] };
        }
        const call = await callFor(built, stage1);
        if (!call.ok) {
          console.error(`TypeSafe call failed: ${call.error}`);
          return { ok: false, ranking: [] };
        }
        const saved = { request: call.request as Saved2["request"], response: call.response };
        return { ok: true, ranking: rankings(built, stage1, saved)[arm], latencyMs: call.latencyMs };
      },
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("TypeSafe stage 2 failed.");
    console.error(error);
    process.exit(1);
  });

