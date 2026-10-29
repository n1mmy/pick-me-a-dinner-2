/**
 * The AI ranking backtest, shared by `scripts/prepared-note-eval.ts` (Strata)
 * and `scripts/ai-search-eval.ts` (Claude): run a ranker against recent
 * **decided** days, each built as the Household saw it before deciding
 * (`snapshotForDay`'s backtest mode), and score the ranking against what was
 * actually eaten that day.
 *
 * Per day and in aggregate: the rank of the Pick, hit@3/5/10, the Pick's
 * daysSinceLast and recent gaps, any Option Rejected that day as too soon
 * that sat in the top 5, top-5 slots spent on Options never eaten in the
 * window, empty top-10 reasons, and a ranking written in Option-code
 * order (rank positions where codes belong). A Prepared note's brief is
 * recorded for reading, not scored: a prompt change is judged by reading days.
 *
 * Two runs' `--json` files are compared by `scripts/backtest-compare.ts`.
 *
 *   --backtest              run the backtest instead of a single day
 *   --days=D1,D2,…          a fixed day list, so runs compare like with like
 *   --count=N               days sampled across weekdays (default 20)
 *   --window=N              how far back to sample, in days (default 60)
 *   --exclude=D1,D2,…       days left out of the sample — a second set of
 *                           days that shares none with a saved run
 *   --json[=path]           write every day's record, rewritten as each lands
 *   --resume                with --json: keep the days already in the file
 *
 * The Catalog is read as it is now, so the window stays recent: an Option
 * archived, added, or re-tagged since a day is off for that day.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { getDayNotes, getDecidedDates, getLog, getLogRejections } from "../db/queries";
import type { AiRankingRow } from "../lib/ai-search";
import {
  isValidSqlDate,
  shiftSqlDate,
  today,
  WEEKDAY_NAMES,
  weekdayFromSqlDate,
  weekdayName,
} from "../lib/local-day";
import {
  type BuiltSnapshot,
  codeIndex,
  snapshotForDay,
  type SnapshotModelOption,
} from "../lib/snapshot";

const DEFAULT_COUNT = 20;
const DEFAULT_WINDOW_DAYS = 60;

/** One decided day and its ground truth, read from the live tables. */
export type BacktestDay = {
  day: string;
  /** Everything Logged on the day — the answer. */
  picks: { optionId: string; name: string }[];
  /** Rejections dated on the day — scored, never a suppression. */
  rejections: { optionId: string; name: string; reason: string | null }[];
  dayNote: string | null;
};

/** What a ranker returns for one day. */
export type Generation = {
  ok: boolean;
  ranking: AiRankingRow[];
  /** A Prepared note's brief; absent for AI search. */
  brief?: string;
  latencyMs?: number;
  outputTokens?: number;
  /** Strata's reasoning trace, saved beside the JSON when asked for. */
  reasoning?: string;
};

type Ranked = { rank: number; name: string };

/** One day's score — one record in the `--json` file. */
export type DayRecord = {
  day: string;
  weekday: string;
  dayNote: string | null;
  ok: boolean;
  candidates: number;
  /** Each Pick and its rank — `null` when not a candidate or not ranked. */
  picks: { name: string; rank: number | null; candidate: boolean }[];
  /** Best rank among the Picks — `null` when no Pick could be ranked. */
  bestRank: number | null;
  /** False when no Pick was a candidate (archived, closed) or the run failed. */
  scorable: boolean;
  hit3: boolean;
  hit5: boolean;
  hit10: boolean;
  /** Each candidate Pick's daysSinceLast and its recent gaps, from the snapshot. */
  pickTiming: {
    name: string;
    daysSinceLast: number | null;
    recentGaps?: number[];
  }[];
  /** Options Rejected that day as too soon, ranked in the top 5. */
  tooSoonMisses: (Ranked & { reason: string })[];
  /** Top-10 rows with an empty reason. */
  emptyTop10: number;
  /**
   * The whole ranking came out in Option-code order: the model wrote its rank
   * positions where the codes belong, and the "ranking" is the Catalog. With
   * letter codes such a row resolves to nothing (ADR-0013); kept as a sentinel.
   */
  catalogOrder: boolean;
  brief?: string;
  ranking: (Ranked & { reason: string })[];
  latencyMs?: number;
  outputTokens?: number;
};

