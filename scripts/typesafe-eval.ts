/**
 * TypeSafe's Jev as a ranker in the AI ranking backtest (`scripts/backtest.ts`)
 * — an experiment, not wired into the app. Jev answers typed questions and
 * writes no prose, so this ranks only: there is no rationale and no brief.
 *
 * One request per day, over the day's snapshot as JSON without its Option
 * codes, asks two shapes at once, and each is scored as its own arm:
 *
 *   - noul   — one yes/no per candidate, "Will the Household eat X …?",
 *              ranked by the probability of yes;
 *   - choice — one Choice across every candidate, in an order shuffled by
 *              the date, ranked by its probabilities.
 *
 * `--state=2` sends `jevStateByOption` instead: the same facts with no dates,
 * arranged under each Option's name. `--state=3` (`jevStateLean`) is state 1
 * with no repeated copies; `--state=4` (`jevStateLeanByOption`) adds each
 * candidate's own dinners and Rejections under its name, Log kept;
 * `--state=5` (`jevStateLeanByOptionTaggedLog`) puts the Tags back on each
 * Log row; `--state=6` (`jevStateWithOptionHistory`) is state 1 whole plus
 * each candidate's history, and needs `--long-context`, which sends the
 * header that lifts the 32k-a-question limit to 262k; `--state=7`
 * (`jevStateWithOptionAndTagHistory`) adds each Tag's dinners and, under
 * each candidate, the days since each of its Tags was had.
 *
 * `--judgments` adds five more Nouls per candidate (`JUDGMENTS`: too soon,
 * ruled out, pointed at by the Day note, due, regular), saved with the rest
 * for `scripts/typesafe-rerank.ts` to combine in code; the two arms scored
 * here are unchanged by them. `--judgments=2` (`JUDGMENTS_V2`) writes the
 * Option's Rejections and the Day note into the ruled-out and pointed-at
 * questions instead of leaving them to be looked up in the state.
 *
 *   npx tsx scripts/typesafe-eval.ts --dry-run --day=2026-10-22   # no call
 *   npx tsx scripts/typesafe-eval.ts --backtest --days=2026-10-22 --json
 *   npx tsx scripts/typesafe-eval.ts --backtest --days=<meta.days> --json
 *
 * `--json[=path]` writes `<path>-noul.json` and `<path>-choice.json`, with
 * each day's exact request and response beside them (`-reasoning/<day>.txt`)
 * so any answer can be resent. `--repeat=N` adds `-r1` … `-rN`.
 *
 * Billed per input token (the state is read once per request): state the
 * call count and get approval first (`CLAUDE.md`). `TYPESAFE_API_KEY`,
 * `DATABASE_URL` and `APP_TZ` come from `.env.local` then `.env`.
 */
import "./load-env";
import { epochDayFromSqlDate, isValidSqlDate, weekdayName } from "../lib/local-day";
import { type BuiltSnapshot, snapshotForDay } from "../lib/snapshot";
import { type Generation, parseBacktestArgs, runBacktest } from "./backtest";

export const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
export const MODEL = "jev-1.14.0";
const ARMS = ["noul", "choice"] as const;
type Arm = (typeof ARMS)[number];

/** The question wording, in one place. Bump on any change. */
const QUESTIONS_VERSION = "1";
const noulInstructions = (name: string) =>
  `Will the Household eat ${name} for dinner on the evening of \`today\`?`;
const NOUL_CRITERIA = {
  true: "They have this for dinner that evening",
  false: "They have something else for dinner that evening",
};
const CHOICE_INSTRUCTIONS =
  "Which of these will the Household eat for dinner on the evening of `today`?";

/**
 * The judgments (`--judgments`): five more Nouls per candidate, each one
 * thing a person could say of an Option at a glance, for code to combine
 * (`scripts/typesafe-rerank.ts`). They ride in the same request as the Noul
 * and the Choice, so the state is read once. Bump on any change.
 */
