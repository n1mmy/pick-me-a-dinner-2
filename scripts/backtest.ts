/**
 * The AI ranking backtest, shared by `scripts/prepared-note-eval.ts` (Strata)
 * and `scripts/ai-search-eval.ts` (Claude): run a ranker against recent
 * **decided** days, each built as the Household saw it before deciding
 * (`snapshotForDay`'s backtest mode), and score the ranking against what was
 * actually eaten that day.
 *
 * Per day and in aggregate: the rank of the Pick, hit@3/5/10, the Pick's
 * daysSinceLast over its Interval, any Option Rejected that day as too soon
 * that sat in the top 5, top-5 slots spent on Options never eaten in the
 * window, empty top-10 reasons, and a ranking written in snapshot-number
 * order (rank positions where numbers belong). Prepared notes add the brief's
 * consistency — the Options it names sit in the top 3, and it mentions the Day
 * note when there is one — and rows the parser had to resolve by name. Flags
 * are for a reader, not verdicts: elapsed-time phrasing, weekday-habit claims
 * printed next to that Option's weekday counts, and top-10 rationales that
 * say nothing but timing. Every flag counts over the brief and the top 10.
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
  type SnapshotModelOption,
  snapshotForDay,
} from "../lib/snapshot";

const DEFAULT_COUNT = 20;
const DEFAULT_WINDOW_DAYS = 60;

/**
 * Phrases that usually break the rhythm-claim rule (`CONTEXT.md`: **AI
 * rationale**) — a date, a day or week count, a month, a vague "it has been a
 * while", or a relative "last week" / "just had" / "this past Sunday". A flag
 * to read, not a verdict: "every two weeks" is fine and still matches.
 */
export const RHYTHM_CLAIM_SUSPECTS =
  /\b\d{1,2}\/\d{1,2}\b|\b\d+\s+(?:[Dd]ays?|[Ww]eeks?|[Mm]onths?)\b|\b(?:days?|weeks?|months?)\s+ago\b|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b|\b(?:a while|long gap)\b|\b[Ll]ast (?:week|night|weekend)\b|\b[Jj]ust (?:had|ate|eaten|been)\b|\b[Tt]his past (?:Sun|Mon|Tues|Wednes|Thurs|Fri|Satur)day\b|\b(?:after|eaten) (?:last )?(?:Sun|Mon|Tues|Wednes|Thurs|Fri|Satur)day\b/g;

/** A weekday named in a rationale — "Tuesday", "Fridays". */
const WEEKDAY_CLAIM = /\b(?:Sun|Mon|Tues|Wednes|Thurs|Fri|Satur)days?\b/;

/** Timing words: a sentence carrying one talks about cadence or recency. */
const CADENCE_WORDS =
  /\b(?:interval|stretch|cadence|rhythm|due|overdue|gap|spacing|spaced|rotation|usual|usually|recent|recently|lately|ready|again|every|since|soon|weeks?|days?|fortnight|turn|repeat)\b/i;

/** Too common to show a rationale drew on the Household's own words. */
const STOPWORDS = new Set(
  "about after again also always another around because been before being better could dinner does doesn't each even every first from going good great have having into just keep like make more much night only other over really should since some still than that their them then there these they thing this those tonight usual usually very well were what when which while where will with would your week weeks".split(
    " ",
  ),
);

