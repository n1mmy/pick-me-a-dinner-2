/**
 * TypeSafe's Jev as a reader of a stored **Prepared note** — an experiment,
 * not wired into the app. `scripts/backtest/typesafe-eval.ts` has Jev rank; this has
 * it judge: for each row of a night's note, is the AI rationale reasonable
 * for that Option on that evening? Jev answers typed questions about the row
 * (its line beside the Option's facts), and code turns the answers into
 * flags (`flagRow`), the way the Prepared note prompt's rules read
 * (`RATIONALE_RULES`, `CONTEXT.md` "AI rationale").
 *
 * One request per night — two when a night's rows would run the request
 * near its 64k-token limit — over every row the note ranks
 * among the day's candidates. Each row asks, with the line and what the judgment needs of
 * the Option's facts inside the question so nothing is looked up:
 *
 *   - statesTiming   — does the line say how long it has been?
 *   - timingMatches  — does that length of time match the facts?
 *                      (read only when statesTiming says yes)
 *   - statesStretch  — does the line say how long they usually leave it?
 *   - stretchMatches — does that usual stretch match the recent gaps?
 *                      (read only when statesStretch says yes)
 *   - contradicts    — does the line state something the facts contradict?
 *   - snapshotTerms  — does it carry the snapshot's own terms (a field name,
 *                      a code, a tag as written, a list of numbers, a date)?
 *   - stance         — for tonight, against tonight, or neither (a Choice),
 *                      set against the row's rank in code
 *   - dayNoteConflict — does it go against the evening's Day note?
 *                      (asked only when the evening has one)
 *
 * Two code checks ride along as a yardstick for the judge, no call needed:
 * the compare script's leak regexes against `snapshotTerms`, and the count
 * written in the line against the Option's and its Tags' days since last,
 * against `timingMatches`. The report ends with both agreement tables.
 *
 *   npx tsx scripts/backtest/typesafe-judge.ts --dry-run --day=2026-10-22      # no call
 *   npx tsx scripts/backtest/typesafe-judge.ts --run --day=2026-10-22
 *   npx tsx scripts/backtest/typesafe-judge.ts --run --all --resume
 *
 * `--run` writes `scripts/backtest-runs/jev-1.14.0-judge.json` (`--json=path`
 * for another) and each day's exact request and response beside it
 * (`-reasoning/<day>.txt`), so any answer can be resent. `--all` is every
 * decided past date with a stored note; `--resume` skips days the file has.
 *
 * Billed per input token: state the call count and get approval first
 * (`CLAUDE.md`). `TYPESAFE_API_KEY`, `DATABASE_URL` and `APP_TZ` come from
 * `.env.local` then `.env`.
 */
import "../load-env";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { and, isNotNull, lt } from "drizzle-orm";
import { db } from "../../db";
import { getDecidedDates, getPreparedNote } from "../../db/queries";
import { preparedNotes } from "../../db/schema";
import type { AiRankingRow } from "../../lib/ai-search";
import { epochDayFromSqlDate, isValidSqlDate, today, weekdayName } from "../../lib/local-day";
import { type BuiltSnapshot, snapshotForDay } from "../../lib/snapshot";

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const MODEL = "jev-1.14.0";
const DEFAULT_JSON_PATH = `scripts/backtest-runs/${MODEL}-judge.json`;
/**
 * The most a request may run to, in characters, against the 64k-token request
 * limit: a night past it is asked in two requests. Jev reads this JSON at
 * about 3 characters a token (the 90-day run's longest night, 192k
 * characters, was billed 62.9k tokens), so this is about 49k tokens.
 */
const MAX_REQUEST_CHARS = 150_000;

/** How far back the evening's recent dinners reach: the last week. */
const RECENT_DAYS = 7;
/** How many of the Option's own Notes, and of its Rejections, a row carries, newest first. */
const RECENT_NOTES = 3;
const RECENT_REJECTIONS = 5;

/** A Noul at or above this reads as yes, at or below `NO` as no; between, unsettled. */
export const YES = 0.7;
export const NO = 0.3;
/** A row this high is a pick whose line should argue for it; past `TAIL` it should not. */
const TOP = 5;
const TAIL = 10;

// ---------------------------------------------------------------------------
// The questions, in one place. Bump on any change to the wording.
// ---------------------------------------------------------------------------

export const JUDGE_VERSION = "4";