const JUDGMENTS: Record<string, (name: string) => { instructions: string; criteria: { true: string; false: string } }> = {
  tooSoon: (name) => ({
    instructions: `Is the evening of \`today\` too soon for the Household to have ${name} again?`,
    criteria: {
      true: `They had ${name}, or another dinner of its cuisine, more recently than they usually leave it, so they would pass on it tonight`,
      false: `Enough time has passed by their usual rhythm for ${name} to be a natural choice tonight, or they have never had it`,
    },
  }),
  ruledOut: (name) => ({
    instructions: `Does a reason on record rule out ${name} for the evening of \`today\`?`,
    criteria: {
      true: `A Rejection of ${name} or the Day note for \`today\` gives a reason that still holds this evening: it is closed, not on hand, someone it is for is away, or the like`,
      false: `No recorded reason stands against ${name} this evening`,
    },
  }),
  pointedAt: (name) => ({
    instructions: `Does the Day note for \`today\` (\`todayDayNote\`) point toward ${name}?`,
    criteria: {
      true: `What the note asks for — a quick dinner, a craving, who is home, an outing nearby — fits ${name} well`,
      false: `The note says nothing that bears on ${name}, asks for something else, or there is no note`,
    },
  }),
  due: (name) => ({
    instructions: `Is ${name} about due by the Household's rhythm on the evening of \`today\`?`,
    criteria: {
      true: `It has been as long as, or longer than, they usually leave between dinners of ${name}`,
      false: `They had ${name} more recently than their usual stretch, or they never have it`,
    },
  }),
  regular: (name) => ({
    instructions: `Is ${name} one of the dinners the Household comes back to?`,
    criteria: {
      true: `They have had ${name} again and again over the Log, as a regular part of their rotation`,
      false: `They have had ${name} rarely or never`,
    },
  }),
};

/**
 * What a judgment reads of the Option when it is written into the question
 * (`--judgments=2`) instead of looked up in the state: its Rejections with
 * their reasons, newest first, as days ago, and the Day note.
 */
export type JudgmentFacts = {
  name: string;
  kind: "home" | "restaurant";
  tags: string[];
  notes?: string;
  closedDays?: string[];
  rejections: { daysAgo: number; reason: string | null }[];
  todayDayNote: string | null;
};

type Judgment = { instructions: string | Record<string, unknown>; criteria: { true: string; false: string } };

/**
 * Judgments v2: `ruledOut` and `pointedAt` carry the facts they judge inside
 * the question — the Option's own Rejections and reasons, and the Day note —
 * the way `typesafe-judge.ts` writes a row's facts into each question; the
 * other three are v1's. One question, one subject, nothing to look up.
 */
const JUDGMENTS_V2: Record<string, (facts: JudgmentFacts) => Judgment> = {
  tooSoon: (f) => JUDGMENTS.tooSoon(f.name),
  ruledOut: (f) => ({
    instructions: {
      question: `Does a reason on record rule out ${f.name} for the evening of \`today\`?`,
      option: {
        name: f.name,
        kind: f.kind,
        ...(f.closedDays ? { closedDays: f.closedDays } : {}),
        rejections: f.rejections,
      },
      todayDayNote: f.todayDayNote,
    },
    criteria: {
      true: `One of the rejections of ${f.name}, or the Day note, gives a reason that still holds this evening: it is closed, not on hand, someone it is for is away, or the like`,
      false: `No recorded reason stands against ${f.name} this evening: its rejections were about their own nights, and the Day note does not touch it`,
    },
  }),
  pointedAt: (f) => ({
    instructions: {
      question: `Does the Day note for \`today\` point toward ${f.name}?`,
      option: { name: f.name, kind: f.kind, tags: f.tags, ...(f.notes ? { notes: f.notes } : {}) },
      todayDayNote: f.todayDayNote,
    },
    criteria: {
      true: `What the note asks for — a quick dinner, a craving, who is home, an outing nearby — fits ${f.name} well`,
      false: `The note says nothing that bears on ${f.name}, asks for something else, or there is no note`,
    },
  }),
  due: (f) => JUDGMENTS.due(f.name),
  regular: (f) => JUDGMENTS.regular(f.name),
};