/**
 * Up to `count` days from `decided`, spread across weekdays: each weekday's
 * days newest first, taken round-robin from Sunday. Chronological out.
 */
export function sampleAcrossWeekdays(decided: string[], count: number): string[] {
  const byWeekday = WEEKDAY_NAMES.map(() => [] as string[]);
  for (const day of [...new Set(decided)].sort().reverse()) {
    byWeekday[weekdayFromSqlDate(day)].push(day);
  }
  const picked: string[] = [];
  for (let round = 0; picked.length < count; round++) {
    const takenBefore = picked.length;
    for (const days of byWeekday) {
      if (picked.length < count && days[round]) picked.push(days[round]);
    }
    if (picked.length === takenBefore) break;
  }
  return picked.sort();
}

/** Score one day's ranking against what was eaten and rejected. */
export function scoreDay(
  truth: BacktestDay,
  built: BuiltSnapshot,
  generation: Generation,
): DayRecord {
  const { snapshot, idByCode, nameById } = built;
  const candidateIds = new Set(idByCode.values());
  const rankById = new Map(generation.ranking.map((row, i) => [row.id, i + 1]));
  const nameOf = (id: string) => nameById.get(id) ?? id;

  const picks = truth.picks.map((pick) => ({
    name: pick.name,
    rank: rankById.get(pick.optionId) ?? null,
    candidate: candidateIds.has(pick.optionId),
  }));
  const ranks = picks.flatMap((pick) => (pick.rank === null ? [] : [pick.rank]));
  const bestRank = ranks.length > 0 ? Math.min(...ranks) : null;
  // A candidate Pick the model left unranked is a miss, not unscorable.
  const scorable = generation.ok && picks.some((pick) => pick.candidate);
  const within = (n: number) => bestRank !== null && bestRank <= n;

  const tooSoonMisses = truth.rejections.flatMap((rejection) => {
    const rank = rankById.get(rejection.optionId);
    return rank !== undefined &&
      rank <= 5 &&
      /\btoo\s+(?:soon|recent)|\bjust had\b/i.test(rejection.reason ?? "")
      ? [{ rank, name: rejection.name, reason: rejection.reason! }]
      : [];
  });

  // The model-facing record of each candidate, for the Pick's timing.
  const optionByCode = new Map(snapshot.options.map((o) => [o.id, o]));
  const modelOption = new Map<string, SnapshotModelOption>();
  for (const [code, id] of idByCode) {
    const option = optionByCode.get(code);
    if (option) modelOption.set(id, option);
  }

  const ranking = generation.ranking.map((row, i) => ({
    rank: i + 1,
    name: nameOf(row.id),
    reason: row.reason,
  }));
  const top10 = generation.ranking.slice(0, 10);

  const pickTiming = truth.picks
    .filter((pick) => candidateIds.has(pick.optionId))
    .map((pick) => ({
      name: pick.name,
      daysSinceLast: modelOption.get(pick.optionId)?.daysSinceLast ?? null,
      ...(modelOption.get(pick.optionId)?.recentGaps
        ? { recentGaps: modelOption.get(pick.optionId)!.recentGaps }
        : {}),
    }));

  const codeById = new Map([...idByCode].map(([code, id]) => [id, code]));
  const positions = generation.ranking.map((row) => codeIndex(codeById.get(row.id) ?? ""));
  const catalogOrder =
    positions.length >= 10 && positions.every((n, i) => i === 0 || n > positions[i - 1]);

  const record: DayRecord = {
    day: truth.day,
    weekday: weekdayName(truth.day),
    dayNote: truth.dayNote,
    ok: generation.ok,
    candidates: idByCode.size,
    picks,
    bestRank,
    scorable,
    hit3: scorable && within(3),
    hit5: scorable && within(5),
    hit10: scorable && within(10),
    pickTiming,
    tooSoonMisses,
    emptyTop10: top10.filter((row) => row.reason.trim() === "").length,
    catalogOrder,
    ranking,
    latencyMs: generation.latencyMs,
    outputTokens: generation.outputTokens,
  };

  if (generation.brief !== undefined) record.brief = generation.brief;
  return record;
}

