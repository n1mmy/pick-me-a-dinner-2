/**
 * Prepared note evaluation harness — ask the local model (Strata) for one
 * date's Prepared note against the real dev database, without the sweep or
 * the Tonight UI (ADR-0011).
 *
 * This is the iteration loop for `buildPreparedSystemPrompt` and the token
 * budget in `lib/prepared-note.ts`: edit them, re-run this, and read the brief
 * and the ranking. It prints the built prompt, Strata's raw reply, and the
 * parsed note, plus the numbers issue 03 judges a note by — the brief's word
 * count, how many candidates were ranked, why generation stopped — so they
 * don't have to be counted by eye. Nothing is written to `prepared_notes`.
 *
 *   npx tsx scripts/prepared-note-eval.ts               # today
 *   npx tsx scripts/prepared-note-eval.ts --day=+3      # three days ahead
 *   npx tsx scripts/prepared-note-eval.ts --day=2026-10-25
 *   npx tsx scripts/prepared-note-eval.ts --snapshot    # also dump the JSON sent
 *   npx tsx scripts/prepared-note-eval.ts --no-prompt   # skip the system prompt
 *
 * Strata is free to call, so the billed-call rule in `CLAUDE.md` does not
 * apply here (it still applies to `scripts/ai-search-eval.ts`). One run is one
 * generation: a few minutes at Strata's ~25 tok/s.
 *
 * Env comes from `.env.local` then `.env`, as under Next.js (`./load-env`):
 * `DATABASE_URL` and `APP_TZ` for the snapshot, and `LOCAL_AI_BASE_URL`,
 * `LOCAL_AI_API_KEY`, and `LOCAL_AI_MODEL` for Strata — the key only ever in
 * `.env.local`, never committed. The snapshot is read-only.
 */
import "./load-env";
import { isValidSqlDate, shiftSqlDate, today } from "../lib/local-day";
import {
  buildPreparedSystemPrompt,
  createPreparedNoteClient,
  PREPARED_PROMPT_VERSION,
  type PrepareResult,
  type RawPreparedReply,
} from "../lib/prepared-note";
import { snapshotForDay } from "../lib/snapshot-source";

/** The brief's target length, from the spec. */
const BRIEF_WORDS = { min: 40, max: 70 };

/**
 * Phrases that usually break the rhythm-claim rule — a date, a day or week
 * count, a month, or a vague "it has been a while". A flag to read, not a
 * verdict: "every two weeks" is fine and still matches.
 */
const RHYTHM_CLAIM_SUSPECTS =
  /\b\d{1,2}\/\d{1,2}\b|\b\d+\s+(?:[Dd]ays?|[Ww]eeks?|[Mm]onths?)\b|\b(?:days?|weeks?|months?)\s+ago\b|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b|\b(?:a while|long gap|gone quiet|out of rotation)\b/g;

/** `--day=+N`, `--day=YYYY-MM-DD`, or today when absent. */
function resolveDay(arg: string | undefined): string {
  const base = today();
  if (arg === undefined) return base;
  if (/^\+\d+$/.test(arg)) return shiftSqlDate(base, Number(arg.slice(1)));
  if (isValidSqlDate(arg)) return arg;
  console.error(`--day must be +N or YYYY-MM-DD, got ${arg}`);
  process.exit(1);
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter((word) => word !== "").length;
}

/**
 * Run `call` with the `prepared_note` log line `prepare` emits captured
 * rather than printed, so its latency and token counts can be reported tidily.
 */