/** The judgments by version: `--judgments` is v1, `--judgments=2` v2. */
export type JudgmentsVersion = "1" | "2";

/** The facts v2 writes into a candidate's questions. */
export function judgmentFacts(built: BuiltSnapshot, code: string): JudgmentFacts {
  const { snapshot } = built;
  const option = snapshot.options.find((o) => o.id === code)!;
  const todayEpoch = epochDayFromSqlDate(snapshot.today.slice(0, 10));
  const daysAgo = (date: string) => todayEpoch - epochDayFromSqlDate(date.slice(0, 10));
  return {
    name: option.name,
    kind: option.kind,
    tags: option.tags,
    ...(option.notes ? { notes: option.notes } : {}),
    ...(option.closedDays ? { closedDays: option.closedDays } : {}),
    rejections: snapshot.rejections.notTodayRejections
      .filter((rejection) => rejection.optionId === code && daysAgo(rejection.date) >= 1)
      .map((rejection) => ({ daysAgo: daysAgo(rejection.date), reason: rejection.reason })),
    todayDayNote: snapshot.todayDayNote,
  };
}

/**
 * The snapshot as Jev reads it: the same facts the LLM rankers see, with the
 * Option codes taken out — Jev answers by question and option name, so a code
 * is one more thing to look up — and the empty query left off.
 */
export function jevState({ snapshot }: BuiltSnapshot) {
  const nameByCode = new Map<string, string>();
  for (const row of [
    ...snapshot.options.map((option) => ({ optionId: option.id, name: option.name })),
    ...snapshot.log,
    ...snapshot.rejections.rejectedTonight,
    ...snapshot.rejections.notTodayRejections,
  ]) {
    nameByCode.set(row.optionId, row.name);
  }
  const withoutCode = <T extends { optionId: string }>({ optionId, ...row }: T) => {
    void optionId;
    return row;
  };
  return {
    today: snapshot.today,
    options: snapshot.options.map(({ id, ...option }) => {
      void id;
      return option;
    }),
    tags: Object.fromEntries(
      Object.entries(snapshot.tags).map(([tag, { rejections, ...timing }]) => [
        tag,
        rejections
          ? {
              ...timing,
              rejections: rejections.map(({ optionId, ...rejection }) => ({
                name: nameByCode.get(optionId) ?? optionId,
                ...rejection,
              })),
            }
          : timing,
      ]),
    ),
    log: snapshot.log.map(withoutCode),
    rejections: {
      rejectedTonight: snapshot.rejections.rejectedTonight.map(withoutCode),
      notTodayRejections: snapshot.rejections.notTodayRejections.map(withoutCode),
    },
    dayNotes: snapshot.dayNotes,
    todayDayNote: snapshot.todayDayNote,
  };
}

/** How far back state 2's list of recent dinners and Day notes reaches: the last week. */
const RECENT_DAYS = 7;

/**
 * State 2: the same facts arranged for Jev's documented weak spots — dates,
 * arithmetic, long state. No date anywhere: every past event is "N days ago",
 * counted in code, and the count is set against the Option's own recent gaps
 * in code too. Each Option's history sits under its name, so a question
 * reaches it by one path, and the whole Log gives way to the last week's
 * dinners.
 */