const NOULS = {
  statesTiming: {
    instructions:
      "Does `line` say how long it has been since the Household last had `option`, or last had its kind of food?",
    criteria: {
      true: "The line gives a length of time since they last had it or its kind of food: a number of days or weeks, a word like yesterday or a fortnight, or that they have never had it",
      false: "The line gives no length of time since they last had it",
    },
  },
  timingMatches: {
    instructions:
      "Does the length of time `line` says has passed match `option.daysSinceLast`, or one of the figures in `option.daysSinceEachTagWasHad`?",
    criteria: {
      true: "The line's figure is one of those counts, or a rounded way of saying it, such as about two weeks for 13 days; or the line says they have never had it and `option.neverEaten` is true",
      false: "The line's figure is none of those counts, or it says they had it when `option.neverEaten` is true",
    },
  },
  statesStretch: {
    instructions:
      "Does `line` say how long the Household usually leaves between turns of `option`, or of its kind of food?",
    criteria: {
      true: "The line gives a usual gap, pace, range or stretch between turns, in days or weeks",
      false: "The line gives no usual gap; a count of days since the last time, on its own, is not one",
    },
  },
  stretchMatches: {
    instructions:
      "Does the usual stretch `line` gives match `option.recentGaps`, or one of the lists in `option.recentGapsOfEachTag`?",
    criteria: {
      true: "The stretch it gives is one of those gaps, lies within their range, or is a rounded way of saying them",
      false: "It gives a figure or range none of those gaps show, or it gives a stretch when there are no gaps to read",
    },
  },
  // v2 asked this as a Noul and a statement the facts did not cover ("Korean
  // was four days ago via Kukje") read as a contradiction as often as not; v3
  // asked a three-way Choice (borne out / contradicted / not covered) as the
  // citation-check cookbook does, and flagged twice as many rows, most of them
  // borne out. v4 is the Noul again, with "not covered" named in its false
  // criterion and the Tags' last dinners in the facts, and the stretch claim —
  // the one kind of invented figure seen most — asked on its own above.
  contradicts: {
    instructions: "Does `line` state something about `option` that the facts given for it contradict?",
    criteria: {
      true: "The line says the Household had it, turned it down, wrote something about it, or that it is a kind of thing, and the facts show otherwise",
      false: "Everything the line states about the Option is in its facts, is something the facts do not speak to, or is the writer's own judgment",
    },
  },
  // v1 asked the reverse, "Is `line` written the way one person in the
  // Household would say it to another?", and read nearly every line as no
  // (0.06–0.26 on a night with no leak at all): the lines are notes about the
  // household, not talk between them. v2 asks the observable thing.
  snapshotTerms: {
    instructions: "Does `line` carry any of the data record's own terms?",
    criteria: {
      true: "The line contains a field name such as daysSinceLast, a one- or two-letter Option code, a tag written exactly as `option.tags` writes it, the word tag or tagged itself, a list of numbers, or a calendar date",
      false: "The line is in plain words about the food, the people and the evening, with none of those",
    },
  },
  dayNoteConflict: {
    instructions: "Does `line` go against what `todayDayNote` says about this evening?",
    criteria: {
      true: "The line proposes something the Day note rules out, or reads the evening differently from the note",
      false: "The line fits the evening the Day note describes, or does not touch on it",
    },
  },
} as const;

const STANCE = {
  instructions: "What does `line` say about having `option` this evening?",
  criteria: {
    for_tonight: "It gives reasons to have this Option this evening",
    against_tonight: "It says what keeps this Option below the rows above it, or why it is not the one this evening",
    neither: "It describes the Option without arguing for or against it this evening",
  },
} as const;

type NoulName = keyof typeof NOULS;
export type Stance = keyof typeof STANCE.criteria;

// ---------------------------------------------------------------------------
// The judgments combined in code.
// ---------------------------------------------------------------------------

/** One row's answers, read out of the response. */
export type RowAnswers = {
  statesTiming: number;
  timingMatches: number;
  statesStretch: number;
  stretchMatches: number;
  contradicts: number;
  snapshotTerms: number;
  stance: Record<Stance, number>;
  /** Absent when the evening has no Day note. */
  dayNoteConflict?: number;
};

export const FLAGS = [
  "wrong timing",
  "wrong stretch",
  "contradicts the facts",
  "snapshot's words",
  "against the Day note",
  "top row argues against",
  "tail row argues for",
] as const;
export type Flag = (typeof FLAGS)[number];

/**
 * A row's flags, and which of its judgments landed between the thresholds.
 * `timingMatches` and `stretchMatches` are read only when the line gives a
 * time or a stretch at all; the stance
 * is read against the rank: a line in the top rows should not argue against
 * its Option, and one in the tail should not argue for it.
 */