/** The aggregate over a run's scorable days. */
export function summarize(records: DayRecord[]) {
  const scored = records.filter((record) => record.scorable);
  const ranks = scored
    .map((record) => record.bestRank ?? record.candidates + 1)
    .sort((a, b) => a - b);
  const count = (pick: (record: DayRecord) => boolean) =>
    records.filter(pick).length;
  const sum = (of: (record: DayRecord) => number | undefined) =>
    records.reduce((n, r) => n + (of(r) ?? 0), 0);
  // Eaten in the window: Picked on any of the run's days.
  const eaten = new Set(records.flatMap((r) => r.picks.map((p) => p.name)));
  // A Pick eaten sooner than any of its recent gaps: the Household went
  // quicker than its own pace, and a ranking that reads the gaps as a floor
  // would miss it.
  const underInterval = (r: DayRecord) =>
    (r.pickTiming ?? []).some(
      (p) =>
        p.daysSinceLast !== null &&
        p.recentGaps !== undefined &&
        p.recentGaps.length > 0 &&
        p.daysSinceLast < Math.min(...p.recentGaps),
    );
  return {
    days: records.length,
    scored: scored.length,
    unscorable: records.filter((record) => !record.scorable).map((r) => r.day),
    meanRank:
      ranks.length > 0
        ? Number((ranks.reduce((a, b) => a + b, 0) / ranks.length).toFixed(1))
        : null,
    medianRank: ranks.length > 0 ? ranks[Math.floor((ranks.length - 1) / 2)] : null,
    hit3: count((r) => r.hit3),
    hit5: count((r) => r.hit5),
    hit10: count((r) => r.hit10),
    daysWithTooSoonMiss: count((r) => r.tooSoonMisses.length > 0),
    /** Days the Pick came sooner than its shortest recent gap, and how many of those were hit@5. */
    pickUnderIntervalDays: count((r) => r.scorable && underInterval(r)),
    pickUnderIntervalHit5: count((r) => r.scorable && underInterval(r) && r.hit5),
    // Over scored days only, so it reads against `scored * 5`.
    neverEatenTop5Slots: sum((r) =>
      r.scorable
        ? r.ranking.slice(0, 5).filter((row) => !eaten.has(row.name)).length
        : 0,
    ),
    emptyTop10Rows: sum((r) => r.emptyTop10),
    catalogOrderDays: count((r) => r.catalogOrder === true),
    /** Prepared notes scored on their rows alone: the model skipped the brief. */
    briefSkippedDays: count((r) => r.brief === ""),
  };
}

/** The backtest flags, parsed from argv. */
export type BacktestArgs = {
  days?: string[];
  /** Days the sample skips; ignored with `--days`. */
  exclude: string[];
  count: number;
  windowDays: number;
  jsonPath?: string;
  resume: boolean;
};

export function parseBacktestArgs(args: string[], defaultJsonPath: string): BacktestArgs {
  const value = (name: string) =>
    args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const dayList = (name: string) => {
    const days = value(name)
      ?.split(",")
      .map((day) => day.trim())
      .filter((day) => day !== "");
    const invalid = days?.filter((day) => !isValidSqlDate(day)) ?? [];
    if (invalid.length > 0) {
      console.error(`--${name} must be YYYY-MM-DD, got ${invalid.join(", ")}`);
      process.exit(1);
    }
    return days;
  };
  const positive = (name: string, fallback: number) => {
    const raw = value(name);
    const n = Number(raw ?? fallback);
    if (!Number.isInteger(n) || n < 1) {
      console.error(`--${name} must be a positive integer, got ${raw}`);
      process.exit(1);
    }
    return n;
  };
  const jsonArg = args.find((arg) => arg === "--json" || arg.startsWith("--json="));
  return {
    days: dayList("days"),
    exclude: dayList("exclude") ?? [],
    count: positive("count", DEFAULT_COUNT),
    windowDays: positive("window", DEFAULT_WINDOW_DAYS),
    jsonPath: jsonArg ? (jsonArg.includes("=") ? jsonArg.slice(7) : defaultJsonPath) : undefined,
    resume: args.includes("--resume"),
  };
}