export function jevStateByOption({ snapshot }: BuiltSnapshot) {
  const todayEpoch = epochDayFromSqlDate(snapshot.today.slice(0, 10));
  const daysAgo = (date: string) => todayEpoch - epochDayFromSqlDate(date.slice(0, 10));
  const nameByCode = new Map<string, string>();
  for (const row of [
    ...snapshot.options.map((option) => ({ optionId: option.id, name: option.name })),
    ...snapshot.log,
    ...snapshot.rejections.rejectedTonight,
    ...snapshot.rejections.notTodayRejections,
  ]) {
    nameByCode.set(row.optionId, row.name);
  }
  const past = snapshot.log.filter((entry) => daysAgo(entry.date) >= 1);

  const options = Object.fromEntries(
    snapshot.options.map((option) => {
      const gaps = option.recentGaps;
      const since = option.daysSinceLast;
      const notes = past
        .filter((entry) => entry.optionId === option.id && entry.note)
        .map((entry) => ({ daysAgo: daysAgo(entry.date), note: entry.note }));
      const rejections = snapshot.rejections.notTodayRejections
        .filter((rejection) => rejection.optionId === option.id && daysAgo(rejection.date) >= 1)
        .map((rejection) => ({ daysAgo: daysAgo(rejection.date), reason: rejection.reason }));
      return [
        option.name,
        {
          kind: option.kind,
          notes: option.notes,
          ...(option.closedDays ? { closedDays: option.closedDays } : {}),
          timesEaten: option.eaten,
          ...(since !== undefined ? { daysSinceLast: since } : { neverEaten: true }),
          ...(gaps && since !== undefined
            ? {
                recentGaps: gaps,
                soonerThanEveryRecentGap: since < Math.min(...gaps),
                longerThanEveryRecentGap: since > Math.max(...gaps),
              }
            : {}),
          daysSinceEachTagWasHad: Object.fromEntries(
            option.tags.map((tag) => [tag, snapshot.tags[tag]?.daysSinceLast ?? null]),
          ),
          ...(notes.length > 0 ? { notesOnItsDinners: notes } : {}),
          ...(rejections.length > 0 ? { rejections } : {}),
        },
      ];
    }),
  );

  const tagRejections = Object.fromEntries(
    Object.entries(snapshot.tags).flatMap(([tag, { rejections }]) =>
      rejections
        ? [
            [
              tag,
              rejections.map((rejection) => ({
                daysAgo: daysAgo(rejection.date),
                option: nameByCode.get(rejection.optionId) ?? rejection.optionId,
                reason: rejection.reason,
              })),
            ],
          ]
        : [],
    ),
  );

  return {
    today: weekdayName(snapshot.today.slice(0, 10)),
    todayDayNote: snapshot.todayDayNote,
    options,
    rejectionsByTag: tagRejections,
    ...(snapshot.rejections.rejectedTonight.length > 0
      ? {
          rejectedTonight: snapshot.rejections.rejectedTonight.map((rejection) => ({
            option: rejection.name,
            reason: rejection.reason,
          })),
        }
      : {}),
    dinnersInTheLastWeek: past
      .filter((entry) => daysAgo(entry.date) <= RECENT_DAYS)
      .map((entry) => ({ daysAgo: daysAgo(entry.date), option: entry.name, note: entry.note })),
    dayNotesInTheLastWeek: snapshot.dayNotes
      .filter((dayNote) => daysAgo(dayNote.date) >= 1 && daysAgo(dayNote.date) <= RECENT_DAYS)
      .map((dayNote) => ({ daysAgo: daysAgo(dayNote.date), note: dayNote.note })),
  };
}

/**
 * State 3: state 1's facts and arrangement with every repeated copy taken
 * out, as `leanSnapshot` already does for the LLM rankers. A Log or Rejection
 * row keeps its date, the Option's name, and its note or reason; the kind and
 * Tags it repeated sit on the candidate already. The Tags' own Rejection lists
 * go: they are `rejections.notTodayRejections` filed again per Tag. Dates and
 * the whole Log stay, so a run against state 1 reads size alone.
 */