export function flagRow(rank: number, a: RowAnswers): { flags: Flag[]; unsettled: string[] } {
  const flags: Flag[] = [];
  const unsettled: string[] = [];
  const between = (p: number) => p > NO && p < YES;

  if (a.statesTiming >= YES) {
    if (a.timingMatches <= NO) flags.push("wrong timing");
    else if (between(a.timingMatches)) unsettled.push("timing");
  } else if (between(a.statesTiming)) unsettled.push("states timing");

  if (a.statesStretch >= YES) {
    if (a.stretchMatches <= NO) flags.push("wrong stretch");
    else if (between(a.stretchMatches)) unsettled.push("stretch");
  } else if (between(a.statesStretch)) unsettled.push("states stretch");

  if (a.contradicts >= YES) flags.push("contradicts the facts");
  else if (between(a.contradicts)) unsettled.push("contradicts");

  if (a.snapshotTerms >= YES) flags.push("snapshot's words");
  else if (between(a.snapshotTerms)) unsettled.push("words");

  if (a.dayNoteConflict !== undefined) {
    if (a.dayNoteConflict >= YES) flags.push("against the Day note");
    else if (between(a.dayNoteConflict)) unsettled.push("Day note");
  }

  if (rank <= TOP && a.stance.against_tonight >= YES) flags.push("top row argues against");
  if (rank > TAIL && a.stance.for_tonight >= YES) flags.push("tail row argues for");

  return { flags, unsettled };
}

// ---------------------------------------------------------------------------
// Two code checks, as a yardstick for the judge (the compare script's
// counters, `scripts/backtest/backtest-compare.ts`, in short).
// ---------------------------------------------------------------------------

const GAP_LIST = /\b\d+\s*(?:,\s*\d+){2,}\b/;
const LOG_DATE = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b|\b\d{1,2}\/\d{1,2}\b|\b\d{4}-\d{2}-\d{2}\b/i;
const SNAPSHOT_WORD = /\b(?:tags?|tagged|daysSinceLast|recentGaps|otherOptions|dayNote)\b/;
const CODE_WORD = /(?<![\w'’.])(?!A\b|I\b)[A-Z]{1,2}(?![\w'’.&-])/;

/** Whether the line carries the snapshot's own terms by the compare script's regexes. */
export function leaksSnapshot(line: string): boolean {
  return GAP_LIST.test(line) || LOG_DATE.test(line) || SNAPSHOT_WORD.test(line) || CODE_WORD.test(line);
}

const DAY_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90, hundred: 100,
};
const WORD = Object.keys(DAY_WORDS).join("|");
/** A figure or a number in words, compound ("thirty-one", "one hundred twenty") included. */
const NUMBER = `(?:\\d+|(?:${WORD})(?:[- ](?:and[- ])?(?:${WORD}))*)`;
const COUNT = new RegExp(
  `\\b(${NUMBER})(?:\\s+(?:and\\s+a\\s+half|or\\s+so|odd|plus|\\+))?[- ]?(days?|weeks?|nights?)\\b`,
  "gi",
);

/** "thirty-one" → 31, "one hundred twenty" → 120, "15" → 15; `undefined` for anything else. */
function numberOf(text: string): number | undefined {
  if (/^\d+$/.test(text)) return Number(text);
  let total = 0;
  for (const word of text.toLowerCase().split(/[- ]/)) {
    if (word === "and") continue;
    const n = DAY_WORDS[word];
    if (n === undefined) return undefined;
    if (n === 100) total = Math.max(total, 1) * 100;
    else total += n;
  }
  return total;
}

/**
 * The day counts a line states: "15 days" → 15; "two weeks" → 13, 14, 15
 * (a week is said loosely); "yesterday" → 1; "a fortnight" → 13–15. Empty
 * when the line gives no count.
 */
export function countsInLine(line: string): number[] {
  const out: number[] = [];
  for (const m of line.matchAll(COUNT)) {
    const n = numberOf(m[1]);
    if (n === undefined) continue;
    if (/^week/i.test(m[2])) out.push(n * 7 - 1, n * 7, n * 7 + 1);
    else out.push(n);
  }
  if (/\byesterday\b|\blast night\b/i.test(line)) out.push(1);
  if (/\bfortnight\b/i.test(line)) out.push(13, 14, 15);
  return out;
}

/**
 * Whether any count the line states is within a day of a fact — the
 * Option's days since last or one of its Tags'. `null` when the line
 * states no count, so there is nothing to check.
 */
export function countMatchesFacts(counts: number[], facts: number[]): boolean | null {
  if (counts.length === 0) return null;
  return counts.some((c) => facts.some((f) => Math.abs(c - f) <= 1));
}