/** A ≥4-letter word, lowercased, not a stopword or timing word. */
function contentWords(text: string): Set<string> {
  return new Set(
    (text.toLowerCase().match(/[a-z][a-z']{3,}/g) ?? []).filter(
      (word) => !STOPWORDS.has(word) && !CADENCE_WORDS.test(word),
    ),
  );
}

/**
 * The words of a Day note worth finding in the brief: three letters up, so
 * "No Jen" is read by "jen" (`contentWords` starts at four and missed it).
 */
function noteWords(text: string): Set<string> {
  return new Set(
    (text.toLowerCase().match(/[a-z][a-z']{2,}/g) ?? []).filter(
      (word) => !STOPWORDS.has(word),
    ),
  );
}

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
  /** Prepared notes: rows the parser resolved by name over the number. */
  resolvedByName?: number;
};

type Ranked = { rank: number; name: string };

/** One day's score and flags — one record in the `--json` file. */
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
  /** Each candidate Pick's daysSinceLast over its Interval, from the snapshot. */
  pickTiming: { name: string; daysSinceLast: number | null; intervalDays: number | null }[];
  /** Options Rejected that day as too soon, ranked in the top 5. */
  tooSoonMisses: (Ranked & { reason: string })[];
  /** Top-10 rows with an empty reason. */
  emptyTop10: number;
  /**
   * The whole ranking came out in snapshot-number order: the model wrote its
   * rank positions where the numbers belong, and the "ranking" is the Catalog.
   */
  catalogOrder: boolean;
  /** Prepared notes: rows the parser resolved by name over the number. */
  resolvedByName?: number;
  brief?: string;
  /** Options the brief names — each should be in the top 3. */
  briefNamed?: Ranked[];
  /** With a Day note: whether the brief shares a word with it (read it). */
  briefMentionsDayNote?: boolean;
  flags: {
    elapsed: { where: string; text: string }[];
    weekdayClaims: (Ranked & { weekdays: Record<string, number>; reason: string })[];
    timingOnly: (Ranked & { reason: string })[];
  };
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
  const { snapshot, idByIndex, nameById } = built;
  const candidateIds = new Set(idByIndex.values());
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

  // The model-facing record of each candidate, for its weekday counts and the
  // Household's words about it.
  const optionByNumber = new Map(snapshot.options.map((o) => [o.id, o]));
  const modelOption = new Map<string, SnapshotModelOption>();
  for (const [number, id] of idByIndex) {
    const option = optionByNumber.get(number);
    if (option) modelOption.set(id, option);
  }
  const householdWords = (id: string): Set<string> => {
    const option = modelOption.get(id);
    if (!option) return new Set();
    const texts = [
      option.notes ?? "",
      ...option.tags,
      ...snapshot.log
        .filter((entry) => entry.optionId === option.id)
        .map((entry) => entry.note ?? ""),
      ...snapshot.rejections.notTodayRejections
        .filter((row) => row.optionId === option.id)
        .map((row) => row.reason ?? ""),
      snapshot.todayDayNote ?? "",
    ];
    return contentWords(texts.join(" "));
  };

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
      intervalDays: modelOption.get(pick.optionId)?.intervalDays ?? null,
    }));

  const numberById = new Map([...idByIndex].map(([number, id]) => [id, number]));
  const numbers = generation.ranking.map((row) => numberById.get(row.id) ?? 0);
  const catalogOrder =
    numbers.length >= 10 && numbers.every((n, i) => i === 0 || n > numbers[i - 1]);

  const elapsed = [
    ...(generation.brief !== undefined
      ? [{ where: "brief", text: generation.brief }]
      : []),
    ...ranking.slice(0, 10).map((row) => ({ where: `#${row.rank}`, text: row.reason })),
  ].flatMap(({ where, text }) =>
    (text.match(RHYTHM_CLAIM_SUSPECTS) ?? []).map((match) => ({ where, text: match })),
  );

  const weekdayClaims = top10.flatMap((row, i) =>
    WEEKDAY_CLAIM.test(row.reason)
      ? [
          {
            rank: i + 1,
            name: nameOf(row.id),
            weekdays: modelOption.get(row.id)?.weekdays ?? {},
            reason: row.reason,
          },
        ]
      : [],
  );

  const timingOnly = top10.flatMap((row, i) => {
    const sentences = row.reason
      .split(/(?<=[.!?])\s+/)
      .filter((sentence) => sentence.trim() !== "");
    const allTiming =
      sentences.length > 0 && sentences.every((s) => CADENCE_WORDS.test(s));
    const words = householdWords(row.id);
    const sourced =
      WEEKDAY_CLAIM.test(row.reason) ||
      /["“”]/.test(row.reason) ||
      [...contentWords(row.reason)].some((word) => words.has(word));
    return allTiming && !sourced
      ? [{ rank: i + 1, name: nameOf(row.id), reason: row.reason }]
      : [];
  });

  const record: DayRecord = {
    day: truth.day,
    weekday: weekdayName(truth.day),
    dayNote: truth.dayNote,
    ok: generation.ok,
    candidates: idByIndex.size,
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
    flags: { elapsed, weekdayClaims, timingOnly },
    ranking,
    latencyMs: generation.latencyMs,
    outputTokens: generation.outputTokens,
  };
  if (generation.resolvedByName !== undefined) {
    record.resolvedByName = generation.resolvedByName;
  }

  if (generation.brief !== undefined) {
    record.brief = generation.brief;
    record.briefNamed = namedInBrief(generation.brief, built).map((id) => ({
      rank: rankById.get(id) ?? 0,
      name: nameOf(id),
    }));
    if (truth.dayNote) {
      const wanted = noteWords(truth.dayNote);
      record.briefMentionsDayNote = [...noteWords(generation.brief)].some((word) =>
        wanted.has(word),
      );
    }
  }
  return record;
}