async function captureLogLine<T>(
  call: () => Promise<T>,
): Promise<{ value: T; logLine?: Record<string, unknown> }> {
  let logLine: Record<string, unknown> | undefined;
  const passThroughLog = console.log.bind(console);
  console.log = ((...logArgs: unknown[]): void => {
    const [first] = logArgs;
    if (typeof first === "string" && first.includes('"event":"prepared_note"')) {
      logLine = JSON.parse(first) as Record<string, unknown>;
    } else {
      passThroughLog(...(logArgs as Parameters<typeof console.log>));
    }
  }) as typeof console.log;
  try {
    return { value: await call(), logLine };
  } finally {
    console.log = passThroughLog;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const day = resolveDay(
    args.find((arg) => arg.startsWith("--day="))?.slice(6),
  );

  const baseUrl = process.env.LOCAL_AI_BASE_URL;
  const model = process.env.LOCAL_AI_MODEL;
  if (!baseUrl || !model) {
    console.error(
      "LOCAL_AI_BASE_URL and LOCAL_AI_MODEL are not set — add them to .env.local.",
    );
    process.exit(1);
  }

  const { snapshot, idByIndex, nameById } = await snapshotForDay({
    asOf: day,
    query: "",
  });

  console.log(`day: ${snapshot.today}`);
  console.log(`model: ${model}   prompt version: ${PREPARED_PROMPT_VERSION}`);
  console.log(
    `candidates: ${idByIndex.size}   log: ${snapshot.log.length} dinners   ` +
      `day note: ${snapshot.todayDayNote ? "yes" : "none"}\n`,
  );

  if (!args.includes("--no-prompt")) {
    console.log("--- system prompt ---");
    console.log(buildPreparedSystemPrompt());
    console.log("--- end system prompt ---\n");
  }
  if (args.includes("--snapshot")) {
    console.log("--- snapshot sent to the model ---");
    console.log(JSON.stringify(snapshot, null, 2));
    console.log("--- end snapshot ---\n");
  }

  console.log("→ generating …");
  let reply: RawPreparedReply | undefined;
  const { value: result, logLine } = await captureLogLine(
    (): Promise<PrepareResult> =>
      createPreparedNoteClient({
        baseUrl,
        apiKey: process.env.LOCAL_AI_API_KEY,
        model,
        onReply: (raw) => {
          reply = raw;
        },
      }).prepare(snapshot, idByIndex),
  );

  const cell = (value: unknown) => (value === undefined ? "—" : String(value));
  const latencyMs = Number(logLine?.latencyMs);
  console.log(
    `latency: ${Number.isFinite(latencyMs) ? (latencyMs / 1000).toFixed(1) : "—"}s   ` +
      `tokens in ${cell(logLine?.inputTokens)} · out ${cell(logLine?.outputTokens)}   ` +
      `finish: ${reply?.finishReason ?? "—"}   ` +
      `reasoning: ${reply?.reasoning ? wordCount(reply.reasoning) : 0} words\n`,
  );

  console.log("--- raw reply (content) ---");
  console.log(reply?.content ?? "(no content)");
  console.log("--- end raw reply ---\n");

  if (!result.ok) {
    console.log("Prepared note unavailable — no usable note in the reply.");
    process.exit(1);
  }

  const { brief, ranking } = result.note;
  const words = wordCount(brief);
  const inRange = words >= BRIEF_WORDS.min && words <= BRIEF_WORDS.max;
  console.log(
    `--- brief: ${words} words ${inRange ? "(in range)" : `(OUT OF RANGE ${BRIEF_WORDS.min}–${BRIEF_WORDS.max})`} ---`,
  );
  console.log(brief);

  const ranked = new Set(ranking.map((row) => row.id));
  const missing = [...idByIndex.values()].filter((id) => !ranked.has(id));
  console.log(
    `\n--- ranking: ${ranking.length}/${idByIndex.size} candidates ranked ---`,
  );
  ranking.forEach((row, index) => {
    console.log(
      `${String(index + 1).padStart(2)}. ${nameById.get(row.id) ?? row.id}`,
    );
    console.log(`    ${row.reason}`);
  });
  if (missing.length > 0) {
    console.log(
      `\nMISSING ${missing.length}: ${missing.map((id) => nameById.get(id) ?? id).join(", ")}`,
    );
  }

  const suspects = [brief, ...ranking.map((row) => row.reason)].flatMap(
    (text) => text.match(RHYTHM_CLAIM_SUSPECTS) ?? [],
  );
  console.log(
    `\nrhythm-claim suspects: ${suspects.length === 0 ? "none" : suspects.join(" · ")}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Eval run failed.");
    console.error(error);
    process.exit(1);
  });
