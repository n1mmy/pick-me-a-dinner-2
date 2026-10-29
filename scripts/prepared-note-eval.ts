/**
 * Prepared note evaluation harness — ask the local model (on Strata) for one
 * date's Prepared note against the real dev database, without the sweep or
 * the Tonight UI (ADR-0011).
 *
 * This is the iteration loop for `buildPreparedSystemPrompt` and the token
 * budget in `lib/prepared-note.ts`: edit them, re-run this, and read the brief
 * and the ranking. It prints the built prompt, the model's raw reply, and the
 * parsed note, plus the numbers issue 03 judges a note by — the brief's word
 * count, how many candidates were ranked, why generation stopped — so they
 * don't have to be counted by eye. Nothing is written to `prepared_notes`.
 *
 *   npx tsx scripts/prepared-note-eval.ts               # today
 *   npx tsx scripts/prepared-note-eval.ts --day=+3      # three days ahead
 *   npx tsx scripts/prepared-note-eval.ts --day=2026-10-25
 *   npx tsx scripts/prepared-note-eval.ts --snapshot    # also dump the JSON sent
 *   npx tsx scripts/prepared-note-eval.ts --no-prompt   # skip the system prompt
 *   npx tsx scripts/prepared-note-eval.ts --reasoning   # also print the model's reasoning
 *
 * Backtest (`scripts/backtest.ts`): score notes for recent decided days, each
 * built as the Household saw it, against what was eaten. ~9 minutes a day, so
 * the default 20 days is about three hours; `--resume` picks a stopped run up.
 *
 *   npx tsx scripts/prepared-note-eval.ts --backtest --json --reasoning
 *   npx tsx scripts/prepared-note-eval.ts --backtest --days=2026-10-20,2026-10-23 --json=x.json
 *   npx tsx scripts/prepared-note-eval.ts --backtest --json --reasoning --resume
 *
 * `--claude[=model]` sends the backtest's prompt to a Claude model instead
 * (Opus 5.5 by default) through the Anthropic API, with `ANTHROPIC_API_KEY`,
 * at `--effort=low|medium|high` (default `low`, as AI search runs). The
 * reasoning saved is the thinking summary, not a raw trace. This call is
 * billed, so the billed-call rule in `CLAUDE.md` applies to it.
 *
 *   npx tsx scripts/prepared-note-eval.ts --backtest --claude --days=… --json --reasoning
 *
 * Strata is free to call, so the billed-call rule in `CLAUDE.md` does not
 * apply here (it still applies to `scripts/ai-search-eval.ts`). One run is one
 * generation: six to ten minutes on an idle Strata, up to about 35 under
 * another client's load (see `REQUEST_TIMEOUT_MS` in `lib/prepared-note.ts`).
 *
 * Env comes from `.env.local` then `.env`, as under Next.js (`./load-env`):
 * `DATABASE_URL` and `APP_TZ` for the snapshot, and `LOCAL_AI_BASE_URL`,
 * `LOCAL_AI_API_KEY`, and `LOCAL_AI_MODEL` for Strata — the key only ever in
 * `.env.local`, never committed. The snapshot is read-only.
 */
import "./load-env";
import Anthropic from "@anthropic-ai/sdk";
import type { AiEffort } from "../lib/ai-search";
import { isValidSqlDate, shiftSqlDate, today } from "../lib/local-day";
import {
  buildPreparedSystemPrompt,
  buildPreparedUserMessage,
  createPreparedNoteClient,
  localModelConfig,
  parsePreparedReply,
  PREPARED_PROMPT_VERSION,
  type PrepareResult,
  type RawPreparedReply,
} from "../lib/prepared-note";
import { type BuiltSnapshot, leanSnapshot, snapshotForDay } from "../lib/snapshot";
import { type Generation, parseBacktestArgs, runBacktest } from "./backtest";

/** The brief's target length, from the spec. */
const BRIEF_WORDS = { min: 40, max: 70 };

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

/**
 * A backtest generator that sends the Prepared note prompt to a Claude model:
 * the same system prompt and user message the local model gets, adaptive
 * thinking at `effort`, streamed. Read as the local-model path reads in the
 * backtest: a reply that ended on its own is parsed leniently, so a skipped
 * brief still scores.
 */