// ---------------------------------------------------------------------------
// The request: the evening as state, each row as its own questions.
// ---------------------------------------------------------------------------

type OptionFacts = {
  name: string;
  kind: "home" | "restaurant";
  tags: string[];
  notes?: string;
  closedDays?: string[];
  timesEaten: number;
  daysSinceLast?: number;
  neverEaten?: true;
  recentGaps?: number[];
  daysSinceEachTagWasHad: Record<string, number | null>;
  /** Each Tag's recent gaps, for a stretch the line gives for the kind of food. */
  recentGapsOfEachTag: Record<string, number[] | null>;
  /** The most recent past dinner carrying each Tag, so a line naming where a Tag was last had can be checked. */
  lastDinnerOfEachTag: Record<string, { daysAgo: number; option: string } | null>;
  notesOnItsDinners?: { daysAgo: number; note: string }[];
  rejections?: { daysAgo: number; reason: string | null }[];
};

export type JudgedRow = {
  rank: number;
  code: string;
  name: string;
  line: string;
  option: OptionFacts;
};

/** The note's rows among the day's candidates, each with its Option's facts. */
export function noteRows(built: BuiltSnapshot, ranking: AiRankingRow[]): JudgedRow[] {
  const { snapshot, idByCode } = built;
  const codeById = new Map([...idByCode].map(([code, id]) => [id, code]));
  const optionByCode = new Map(snapshot.options.map((option) => [option.id, option]));
  const todayEpoch = epochDayFromSqlDate(snapshot.today.slice(0, 10));
  const daysAgo = (date: string) => todayEpoch - epochDayFromSqlDate(date.slice(0, 10));

  // Only today's candidates hold a place, as `backtest-stored.ts` scores them.
  const rows = ranking.filter((row) => codeById.has(row.id));
  return rows.map((row, i) => {
    const code = codeById.get(row.id)!;
    const option = optionByCode.get(code)!;
    const notes = snapshot.log
      .filter((entry) => entry.optionId === code && entry.note && daysAgo(entry.date) >= 1)
      .slice(0, RECENT_NOTES)
      .map((entry) => ({ daysAgo: daysAgo(entry.date), note: entry.note! }));
    const rejections = snapshot.rejections.notTodayRejections
      .filter((rejection) => rejection.optionId === code && daysAgo(rejection.date) >= 1)
      .slice(0, RECENT_REJECTIONS)
      .map((rejection) => ({ daysAgo: daysAgo(rejection.date), reason: rejection.reason }));
    const facts: OptionFacts = {
      name: option.name,
      kind: option.kind,
      tags: option.tags,
      ...(option.notes ? { notes: option.notes } : {}),
      ...(option.closedDays ? { closedDays: option.closedDays } : {}),
      timesEaten: option.eaten,
      ...(option.daysSinceLast !== undefined ? { daysSinceLast: option.daysSinceLast } : { neverEaten: true }),
      ...(option.recentGaps ? { recentGaps: option.recentGaps } : {}),
      daysSinceEachTagWasHad: Object.fromEntries(
        option.tags.map((tag) => [tag, snapshot.tags[tag]?.daysSinceLast ?? null]),
      ),
      recentGapsOfEachTag: Object.fromEntries(
        option.tags.map((tag) => [tag, snapshot.tags[tag]?.recentGaps ?? null]),
      ),
      lastDinnerOfEachTag: Object.fromEntries(
        option.tags.map((tag) => {
          const last = snapshot.log.find((entry) => daysAgo(entry.date) >= 1 && !entry.shortlist && entry.tags.includes(tag));
          return [tag, last ? { daysAgo: daysAgo(last.date), option: last.name } : null];
        }),
      ),
      ...(notes.length > 0 ? { notesOnItsDinners: notes } : {}),
      ...(rejections.length > 0 ? { rejections } : {}),
    };
    return { rank: i + 1, code, name: option.name, line: row.reason, option: facts };
  });
}

/** The evening every question shares. */
export function jevJudgeState({ snapshot }: BuiltSnapshot, rowCount: number) {
  const todayEpoch = epochDayFromSqlDate(snapshot.today.slice(0, 10));
  const daysAgo = (date: string) => todayEpoch - epochDayFromSqlDate(date.slice(0, 10));
  return {
    evening: weekdayName(snapshot.today.slice(0, 10)),
    todayDayNote: snapshot.todayDayNote,
    dinnersInTheLastWeek: snapshot.log
      .filter((entry) => daysAgo(entry.date) >= 1 && daysAgo(entry.date) <= RECENT_DAYS)
      .map((entry) => ({ daysAgo: daysAgo(entry.date), option: entry.name, ...(entry.note ? { note: entry.note } : {}) })),
    rowsInTheRanking: rowCount,
  };
}