export function jevStateLean(built: BuiltSnapshot) {
  const { snapshot } = built;
  const row = ({ date, name, note, shortlist }: (typeof snapshot.log)[number]) => ({
    date,
    name,
    ...(note ? { note } : {}),
    ...(shortlist ? { shortlist } : {}),
  });
  const rejection = ({ date, name, reason }: (typeof snapshot.rejections.notTodayRejections)[number]) => ({
    date,
    name,
    reason,
  });
  return {
    today: snapshot.today,
    options: snapshot.options.map(({ id, ...option }) => {
      void id;
      return option;
    }),
    tags: Object.fromEntries(
      Object.entries(snapshot.tags).map(([tag, { rejections, ...timing }]) => {
        void rejections;
        return [tag, timing];
      }),
    ),
    log: snapshot.log.map(row),
    rejections: {
      rejectedTonight: snapshot.rejections.rejectedTonight.map(rejection),
      notTodayRejections: snapshot.rejections.notTodayRejections.map(rejection),
    },
    dayNotes: snapshot.dayNotes,
    todayDayNote: snapshot.todayDayNote,
  };
}

/**
 * State 4: state 3 with each candidate's own history under its name as well —
 * its dinners (date and note) and its Rejections (date and reason), newest
 * first — so a Noul about one Option reaches its past in one hop instead of a
 * scan of the Log (state 2's arrangement). Unlike state 2 the whole dated Log
 * stays for the view across Options, and the Rejection list moves under the
 * Options: a Rejection of an Option that is no candidate today is dropped.
 */
export function jevStateLeanByOption(built: BuiltSnapshot) {
  const { snapshot } = built;
  const lean = jevStateLean(built);
  const { rejections, ...rest } = lean;
  const todayDate = snapshot.today.slice(0, 10);
  const options = snapshot.options.map((option) => {
    const dinners = snapshot.log
      .filter((entry) => entry.optionId === option.id && entry.date.slice(0, 10) < todayDate)
      .map(({ date, note }) => ({ date, ...(note ? { note } : {}) }));
    const rejected = snapshot.rejections.notTodayRejections
      .filter((rejection) => rejection.optionId === option.id)
      .map(({ date, reason }) => ({ date, reason }));
    const { id, ...fields } = option;
    void id;
    return {
      ...fields,
      ...(dinners.length > 0 ? { dinners } : {}),
      ...(rejected.length > 0 ? { rejections: rejected } : {}),
    };
  });
  return {
    ...rest,
    options,
    ...(rejections.rejectedTonight.length > 0 ? { rejectedTonight: rejections.rejectedTonight } : {}),
  };
}

/**
 * State 5: state 4 with the Option's Tags back on each Log row. State 3 lost
 * ranking when the rows lost them: with the Tags beside the date, "sushi
 * three days ago" is read off the Log in one hop, which the view across
 * Options — the Choice — needs. The kind stays off the row, and the
 * Rejections stay under the Options.
 */
export function jevStateLeanByOptionTaggedLog(built: BuiltSnapshot) {
  const { snapshot } = built;
  const byOption = jevStateLeanByOption(built);
  return {
    ...byOption,
    log: snapshot.log.map(({ date, name, tags, note, shortlist }) => ({
      date,
      name,
      tags,
      ...(note ? { note } : {}),
      ...(shortlist ? { shortlist } : {}),
    })),
  };
}

/**
 * State 6: state 1 whole — every copy kept — with each candidate's dinners
 * and Rejections under its own name as in state 4. Past the 32k a question
 * may read on the newest days, so it is run with `--long-context`, to see
 * whether the slower mode's documented accuracy cost shows at this size.
 */
export function jevStateWithOptionHistory(built: BuiltSnapshot) {
  const { snapshot } = built;
  const full = jevState(built);
  const todayDate = snapshot.today.slice(0, 10);
  return {
    ...full,
    options: snapshot.options.map((option) => {
      const dinners = snapshot.log
        .filter((entry) => entry.optionId === option.id && entry.date.slice(0, 10) < todayDate)
        .map(({ date, note }) => ({ date, ...(note ? { note } : {}) }));
      const rejected = snapshot.rejections.notTodayRejections
        .filter((rejection) => rejection.optionId === option.id)
        .map(({ date, reason }) => ({ date, reason }));
      const { id, ...fields } = option;
      void id;
      return {
        ...fields,
        ...(dinners.length > 0 ? { dinners } : {}),
        ...(rejected.length > 0 ? { rejections: rejected } : {}),
      };
    }),
  };
}