function claudeGenerator(
  model: string,
  effort: AiEffort,
): (built: BuiltSnapshot) => Promise<Generation> {
  const anthropic = new Anthropic();
  const system = buildPreparedSystemPrompt();
  return async (built) => {
    const startedAt = Date.now();
    const response = await anthropic.messages
      .stream({
        model,
        max_tokens: 32_000,
        system,
        messages: [{ role: "user", content: buildPreparedUserMessage(built) }],
        thinking: { type: "adaptive", display: "summarized" },
        output_config: { effort },
      })
      .finalMessage();
    const text = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");
    const reasoning = response.content
      .map((block) => (block.type === "thinking" ? block.thinking : ""))
      .join("\n");
    const note =
      response.stop_reason === "end_turn"
        ? parsePreparedReply(text, built, { requireBrief: false })
        : null;
    if (note === null) {
      console.error(`  stop: ${response.stop_reason}; reply unread:\n${text.slice(0, 500)}`);
    }
    return {
      ok: note !== null,
      ranking: note?.ranking ?? [],
      brief: note?.brief,
      latencyMs: Date.now() - startedAt,
      outputTokens: response.usage.output_tokens,
      reasoning: reasoning || undefined,
    };
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const day = resolveDay(
    args.find((arg) => arg.startsWith("--day="))?.slice(6),
  );

  const claudeArg = args.find((arg) => arg === "--claude" || arg.startsWith("--claude="));
  if (claudeArg) {
    if (!args.includes("--backtest")) {
      console.error("--claude runs the backtest only — add --backtest.");
      process.exit(1);
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("ANTHROPIC_API_KEY is not set — add it to .env.local.");
      process.exit(1);
    }
    const model = claudeArg.includes("=") ? claudeArg.slice(9) : "claude-opus-5-5";
    const effortArg = args.find((arg) => arg.startsWith("--effort="))?.slice(9) ?? "low";
    if (effortArg !== "low" && effortArg !== "medium" && effortArg !== "high") {
      console.error(`--effort must be low, medium or high, got ${effortArg}`);
      process.exit(1);
    }
    const backtestArgs = parseBacktestArgs(
      args,
      `scripts/backtest-runs/prepared-v${PREPARED_PROMPT_VERSION}-${model.replace(/^claude-/, "")}-${effortArg}.json`,
    );
    if (args.includes("--reasoning") && !backtestArgs.jsonPath) {
      console.error("--reasoning saves traces beside the JSON — add --json.");
      process.exit(1);
    }
    await runBacktest({
      args: backtestArgs,
      meta: {
        ranker: "prepared note",
        model,
        effort: effortArg,
        promptVersion: PREPARED_PROMPT_VERSION,
      },
      saveReasoning: args.includes("--reasoning"),
      generate: claudeGenerator(model, effortArg),
    });
    return;
  }

  const config = localModelConfig();
  const { model } = config;
  if (!config.baseUrl || !model) {
    console.error(
      "LOCAL_AI_BASE_URL and LOCAL_AI_MODEL are not set — add them to .env.local.",
    );
    process.exit(1);
  }

  if (args.includes("--backtest")) {
    const backtestArgs = parseBacktestArgs(
      args,
      `scripts/backtest-runs/strata-v${PREPARED_PROMPT_VERSION}.json`,
    );
    if (args.includes("--reasoning") && !backtestArgs.jsonPath) {
      console.error("--reasoning saves traces beside the JSON — add --json.");
      process.exit(1);
    }
    await runBacktest({
      args: backtestArgs,
      meta: { ranker: "prepared note", model, promptVersion: PREPARED_PROMPT_VERSION },
      saveReasoning: args.includes("--reasoning"),
      generate: async (built) => {
        let reply: RawPreparedReply | undefined;
        const { value: result, logLine } = await captureLogLine(() =>
          createPreparedNoteClient({
            ...config,
            onReply: (raw) => {
              reply = raw;
            },
          }).prepare(built),
        );
        // A whole reply whose brief the model skipped is unavailable to the
        // app, but its ranking still scores here, with the brief empty — the
        // aggregate counts those days.
        const lenient =
          !result.ok && reply?.content && reply.finishReason === "stop"
            ? parsePreparedReply(reply.content, built, { requireBrief: false })
            : null;
        const note = result.ok ? result.note : lenient;
        return {
          ok: note !== null,
          ranking: note?.ranking ?? [],
          brief: note?.brief,
          latencyMs: Number(logLine?.latencyMs) || undefined,
          outputTokens: Number(logLine?.outputTokens) || undefined,
          reasoning: reply?.reasoning ?? undefined,
        };
      },
    });
    return;
  }

  const built = await snapshotForDay({ asOf: day, query: "" });
  const { snapshot, idByCode, nameById } = built;

  console.log(`day: ${snapshot.today}`);
  console.log(`model: ${model}   prompt version: ${PREPARED_PROMPT_VERSION}`);
  console.log(
    `candidates: ${idByCode.size}   log: ${snapshot.log.length} dinners   ` +
      `day note: ${snapshot.todayDayNote ? "yes" : "none"}\n`,
  );

  if (!args.includes("--no-prompt")) {
    console.log("--- system prompt ---");
    console.log(buildPreparedSystemPrompt());
    console.log("--- end system prompt ---\n");
  }
  if (args.includes("--snapshot")) {
    console.log("--- snapshot sent to the model ---");
    console.log(JSON.stringify(leanSnapshot(snapshot), null, 2));
    console.log("--- end snapshot ---\n");
  }

  console.log("→ generating …");
  let reply: RawPreparedReply | undefined;
  const { value: result, logLine } = await captureLogLine(
    (): Promise<PrepareResult> =>
      createPreparedNoteClient({
        ...config,
        onReply: (raw) => {
          reply = raw;
        },
      }).prepare(built),
  );

  const cell = (value: unknown) => (value === undefined ? "—" : String(value));
  const latencyMs = Number(logLine?.latencyMs);
  console.log(
    `latency: ${Number.isFinite(latencyMs) ? (latencyMs / 1000).toFixed(1) : "—"}s   ` +
      `tokens in ${cell(logLine?.inputTokens)} · out ${cell(logLine?.outputTokens)}   ` +
      `finish: ${reply?.finishReason ?? "—"}   ` +
      `reasoning: ${reply?.reasoning ? wordCount(reply.reasoning) : 0} words\n`,
  );

  if (args.includes("--reasoning")) {
    console.log("--- reasoning ---");
    console.log(reply?.reasoning ?? "(no reasoning)");
    console.log("--- end reasoning ---\n");
  }

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
  const missing = [...idByCode.values()].filter((id) => !ranked.has(id));
  console.log(
    `\n--- ranking: ${ranking.length}/${idByCode.size} candidates ranked ---`,
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
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Eval run failed.");
    console.error(error);
    process.exit(1);
  });