/** The ground truth for each day, from the Log, Rejections, and Day notes. */
async function loadTruth(days: string[]): Promise<Map<string, BacktestDay>> {
  const [log, rejections, dayNotes] = await Promise.all([
    getLog(),
    getLogRejections(),
    getDayNotes(),
  ]);
  return new Map(
    days.map((day) => [
      day,
      {
        day,
        picks: log
          .filter((entry) => entry.eatenOn === day)
          .map((entry) => ({ optionId: entry.optionId, name: entry.optionName })),
        rejections: rejections
          .filter((row) => row.rejectedOn === day)
          .map((row) => ({
            optionId: row.optionId,
            name: row.optionName,
            reason: row.reason,
          })),
        dayNote: dayNotes.find((note) => note.notedOn === day)?.note ?? null,
      },
    ]),
  );
}

/**
 * Run `generate` over the backtest days, printing each as it lands and
 * rewriting the `--json` file after every day, so a long Strata run is
 * readable while it runs and survives being stopped (`--resume`).
 */
export async function runBacktest(opts: {
  args: BacktestArgs;
  /** Model, prompt version, mode — recorded in the JSON and the header. */
  meta: Record<string, string>;
  generate: (built: BuiltSnapshot) => Promise<Generation>;
  /** Save each day's reasoning trace beside the JSON. */
  saveReasoning?: boolean;
}): Promise<void> {
  const { args, meta, generate } = opts;
  const lastDay = shiftSqlDate(today(), -1);
  const firstDay = shiftSqlDate(today(), -args.windowDays);
  const excluded = new Set(args.exclude);
  const days =
    args.days ??
    sampleAcrossWeekdays(
      (await getDecidedDates(firstDay, lastDay)).filter((day) => !excluded.has(day)),
      args.count,
    );
  const truth = await loadTruth(days);

  const header = {
    ...meta,
    window: args.days
      ? "fixed day list"
      : `${firstDay} – ${lastDay}${excluded.size > 0 ? `, ${excluded.size} days excluded` : ""}`,
    catalog: "read as it is now: Options archived, added, or re-tagged since a day are off",
    days: days.join(","),
  };
  for (const [key, value] of Object.entries(header)) console.log(`${key}: ${value}`);
  console.log("");

  const records: DayRecord[] = [];
  if (args.resume && args.jsonPath && existsSync(args.jsonPath)) {
    const previous = JSON.parse(readFileSync(args.jsonPath, "utf8")) as {
      results: DayRecord[];
    };
    records.push(...previous.results.filter((r) => r.ok && days.includes(r.day)));
    console.log(`resuming: ${records.length} day(s) already in ${args.jsonPath}\n`);
  }

  const reasoningDir = args.jsonPath?.replace(/\.json$/, "") + "-reasoning";
  const writeJson = () => {
    if (!args.jsonPath) return;
    mkdirSync(dirname(args.jsonPath), { recursive: true });
    const results = [...records].sort((a, b) => a.day.localeCompare(b.day));
    writeFileSync(
      args.jsonPath,
      JSON.stringify(
        {
          meta: header,
          inProgress: records.length < days.length,
          aggregate: summarize(results),
          results,
        },
        null,
        2,
      ) + "\n",
    );
  };

  for (const day of days) {
    if (records.some((record) => record.day === day)) continue;
    console.log(`→ ${day} (${weekdayName(day)}) …`);
    const built = await snapshotForDay({ asOf: day, query: "", backtest: true });
    const generation = await generate(built);
    const record = scoreDay(truth.get(day)!, built, generation);
    records.push(record);
    printDay(record);
    if (opts.saveReasoning && args.jsonPath && generation.reasoning) {
      mkdirSync(reasoningDir, { recursive: true });
      writeFileSync(`${reasoningDir}/${day}.txt`, generation.reasoning);
    }
    writeJson();
  }

  records.sort((a, b) => a.day.localeCompare(b.day));
  printTable(records);
  printAggregate(summarize(records));
  writeJson();
  if (args.jsonPath) console.log(`\nrecorded → ${args.jsonPath}`);
}

function rankCell(rank: number | null): string {
  return rank === null ? "—" : `#${rank}`;
}

/**
 * A Pick's timing as "4 (gaps 7,5,6,8)": daysSinceLast, "new" when never
 * eaten, then its recent gaps newest first when it has any.
 */