/** The question id for one row and one judgment. */
const questionId = (code: string, name: string) => `${code}_${name}`;

/**
 * What each judgment reads of the row, inside its own question so nothing is
 * looked up in a shared list — and no more than it needs: the full facts go
 * only to the two questions that check the line against them, so a field
 * added for one judgment cannot sway another (and a night stays well inside
 * the request limit).
 */
function subjectFor(name: NoulName | "stance", row: JudgedRow, total: number) {
  const { option, line } = row;
  const named = { name: option.name };
  switch (name) {
    case "timingMatches":
      return {
        option: {
          ...named,
          ...(option.daysSinceLast !== undefined ? { daysSinceLast: option.daysSinceLast } : { neverEaten: true }),
          daysSinceEachTagWasHad: option.daysSinceEachTagWasHad,
        },
        line,
      };
    case "stretchMatches":
      return {
        option: {
          ...named,
          ...(option.recentGaps ? { recentGaps: option.recentGaps } : { recentGaps: [] }),
          recentGapsOfEachTag: option.recentGapsOfEachTag,
        },
        line,
      };
    case "contradicts":
      return { option, line };
    case "snapshotTerms":
      return { option: { ...named, tags: option.tags }, line };
    case "stance":
      return { option: named, rank: `${row.rank} of ${total}`, line };
    default:
      return { option: named, line };
  }
}

/** The night's request: the evening as state, and every row's questions. */
export function jevJudgeRequest(built: BuiltSnapshot, rows: JudgedRow[]) {
  const state = jevJudgeState(built, rows.length);
  const questions: Record<string, unknown> = {};
  for (const row of rows) {
    for (const [name, noul] of Object.entries(NOULS) as [NoulName, (typeof NOULS)[NoulName]][]) {
      if (name === "dayNoteConflict" && state.todayDayNote === null) continue;
      questions[questionId(row.code, name)] = {
        type: "noul",
        instructions: { question: noul.instructions, ...subjectFor(name, row, rows.length) },
        criteria: noul.criteria,
      };
    }
    questions[questionId(row.code, "stance")] = {
      type: "choice",
      instructions: { question: STANCE.instructions, ...subjectFor("stance", row, rows.length) },
      criteria: STANCE.criteria,
    };
  }
  return { model: MODEL, state, questions };
}

// ---------------------------------------------------------------------------
// The call, and reading its answers.
// ---------------------------------------------------------------------------

type JevAnswer =
  | { type: "noul"; noul: number }
  | { type: "choice"; choice: string; confidence: number; probabilities: Record<string, number> };

type JevResponse = {
  model: string;
  answers: Record<string, JevAnswer>;
  usage: { input_tokens: number; output_tokens: number };
};

type JevCall =
  | { ok: true; request: unknown; response: JevResponse; latencyMs: number }
  | { ok: false; request: unknown; error: string };

async function askJev(apiKey: string, request: ReturnType<typeof jevJudgeRequest>): Promise<JevCall> {
  const started = Date.now();
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(180_000),
    });
    const body = await res.text();
    if (!res.ok) return { ok: false, request, error: `HTTP ${res.status}: ${body}` };
    const response = JSON.parse(body) as JevResponse;
    // A missing answer is a failed call, never a probability of 0.
    const missing = Object.keys(request.questions).filter((name) => !response.answers?.[name]);
    if (missing.length > 0) {
      return { ok: false, request, error: `no answer to ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}` };
    }
    return { ok: true, request, response, latencyMs: Date.now() - started };
  } catch (error) {
    return { ok: false, request, error: String(error) };
  }
}

/** One row's answers out of the response, by its question ids. */
export function readRowAnswers(
  answers: Record<string, JevAnswer>,
  code: string,
  hasDayNote: boolean,
): RowAnswers {
  const noul = (name: NoulName) => {
    const answer = answers[questionId(code, name)];
    if (answer?.type !== "noul") throw new Error(`no noul for ${questionId(code, name)}`);
    return answer.noul;
  };
  const stance = answers[questionId(code, "stance")];
  if (stance?.type !== "choice") throw new Error(`no choice for ${questionId(code, "stance")}`);
  return {
    statesTiming: noul("statesTiming"),
    timingMatches: noul("timingMatches"),
    statesStretch: noul("statesStretch"),
    stretchMatches: noul("stretchMatches"),
    contradicts: noul("contradicts"),
    snapshotTerms: noul("snapshotTerms"),
    stance: {
      for_tonight: stance.probabilities.for_tonight ?? 0,
      against_tonight: stance.probabilities.against_tonight ?? 0,
      neither: stance.probabilities.neither ?? 0,
    },
    ...(hasDayNote ? { dayNoteConflict: noul("dayNoteConflict") } : {}),
  };
}