/**
 * State 7: state 6 with the Tags' history laid out the same way — under each
 * Tag, the dinners that carried it (date and Option), newest first — and
 * under each candidate the days since each of its Tags was had, copied from
 * `tags`. Both put a timing fact one hop from the question that needs it;
 * too-soon Options in the top 5 are where every shape so far is weak.
 * Long context, like state 6.
 */
export function jevStateWithOptionAndTagHistory(built: BuiltSnapshot) {
  const { snapshot } = built;
  const withHistory = jevStateWithOptionHistory(built);
  const todayDate = snapshot.today.slice(0, 10);
  const past = snapshot.log.filter((entry) => entry.date.slice(0, 10) < todayDate);
  return {
    ...withHistory,
    options: withHistory.options.map((option) => ({
      ...option,
      daysSinceEachTagWasHad: Object.fromEntries(
        option.tags.map((tag) => [tag, snapshot.tags[tag]?.daysSinceLast ?? null]),
      ),
    })),
    tags: Object.fromEntries(
      Object.entries(withHistory.tags).map(([tag, facts]) => [
        tag,
        {
          ...facts,
          dinners: past
            .filter((entry) => entry.tags.includes(tag))
            .map(({ date, name }) => ({ date, option: name })),
        },
      ]),
    ),
  };
}

const STATES = {
  "1": jevState,
  "2": jevStateByOption,
  "3": jevStateLean,
  "4": jevStateLeanByOption,
  "5": jevStateLeanByOptionTaggedLog,
  "6": jevStateWithOptionHistory,
  "7": jevStateWithOptionAndTagHistory,
} as const;

/** The header that lifts both context limits to 262k, at the documented cost in speed and accuracy. */
export const LONG_CONTEXT_HEADER = { "TypeSafe-Danger-Zone-Long-Context": "true" };
export type StateVersion = keyof typeof STATES;

/** A Fisher–Yates shuffle seeded by `seed`, so a day's order is the same on every run. */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  let state = [...seed].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);
  const random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The day's request body: a Noul per candidate, keyed by its code, and the Choice. */
export function jevRequest(built: BuiltSnapshot, state: StateVersion, judgments: JudgmentsVersion | false = false) {
  const { snapshot } = built;
  const names = snapshot.options.map((option) => option.name);
  const questions: Record<string, unknown> = {};
  for (const option of snapshot.options) {
    questions[`noul_${option.id}`] = {
      type: "noul",
      instructions: noulInstructions(option.name),
      criteria: NOUL_CRITERIA,
    };
    if (judgments === "1") {
      for (const [judgment, ask] of Object.entries(JUDGMENTS)) {
        questions[`${judgment}_${option.id}`] = { type: "noul", ...ask(option.name) };
      }
    } else if (judgments === "2") {
      const facts = judgmentFacts(built, option.id);
      for (const [judgment, ask] of Object.entries(JUDGMENTS_V2)) {
        questions[`${judgment}_${option.id}`] = { type: "noul", ...ask(facts) };
      }
    }
  }
  questions.choice = {
    type: "choice",
    instructions: CHOICE_INSTRUCTIONS,
    criteria: Object.fromEntries(seededShuffle(names, snapshot.today).map((name) => [name, null])),
  };
  return { model: MODEL, state: STATES[state](built), questions };
}

export type JevAnswer =
  | { type: "noul"; noul: number }
  | { type: "choice"; choice: string; confidence: number; probabilities: Record<string, number> };

export type JevResponse = {
  model: string;
  answers: Record<string, JevAnswer>;
  usage: { input_tokens: number; output_tokens: number };
};

export type JevCall =
  | { ok: true; request: unknown; response: JevResponse; latencyMs: number }
  | { ok: false; request: unknown; error: string };

export async function askJev(
  apiKey: string,
  built: BuiltSnapshot,
  state: StateVersion,
  longContext: boolean,
  judgments: JudgmentsVersion | false,
): Promise<JevCall> {
  return sendJev(apiKey, built, jevRequest(built, state, judgments), longContext);
}