function timingCell(record: DayRecord): string {
  return (record.pickTiming ?? [])
    .map(
      (p) =>
        `${p.daysSinceLast ?? "new"}` +
        (p.recentGaps?.length ? ` (gaps ${p.recentGaps.join(",")})` : ""),
    )
    .join(" ");
}

function printDay(record: DayRecord): void {
  const secs =
    record.latencyMs !== undefined ? `${(record.latencyMs / 1000).toFixed(0)}s` : "—";
  const picks = record.picks
    .map((p) => `${p.name} ${p.candidate ? rankCell(p.rank) : "(not a candidate)"}`)
    .join(", ");
  const timing = timingCell(record);
  console.log(
    `=== ${record.day} (${record.weekday}) — ${record.ok ? `ate ${picks}` : "UNAVAILABLE"}` +
      `${timing ? ` — since ${timing}` : ""} — ${secs}`,
  );
  if (record.dayNote) console.log(`day note: ${record.dayNote}`);
  if (record.catalogOrder) console.log("CATALOG ORDER: the ranking is the snapshot's code order");
  if (record.emptyTop10) console.log(`empty reasons in the top 10: ${record.emptyTop10}`);
  if (record.brief !== undefined) {
    console.log(`brief: ${record.brief || "(SKIPPED by the model — rows scored anyway)"}`);
  }
  for (const row of record.ranking.slice(0, 10)) {
    console.log(`${String(row.rank).padStart(2)}. ${row.name}`);
    console.log(`    ${row.reason}`);
  }
  for (const miss of record.tooSoonMisses) {
    console.log(`TOO-SOON MISS: ${miss.name} #${miss.rank} — rejected "${miss.reason}"`);
  }
  console.log("");
}

function printTable(records: DayRecord[]): void {
  console.log("--- per day ---");
  console.log(
    "day         wkday  rank  since/int  @3 @5 @10  too-soon  empty  pick",
  );
  for (const r of records) {
    const mark = (hit: boolean) => (r.scorable ? (hit ? " ✓" : " ·") : "  ");
    console.log(
      [
        r.day,
        r.weekday.slice(0, 3).padEnd(5),
        (r.scorable ? rankCell(r.bestRank) : "n/a").padStart(4),
        timingCell(r).padStart(10),
        ` ${mark(r.hit3)} ${mark(r.hit5)} ${mark(r.hit10)} `,
        String(r.tooSoonMisses.length).padStart(8),
        String(r.emptyTop10 ?? 0).padStart(6),
        ` ${r.picks.map((p) => p.name).join(" + ")}${r.catalogOrder ? "  CATALOG ORDER" : ""}`,
      ].join(" "),
    );
  }
}

function printAggregate(summary: ReturnType<typeof summarize>): void {
  const pct = (n: number) =>
    summary.scored > 0 ? `${n}/${summary.scored} (${Math.round((n / summary.scored) * 100)}%)` : "—";
  console.log("\n--- aggregate ---");
  console.log(`days: ${summary.days}   scored: ${summary.scored}`);
  if (summary.unscorable.length > 0) {
    console.log(`unscorable (no candidate Pick, or the run failed): ${summary.unscorable.join(", ")}`);
  }
  console.log(`rank of the Pick: mean ${summary.meanRank ?? "—"}   median ${summary.medianRank ?? "—"}`);
  console.log(`hit@3 ${pct(summary.hit3)}   hit@5 ${pct(summary.hit5)}   hit@10 ${pct(summary.hit10)}`);
  console.log(`days with a too-soon Rejection in the top 5: ${summary.daysWithTooSoonMiss}`);
  console.log(
    `Pick sooner than its shortest recent gap: ${summary.pickUnderIntervalDays} day(s), ` +
      `${summary.pickUnderIntervalHit5} of them hit@5`,
  );
  console.log(
    `top-5 slots on Options never eaten in the window: ${summary.neverEatenTop5Slots}/${summary.scored * 5}   ` +
      `empty top-10 reasons: ${summary.emptyTop10Rows}   ` +
      `catalog-order days: ${summary.catalogOrderDays}`,
  );
  console.log(`brief skipped (rows scored anyway): ${summary.briefSkippedDays} day(s)`);
}