// ---------------------------------------------------------------------------
// The run file and the report.
// ---------------------------------------------------------------------------

export type RowRecord = {
  rank: number;
  name: string;
  line: string;
  answers: RowAnswers;
  flags: Flag[];
  unsettled: string[];
  /** The compare script's leak regexes on the line. */
  codeLeak: boolean;
  /** The line's count against the facts — `null` with no count to check. */
  codeCountMatches: boolean | null;
};

export type DayJudgement = {
  day: string;
  weekday: string;
  dayNote: string | null;
  ok: boolean;
  error?: string;
  rows: RowRecord[];
  inputTokens?: number;
  latencyMs?: number;
};

type RunFile = {
  meta: { judge: string; model: string; questionsVersion: string; days: string[] };
  days: DayJudgement[];
};

/**
 * The night's rows in as few requests as fit `MAX_REQUEST_CHARS`: one, or an
 * even split into two or more. Every request carries the same state.
 */
export function requestBatches(built: BuiltSnapshot, rows: JudgedRow[]): ReturnType<typeof jevJudgeRequest>[] {
  const whole = jevJudgeRequest(built, rows);
  const parts = Math.ceil(JSON.stringify(whole).length / MAX_REQUEST_CHARS);
  if (parts <= 1) return [whole];
  const size = Math.ceil(rows.length / parts);
  const batches: ReturnType<typeof jevJudgeRequest>[] = [];
  for (let i = 0; i < rows.length; i += size) {
    // The rank out of the whole ranking stays on each row: the batch is a
    // transport, not a shorter list.
    batches.push({ ...jevJudgeRequest(built, rows.slice(i, i + size)), state: whole.state });
  }
  return batches;
}

/** Judge the stored note for `day`; the rows come back scored, or the day failed. */
async function judgeDay(apiKey: string, day: string): Promise<DayJudgement> {
  const built = await snapshotForDay({ asOf: day, query: "", backtest: true });
  const weekday = weekdayName(day);
  const note = await getPreparedNote(day);
  if (note === null) return { day, weekday, dayNote: built.snapshot.todayDayNote, ok: false, error: "no stored note", rows: [] };
  const rows = noteRows(built, note.ranking);
  const calls: JevCall[] = [];
  for (const request of requestBatches(built, rows)) calls.push(await askJev(apiKey, request));
  const dayNote = built.snapshot.todayDayNote;
  const base = { day, weekday, dayNote };
  const reasoning = JSON.stringify(
    calls.map((call) => (call.ok ? { request: call.request, response: call.response } : call)),
    null,
    2,
  );
  saveReasoning(day, reasoning);
  const failed = calls.find((call) => !call.ok);
  if (failed && !failed.ok) return { ...base, ok: false, error: failed.error, rows: [] };
  const answers: Record<string, JevAnswer> = {};
  let inputTokens = 0;
  let latencyMs = 0;
  for (const call of calls) {
    if (!call.ok) continue;
    Object.assign(answers, call.response.answers);
    inputTokens += call.response.usage.input_tokens;
    latencyMs += call.latencyMs;
  }

  const records: RowRecord[] = rows.map((row) => {
    const rowAnswers = readRowAnswers(answers, row.code, dayNote !== null);
    const facts = [
      ...(row.option.daysSinceLast !== undefined ? [row.option.daysSinceLast] : []),
      ...Object.values(row.option.daysSinceEachTagWasHad).filter((n): n is number => n !== null),
    ];
    return {
      rank: row.rank,
      name: row.name,
      line: row.line,
      answers: rowAnswers,
      ...flagRow(row.rank, rowAnswers),
      codeLeak: leaksSnapshot(row.line),
      codeCountMatches: countMatchesFacts(countsInLine(row.line), facts),
    };
  });
  return { ...base, ok: true, rows: records, inputTokens, latencyMs };
}

let jsonPath = DEFAULT_JSON_PATH;