/**
 * Any request over the day's candidates sent to Jev: the answer to every
 * question in it, or a failure — a missing answer is a failed call, never a
 * probability of 0. `scripts/typesafe-stage2.ts` sends its own questions
 * through it.
 */
export async function sendJev(
  apiKey: string,
  built: BuiltSnapshot,
  request: { model: string; state: unknown; questions: Record<string, unknown> },
  longContext: boolean,
): Promise<JevCall> {
  const started = Date.now();
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(longContext ? LONG_CONTEXT_HEADER : {}),
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(120_000),
    });
    const body = await res.text();
    if (!res.ok) return { ok: false, request, error: `HTTP ${res.status}: ${body}` };
    const response = JSON.parse(body) as JevResponse;
    // A missing answer is a failed call, never a probability of 0. A Choice
    // must answer for every name it was asked about.
    const missing = Object.keys(request.questions).filter((name) => !response.answers?.[name]);
    for (const [name, question] of Object.entries(request.questions)) {
      const asked = question as { type: string; criteria?: Record<string, unknown> };
      const answer = response.answers?.[name];
      if (asked.type !== "choice" || !answer) continue;
      if (answer.type !== "choice") {
        missing.push(name);
        continue;
      }
      for (const option of Object.keys(asked.criteria ?? {})) {
        if (answer.probabilities[option] === undefined) missing.push(`${name}[${option}]`);
      }
    }
    if (missing.length > 0) return { ok: false, request, error: `no answer to ${missing.join(", ")}` };
    return { ok: true, request, response, latencyMs: Date.now() - started };
  } catch (error) {
    return { ok: false, request, error: String(error) };
  }
}

/** One arm's ranking out of the day's answers, highest probability first. */
function rankArm(arm: Arm, built: BuiltSnapshot, response: JevResponse): Generation["ranking"] {
  const choice = response.answers.choice as Extract<JevAnswer, { type: "choice" }>;
  return built.snapshot.options
    .map((option) => {
      const noul = response.answers[`noul_${option.id}`] as Extract<JevAnswer, { type: "noul" }>;
      const p = arm === "noul" ? noul.noul : choice.probabilities[option.name];
      return { id: built.idByCode.get(option.id)!, p };
    })
    .sort((a, b) => b.p - a.p)
    .map(({ id, p }) => ({ id, reason: `${arm} ${p.toFixed(3)}` }));
}

