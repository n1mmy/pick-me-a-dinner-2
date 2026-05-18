/**
 * AI search evaluation harness — run an AI search against the real dev
 * database from the command line, without the Tonight UI (ADR-0005).
 *
 * This is the iteration loop for the AI search prompt and snapshot
 * (`lib/ai-search.ts`): edit the system prompt or the snapshot shape, re-run
 * this, and read the ranked result, its rationales, and the token usage.
 * No browser, no React, one model call.
 *
 *   npx tsx scripts/ai-search-eval.ts "something light"
 *   npx tsx scripts/ai-search-eval.ts                      # empty query
 *   npx tsx scripts/ai-search-eval.ts --snapshot "guests"  # also dump the
 *                                                            JSON sent to the model
 *   npx tsx scripts/ai-search-eval.ts --mode=drop ""       # force a tail mode
 *
 * The `--mode` flag (`full` | `pithy` | `drop`) overrides `AI_SEARCH_TAIL_MODE`
 * for the run, so the three open-query result shapes can be compared on the
 * same data — each run prints its input / output / cache token counts.
 *
 * `DATABASE_URL`, `APP_TZ`, and `ANTHROPIC_API_KEY` are read from `.env`. The
 * snapshot is built exactly as the `aiSearchAction` server action builds it,
 * so what this prints is what the Tonight screen would show.
 */
import "dotenv/config";
import { config } from "dotenv";
import { getRejections, getTonightData } from "../db/queries";
import { buildSnapshot, createAiSearchClient } from "../lib/ai-search";
import { todaySqlDate } from "../lib/local-day";

const TAIL_MODES = ["full", "pithy", "drop"] as const;

async function main(): Promise<void> {
  // Re-load `.env` with `override`, so the key in `.env` wins over an empty
  // `ANTHROPIC_API_KEY` the shell may export (the Claude Code harness does);
  // plain `dotenv/config` above keeps an already-present var, leaving the key
  // blank. By here the DB client has its `DATABASE_URL` from the first load.
  config({ override: true });

  const args = process.argv.slice(2);
  const dumpSnapshot = args.includes("--snapshot");
  const query = args.find((arg) => !arg.startsWith("--")) ?? "";

  // `--mode=X` overrides the tail mode for this run by setting the env var
  // `createAiSearchClient` reads, so a `full` / `pithy` / `drop` comparison
  // needs no `.env` edit between runs.
  const modeArg = args.find((arg) => arg.startsWith("--mode="))?.slice(7);
  if (modeArg !== undefined) {
    if (!(TAIL_MODES as readonly string[]).includes(modeArg)) {
      console.error(`--mode must be one of: ${TAIL_MODES.join(", ")}`);
      process.exit(1);
    }
    process.env.AI_SEARCH_TAIL_MODE = modeArg;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set — add it to .env.");
    process.exit(1);
  }

  const today = todaySqlDate(new Date(), process.env.APP_TZ ?? "UTC");
  const [{ options, logEntries }, rejections] = await Promise.all([
    getTonightData(today),
    getRejections(),
  ]);

  const { snapshot, idByIndex } = buildSnapshot({
    options: options.map((option) => ({
      id: option.id,
      name: option.name,
      kind: option.kind,
      tags: option.tags,
      notes: option.notes,
    })),
    logEntries: logEntries.map((entry) => ({
      optionId: entry.optionId,
      eatenOn: entry.eatenOn,
      note: entry.note,
    })),
    rejections,
    today,
    query,
  });

  console.log(`today: ${snapshot.today}`);
  console.log(`query: ${query ? JSON.stringify(query) : "(empty)"}`);
  console.log(`tail mode: ${process.env.AI_SEARCH_TAIL_MODE ?? "pithy"}`);
  console.log(
    `catalog: ${snapshot.options.length} Options   ` +
      `log: ${snapshot.log.length} dinners\n`,
  );

  if (dumpSnapshot) {
    console.log("--- snapshot sent to the model ---");
    console.log(JSON.stringify(snapshot, null, 2));
    console.log("--- end snapshot ---\n");
  }

  const nameById = new Map(options.map((option) => [option.id, option.name]));

  // `search` emits one structured `ai_search` log line to stdout; capture it
  // so the token counts can be reprinted as a tidy summary instead of a raw
  // JSON blob in the middle of the output.
  let modelCall: Record<string, unknown> | undefined;
  const passThroughLog = console.log.bind(console);
  console.log = ((...logArgs: unknown[]): void => {
    const [first] = logArgs;
    if (typeof first === "string" && first.includes('"event":"ai_search"')) {
      modelCall = JSON.parse(first) as Record<string, unknown>;
    } else {
      passThroughLog(...(logArgs as Parameters<typeof console.log>));
    }
  }) as typeof console.log;

  const result = await createAiSearchClient(apiKey).search(snapshot, idByIndex);
  console.log = passThroughLog;

  if (modelCall) {
    const cell = (value: unknown) => (value === undefined ? "—" : String(value));
    console.log(
      `tokens — input ${cell(modelCall.inputTokens)} · ` +
        `output ${cell(modelCall.outputTokens)} · ` +
        `cache read ${cell(modelCall.cacheReadTokens)} · ` +
        `cache write ${cell(modelCall.cacheCreationTokens)}`,
    );
    console.log(`latency: ${cell(modelCall.latencyMs)}ms`);
  }

  if (!result.ok) {
    console.log(
      "\nAI search unavailable — the call failed or returned no usable result.",
    );
    process.exit(1);
  }
  if (result.results.length === 0) {
    console.log("\nAI ranking: empty — the model found no fitting Options.");
    return;
  }

  console.log(`\nAI ranking — ${result.results.length} Options:\n`);
  result.results.forEach((row, index) => {
    console.log(`${String(index + 1).padStart(2)}. ${nameById.get(row.id) ?? row.id}`);
    console.log(`    ${row.reason}`);
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Eval run failed.");
    console.error(error);
    process.exit(1);
  });