function saveReasoning(day: string, text: string): void {
  const dir = jsonPath.replace(/\.json$/, "") + "-reasoning";
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${day}.txt`, text);
}

const pct = (n: number, of: number) => (of === 0 ? "n/a" : `${((100 * n) / of).toFixed(1)}%`);
const p = (n: number) => n.toFixed(2);

/** One day's report: the counts, then every flagged row for the eye. */
function printDay(judged: DayJudgement): void {
  const head = `${judged.day} (${judged.weekday.slice(0, 3)})`;
  if (!judged.ok) {
    console.log(`${head}  failed: ${judged.error}`);
    return;
  }
  const flagged = judged.rows.filter((row) => row.flags.length > 0);
  const top10 = flagged.filter((row) => row.rank <= 10).length;
  const unsettled = judged.rows.filter((row) => row.unsettled.length > 0).length;
  console.log(
    `${head}  ${judged.rows.length} rows, ${flagged.length} flagged (${top10} in the top 10), ` +
      `${unsettled} unsettled; ${((judged.inputTokens ?? 0) / 1000).toFixed(1)}k input tokens, ` +
      `${((judged.latencyMs ?? 0) / 1000).toFixed(1)}s` +
      (judged.dayNote ? `\n  Day note: ${judged.dayNote}` : ""),
  );
  for (const row of flagged) {
    const a = row.answers;
    const readout =
      `timing ${p(a.statesTiming)}→${p(a.timingMatches)}, stretch ${p(a.statesStretch)}→${p(a.stretchMatches)}, ` +
      `contradicts ${p(a.contradicts)}, ` +
      `terms ${p(a.snapshotTerms)}, for/against ${p(a.stance.for_tonight)}/${p(a.stance.against_tonight)}` +
      (a.dayNoteConflict !== undefined ? `, Day note ${p(a.dayNoteConflict)}` : "");
    console.log(`  #${row.rank} ${row.name} — ${row.flags.join(", ")} [${readout}]\n     ${row.line}`);
  }
}