function dryRun(day: string, state: StateVersion, judgments: JudgmentsVersion | false): Promise<void> {
  return snapshotForDay({ asOf: day, query: "", backtest: true }).then((built) => {
    const request = jevRequest(built, state, judgments);
    const chars = JSON.stringify(request).length;
    const stateChars = JSON.stringify(request.state).length;
    console.log(`day: ${built.snapshot.today}   model: ${MODEL}   state: ${state}`);
    console.log(`candidates: ${built.snapshot.options.length}   questions: ${Object.keys(request.questions).length}`);
    console.log(`request: ${chars} chars (~${Math.round(chars / 4)} tokens); state alone ${stateChars} chars (~${Math.round(stateChars / 4)} tokens)`);
    const [first] = built.snapshot.options;
    console.log(`\nfirst noul: ${JSON.stringify(request.questions[`noul_${first.id}`])}`);
    for (const judgment of judgments ? Object.keys(JUDGMENTS) : []) {
      console.log(`first ${judgment}: ${JSON.stringify(request.questions[`${judgment}_${first.id}`])}`);
    }
    if (judgments === "2") {
      const rejected = built.snapshot.options.find((o) => judgmentFacts(built, o.id).rejections.length > 0);
      if (rejected) console.log(`a rejected one's ruledOut: ${JSON.stringify(request.questions[`ruledOut_${rejected.id}`])}`);
    }
    console.log(`choice: ${JSON.stringify(request.questions.choice)}`);
    if (process.argv.includes("--print-state")) {
      console.log(`\nstate:\n${JSON.stringify(request.state, null, 2)}`);
    }
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const state = (args.find((a) => a.startsWith("--state="))?.slice(8) ?? "1") as StateVersion;
  const longContext = args.includes("--long-context");
  const judgmentsArg = args.find((a) => a === "--judgments" || a.startsWith("--judgments="));
  const judgments: JudgmentsVersion | false = !judgmentsArg
    ? false
    : judgmentsArg === "--judgments"
      ? "1"
      : (judgmentsArg.slice(12) as JudgmentsVersion);
  if (judgments !== false && judgments !== "1" && judgments !== "2") {
    console.error(`--judgments takes no value or 2, got ${judgmentsArg}`);
    process.exit(1);
  }
  if (!(state in STATES)) {
    console.error(`--state must be ${Object.keys(STATES).join(" or ")}, got ${state}`);
    process.exit(1);
  }

  if (args.includes("--dry-run")) {
    const day = args.find((a) => a.startsWith("--day="))?.slice(6);
    if (!day || !isValidSqlDate(day)) {
      console.error("--dry-run needs --day=YYYY-MM-DD");
      process.exit(1);
    }
    await dryRun(day, state, judgments);
    return;
  }
  if (!args.includes("--backtest")) {
    console.error("Pass --backtest (billed) or --dry-run --day=YYYY-MM-DD (no call).");
    process.exit(1);
  }

  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    console.error("TYPESAFE_API_KEY is not set — add it to .env.local.");
    process.exit(1);
  }

  const parsed = parseBacktestArgs(
    args,
    `scripts/backtest-runs/${MODEL}${state === "1" ? "" : `-s${state}`}.json`,
  );
  for (let i = 1; i <= parsed.repeat; i++) {
    // Both arms read one call per day: the first arm to reach a day makes it.
    // A day the first arm resumed past is called afresh by the second.
    const calls = new Map<string, Promise<JevCall>>();
    const callFor = (built: BuiltSnapshot) => {
      if (!calls.has(built.snapshot.today)) {
        calls.set(built.snapshot.today, askJev(apiKey, built, state, longContext, judgments));
      }
      return calls.get(built.snapshot.today)!;
    };
    for (const arm of ARMS) {
      const suffix = `-${arm}${parsed.repeat > 1 ? `-r${i}` : ""}`;
      await runBacktest({
        args: { ...parsed, repeat: 1, jsonPath: parsed.jsonPath?.replace(/(\.json)?$/, `${suffix}.json`) },
        meta: {
          ranker: `TypeSafe ${arm}`,
          model: MODEL,
          // State 1 runs predate the flag and carry no suffix.
          promptVersion:
            `${arm}-v${QUESTIONS_VERSION}${state === "1" ? "" : `-s${state}`}` +
            `${longContext ? "-long" : ""}${judgments ? `-j${judgments}` : ""}`,
          ...(parsed.repeat > 1 ? { repeat: `${i}/${parsed.repeat}` } : {}),
        },
        saveReasoning: true,
        generate: async (built) => {
          const call = await callFor(built);
          const reasoning = JSON.stringify(call.ok ? { request: call.request, response: call.response } : call, null, 2);
          if (!call.ok) {
            console.error(`TypeSafe call failed: ${call.error}`);
            return { ok: false, ranking: [], reasoning };
          }
          console.log(
            `jev: ${call.response.model}, ${call.response.usage.input_tokens} input tokens, ` +
              `${(call.latencyMs / 1000).toFixed(1)}s`,
          );
          return {
            ok: true,
            ranking: rankArm(arm, built, call.response),
            latencyMs: call.latencyMs,
            reasoning,
          };
        },
      });
    }
  }
}

// Run as a script; imported by `typesafe-stage2.ts` and `typesafe-prospective.ts` for its request and call.
if (process.argv[1]?.endsWith("typesafe-eval.ts")) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("TypeSafe eval failed.");
      console.error(error);
      process.exit(1);
    });
}