/** The capitalised words of five letters or more in a name ("Societea", "Ninja", "Stone's"). */
function nameWords(name: string): string[] {
  return name.match(/[A-Z][\w'’.-]{4,}/g) ?? [];
}

/**
 * The candidates a brief names: by full name, case-insensitively, or by a
 * capitalised word of five letters or more that appears in no other
 * candidate's name. Any word of the name, not just the first, and unique
 * across every name: the first-word rule matched "Chicken" in "bb.q Chicken
 * San Bruno" to Chicken and Rice.
 */
function namedInBrief(brief: string, built: BuiltSnapshot): string[] {
  const candidates = [...built.idByIndex.values()].map((id) => ({
    id,
    name: built.nameById.get(id) ?? "",
  }));
  const namesWithWord = new Map<string, number>();
  for (const { name } of candidates) {
    for (const word of new Set(nameWords(name))) {
      namesWithWord.set(word, (namesWithWord.get(word) ?? 0) + 1);
    }
  }
  const lower = brief.toLowerCase();
  return candidates
    .filter(({ name }) => {
      if (name !== "" && lower.includes(name.toLowerCase())) return true;
      return nameWords(name).some(
        (word) =>
          namesWithWord.get(word) === 1 &&
          new RegExp(`\\b${word.replace(/[^\w]/g, "\\$&")}\\b`).test(brief),
      );
    })
    .map(({ id }) => id);
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
  const underInterval = (r: DayRecord) =>
    (r.pickTiming ?? []).some(
      (p) => p.daysSinceLast !== null && p.intervalDays !== null && p.daysSinceLast < p.intervalDays,
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
    /** Days the Pick was short of its Interval, and how many of those were hit@5. */
    pickUnderIntervalDays: count((r) => r.scorable && underInterval(r)),
    pickUnderIntervalHit5: count((r) => r.scorable && underInterval(r) && r.hit5),
    neverEatenTop5Slots: sum(
      (r) => r.ranking.slice(0, 5).filter((row) => !eaten.has(row.name)).length,
    ),
    emptyTop10Rows: sum((r) => r.emptyTop10),
    catalogOrderDays: count((r) => r.catalogOrder === true),
    rowsResolvedByName: sum((r) => r.resolvedByName),
    briefNamedOutsideTop3: count(
      (r) => (r.briefNamed ?? []).some((named) => named.rank === 0 || named.rank > 3),
    ),
    briefMissingDayNote: count((r) => r.briefMentionsDayNote === false),
    /** Prepared notes scored on their rows alone: the model skipped the brief. */
    briefSkippedDays: count((r) => r.brief === ""),
    elapsedSuspects: sum((r) => r.flags.elapsed.length),
    weekdayClaims: sum((r) => r.flags.weekdayClaims.length),
    timingOnlyTopRows: sum((r) => r.flags.timingOnly.length),
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
  const jsonArg = args.find((arg) => arg === "--json" || arg.startsWith("--json="));
  return {
    days: dayList("days"),
    exclude: dayList("exclude") ?? [],
    count: Number(value("count") ?? DEFAULT_COUNT),
    windowDays: Number(value("window") ?? DEFAULT_WINDOW_DAYS),
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

/** A Pick's timing as "4/6": daysSinceLast over its Interval, "—" where absent. */
function timingCell(record: DayRecord): string {
  return (record.pickTiming ?? [])
    .map((p) => `${p.daysSinceLast ?? "new"}/${p.intervalDays ?? "—"}`)
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
      `${timing ? ` — since/Interval ${timing}` : ""} — ${secs}`,
  );
  if (record.dayNote) console.log(`day note: ${record.dayNote}`);
  if (record.catalogOrder) console.log("CATALOG ORDER: the ranking is the snapshot's numbering");
  if (record.resolvedByName) console.log(`rows resolved by name: ${record.resolvedByName}`);
  if (record.emptyTop10) console.log(`empty reasons in the top 10: ${record.emptyTop10}`);
  if (record.brief !== undefined) {
    console.log(`brief: ${record.brief || "(SKIPPED by the model — rows scored anyway)"}`);
    const named = (record.briefNamed ?? [])
      .map((n) => `${n.name} ${n.rank ? `#${n.rank}` : "unranked"}`)
      .join(", ");
    console.log(`brief names: ${named || "none found"}`);
    if (record.briefMentionsDayNote === false) {
      console.log("brief: shares no word with the Day note — read it");
    }
  }
  for (const row of record.ranking.slice(0, 10)) {
    console.log(`${String(row.rank).padStart(2)}. ${row.name}`);
    console.log(`    ${row.reason}`);
  }
  for (const miss of record.tooSoonMisses) {
    console.log(`TOO-SOON MISS: ${miss.name} #${miss.rank} — rejected "${miss.reason}"`);
  }
  for (const claim of record.flags.weekdayClaims) {
    const counts = Object.entries(claim.weekdays)
      .map(([weekday, n]) => `${weekday.slice(0, 3)} ${n}`)
      .join(" ");
    console.log(`weekday claim: #${claim.rank} ${claim.name} [${counts || "never eaten"}]`);
  }
  for (const row of record.flags.timingOnly) {
    console.log(`timing-only: #${row.rank} ${row.name}`);
  }
  if (record.flags.elapsed.length > 0) {
    console.log(
      `elapsed-time suspects: ${record.flags.elapsed.map((e) => `${e.where} "${e.text}"`).join(" · ")}`,
    );
  }
  console.log("");
}

function printTable(records: DayRecord[]): void {
  console.log("--- per day ---");
  console.log(
    "day         wkday  rank  since/int  @3 @5 @10  too-soon  empty  wkday  timing  elapsed  pick",
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
        String(r.flags.weekdayClaims.length).padStart(6),
        String(r.flags.timingOnly.length).padStart(7),
        String(r.flags.elapsed.length).padStart(8),
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
    `Pick short of its Interval: ${summary.pickUnderIntervalDays} day(s), ` +
      `${summary.pickUnderIntervalHit5} of them hit@5`,
  );
  console.log(
    `top-5 slots on Options never eaten in the window: ${summary.neverEatenTop5Slots}/${summary.scored * 5}   ` +
      `empty top-10 reasons: ${summary.emptyTop10Rows}   ` +
      `catalog-order days: ${summary.catalogOrderDays}   ` +
      `rows resolved by name: ${summary.rowsResolvedByName}`,
  );
  console.log(
    `brief names an Option outside the top 3: ${summary.briefNamedOutsideTop3} day(s)   ` +
      `brief silent on the Day note: ${summary.briefMissingDayNote} day(s)   ` +
      `brief skipped (rows scored anyway): ${summary.briefSkippedDays} day(s)`,
  );
  console.log(
    `flags over the brief and top 10 — elapsed-time suspects ${summary.elapsedSuspects}   ` +
      `weekday claims ${summary.weekdayClaims}   ` +
      `timing-only rows ${summary.timingOnlyTopRows}`,
  );
}