/** The run's totals and the two agreement tables. */
function printTotals(days: DayJudgement[]): void {
  const done = days.filter((day) => day.ok);
  const rows = done.flatMap((day) => day.rows);
  const flagged = rows.filter((row) => row.flags.length > 0);
  console.log(`\n${done.length} of ${days.length} days judged, ${rows.length} rows`);
  console.log(
    `flagged rows ${flagged.length} (${pct(flagged.length, rows.length)}), ` +
      `in the top 10: ${flagged.filter((row) => row.rank <= 10).length} of ${rows.filter((row) => row.rank <= 10).length}; ` +
      `rows with an unsettled judgment ${rows.filter((row) => row.unsettled.length > 0).length}`,
  );
  for (const flag of FLAGS) {
    const n = rows.filter((row) => row.flags.includes(flag)).length;
    console.log(`  ${flag.padEnd(24)} ${n}`);
  }
  const tokens = done.reduce((sum, day) => sum + (day.inputTokens ?? 0), 0);
  console.log(`input tokens ${tokens.toLocaleString()} (~$${((tokens / 1e6) * 0.042).toFixed(3)})`);

  const words = (jev: boolean, code: boolean) =>
    rows.filter((row) => row.flags.includes("snapshot's words") === jev && row.codeLeak === code).length;
  console.log(
    `\nWords — Jev's "snapshot's words" against the leak regexes: ` +
      `both ${words(true, true)}, Jev only ${words(true, false)}, regexes only ${words(false, true)}, neither ${words(false, false)}`,
  );
  const counted = rows.filter((row) => row.codeCountMatches !== null);
  const timing = (jev: boolean, code: boolean) =>
    counted.filter((row) => row.flags.includes("wrong timing") === jev && row.codeCountMatches === !code).length;
  console.log(
    `Timing — on ${counted.length} rows whose line gives a count, Jev's "wrong timing" against the count check: ` +
      `both wrong ${timing(true, true)}, Jev only ${timing(true, false)}, code only ${timing(false, true)}, both fine ${timing(false, false)}`,
  );
  const disagreements = rows.filter(
    (row) =>
      row.flags.includes("snapshot's words") !== row.codeLeak ||
      (row.codeCountMatches !== null && row.flags.includes("wrong timing") === row.codeCountMatches),
  );
  if (disagreements.length > 0) {
    console.log(`\nWhere the judge and the code checks disagree (${disagreements.length}):`);
    for (const row of disagreements.slice(0, 40)) {
      const day = done.find((d) => d.rows.includes(row))!;
      console.log(
        `  ${day.day} #${row.rank} ${row.name} — terms ${p(row.answers.snapshotTerms)} / leak ${row.codeLeak}, ` +
          `timing ${p(row.answers.statesTiming)}→${p(row.answers.timingMatches)} / count ${row.codeCountMatches}\n     ${row.line}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Entry.
// ---------------------------------------------------------------------------

/** Every decided past date with a stored note, as `backtest-stored.ts` lists them. */
async function allNotedDays(): Promise<string[]> {
  const noted = (
    await db
      .select({ day: preparedNotes.preparedFor })
      .from(preparedNotes)
      .where(and(isNotNull(preparedNotes.brief), lt(preparedNotes.preparedFor, today())))
  ).map((row) => row.day);
  if (noted.length === 0) return [];
  const decided = new Set(await getDecidedDates(noted.sort()[0], today()));
  return noted.filter((day) => decided.has(day)).sort();
}

async function dryRun(day: string): Promise<void> {
  const built = await snapshotForDay({ asOf: day, query: "", backtest: true });
  const note = await getPreparedNote(day);
  if (note === null) {
    console.error(`no stored Prepared note for ${day}`);
    process.exit(1);
  }
  const rows = noteRows(built, note.ranking);
  const request = jevJudgeRequest(built, rows);
  const chars = JSON.stringify(request).length;
  const stateChars = JSON.stringify(request.state).length;
  const names = Object.keys(request.questions);
  const batches = requestBatches(built, rows).length;
  console.log(`day: ${built.snapshot.today}   model: ${MODEL}   questions v${JUDGE_VERSION}   note by ${note.model}`);
  console.log(`rows: ${rows.length} of ${note.ranking.length} in the note   questions: ${names.length}   requests: ${batches}`);
  console.log(`request: ${chars} chars (~${Math.round(chars / 4)} tokens); state alone ${stateChars} chars (~${Math.round(stateChars / 4)} tokens)`);
  console.log(`\nstate:\n${JSON.stringify(request.state, null, 2)}`);
  const [first] = rows;
  console.log(`\nfirst row's questions:`);
  for (const name of names.filter((n) => n.startsWith(`${first.code}_`))) {
    console.log(`${name}: ${JSON.stringify(request.questions[name])}`);
  }
  if (process.argv.includes("--print-rows")) {
    for (const row of rows) console.log(`#${row.rank} ${row.name}: ${row.line}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const value = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const listed = value("days")?.split(",").map((d) => d.trim()).filter(Boolean) ?? (value("day") ? [value("day")!] : undefined);
  const invalid = listed?.filter((d) => !isValidSqlDate(d)) ?? [];
  if (invalid.length > 0) {
    console.error(`days must be YYYY-MM-DD, got ${invalid.join(", ")}`);
    process.exit(1);
  }

  if (args.includes("--dry-run")) {
    if (listed?.length !== 1) {
      console.error("--dry-run needs --day=YYYY-MM-DD");
      process.exit(1);
    }
    await dryRun(listed[0]);
    return;
  }
  if (!args.includes("--run")) {
    console.error("Pass --run (billed) with --day=, --days= or --all; or --dry-run --day=YYYY-MM-DD (no call).");
    process.exit(1);
  }
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    console.error("TYPESAFE_API_KEY is not set — add it to .env.local.");
    process.exit(1);
  }
  const days = args.includes("--all") ? await allNotedDays() : listed;
  if (!days || days.length === 0) {
    console.error("--run needs --day=, --days= or --all.");
    process.exit(1);
  }
  jsonPath = value("json") ?? DEFAULT_JSON_PATH;

  let previous: DayJudgement[] = [];
  if (args.includes("--resume") && existsSync(jsonPath)) {
    previous = (JSON.parse(readFileSync(jsonPath, "utf8")) as RunFile).days.filter((d) => d.ok && days.includes(d.day));
    console.log(`resuming: ${previous.length} days already in ${jsonPath}`);
  }
  const judged = [...previous];
  const save = () => {
    judged.sort((a, b) => a.day.localeCompare(b.day));
    const file: RunFile = {
      meta: { judge: "TypeSafe", model: MODEL, questionsVersion: JUDGE_VERSION, days: judged.map((d) => d.day) },
      days: judged,
    };
    mkdirSync(dirname(jsonPath), { recursive: true });
    writeFileSync(jsonPath, JSON.stringify(file, null, 2));
  };
  const done = new Set(previous.map((d) => d.day));
  for (const day of days) {
    if (done.has(day)) continue;
    const result = await judgeDay(apiKey, day);
    judged.push(result);
    printDay(result);
    save();
  }
  printTotals(judged);
  console.log(`\nwritten: ${jsonPath}`);
}

if (process.argv[1]?.endsWith("typesafe-judge.ts")) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("TypeSafe judge failed.");
      console.error(error);
      process.exit(1);
    });
}
