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
 *   npx tsx scripts/ai-search-eval.ts --compare            # model matrix
 *   npx tsx scripts/ai-search-eval.ts --compare --serial   # one call at a time
 *
 * The `--mode` flag (`full` | `pithy` | `drop`) overrides `AI_TAIL_MODE`
 * for the run, so the three open-query result shapes can be compared on the
 * same data; a plain run prints its input / output / cache token counts.
 *
 * `--compare` runs the same empty-query snapshot through the `COMPARE_CELLS`
 * matrix and prints each run's latency and ranking. Every cell goes through
 * `createAiSearchClient` with an explicit model + `ThinkingChoice` override,
 * so the budget-API models (Sonnet, Haiku) and the adaptive-API model (Opus)
 * are all exercised through the production path. `--serial` runs the cells one
 * at a time — slower, but the per-call latencies are free of the contention a
 * parallel sweep adds.
 *
 * A plain run (no `--compare`) uses the env-configured model / effort
 * (`AI_MODEL` / `AI_EFFORT`), exactly as the `aiSearchAction` server action.
 *
 * `DATABASE_URL`, `APP_TZ`, and `ANTHROPIC_API_KEY` are read from `.env`. The
 * snapshot is built exactly as the `aiSearchAction` server action builds it,
 * so what this prints is what the Tonight screen would show.
 */
import "dotenv/config";
import { config } from "dotenv";
import { getRejections, getTonightData } from "../db/queries";
import {
  buildSnapshot,
  createAiSearchClient,
  type ModelSnapshot,
  type ThinkingChoice,
} from "../lib/ai-search";
import { todaySqlDate } from "../lib/local-day";

/** Tail modes accepted by `--mode` — see `resolveTailMode` in `lib/ai-search`. */
const TAIL_MODES = ["full", "pithy", "drop"] as const;

/** One cell of the `--compare` matrix — a model paired with a thinking choice. */
type ComparisonCell = {
  label: string;
  model: string;
  thinking: ThinkingChoice;
};

/** One completed `--compare` run: its cell, latency, and ranked result. */
type ComparisonRun = {
  cell: ComparisonCell;
  latencyMs: number;
  ok: boolean;
  rows: { id: string; reason: string }[];
};

/** Budget-API models (Sonnet, Haiku) swept over token-budget levels. */
const BUDGET_MODELS = [
  { name: "haiku", model: "claude-haiku-4-5-20251001" },
  { name: "sonnet", model: "claude-sonnet-4-6" },
];
/** Token budgets to sweep — `0` is thinking off. */
const BUDGET_LEVELS = [0, 1024, 2048, 4096, 6144];
/** Opus 4.7 adaptive-thinking effort levels (`null` = thinking off). */
const OPUS_EFFORTS: ("low" | "medium" | "high" | null)[] = [
  null,
  "low",
  "medium",
  "high",
];

/**
 * The matrix `--compare` runs — every model family on one shared snapshot.
 * For a latency measurement, narrow this to one model with repeated cells and
 * run with `--serial` (interleave reps so API-load drift is spread evenly).
 */
const COMPARE_CELLS: ComparisonCell[] = [
  ...BUDGET_MODELS.flatMap((m) =>
    BUDGET_LEVELS.map(
      (budget): ComparisonCell => ({
        label: `${m.name} · thinking ${budget === 0 ? "off" : budget}`,
        model: m.model,
        thinking:
          budget === 0
            ? { type: "off" }
            : { type: "budget", budgetTokens: budget },
      }),
    ),
  ),
  ...OPUS_EFFORTS.map(
    (effort): ComparisonCell => ({
      label: `opus · ${effort ? `effort ${effort}` : "thinking off"}`,
      model: "claude-opus-4-7",
      thinking: effort ? { type: "effort", effort } : { type: "off" },
    }),
  ),
];

async function buildSnapshotFromDb(query: string): Promise<{
  snapshot: ModelSnapshot;
  idByIndex: Map<number, string>;
  nameById: Map<string, string>;
}> {
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
  // Result rows carry the real UUID (`parseAndValidate` maps the snapshot
  // integer back), so the display map is keyed by UUID.
  const nameById = new Map(options.map((o) => [o.id, o.name]));
  return { snapshot, idByIndex, nameById };
}

async function runComparison(apiKey: string, serial: boolean): Promise<void> {
  const { snapshot, idByIndex, nameById } = await buildSnapshotFromDb("");

  console.log(`today: ${snapshot.today}`);
  console.log("query: (empty)");
  console.log(
    `catalog: ${snapshot.options.length} Options   ` +
      `log: ${snapshot.log.length} dinners`,
  );
  console.log(`mode: ${serial ? "serial" : "parallel"}\n`);

  const runCell = (cell: ComparisonCell): Promise<ComparisonRun> => {
    const startedAt = Date.now();
    return createAiSearchClient(apiKey, {
      model: cell.model,
      thinking: cell.thinking,
    })
      .search(snapshot, idByIndex)
      .then((result) => ({
        cell,
        latencyMs: Date.now() - startedAt,
        ok: result.ok,
        rows: result.ok ? result.results : [],
      }));
  };

  // Serial avoids the concurrency contention that makes a parallel sweep's
  // per-call latencies unreadable; parallel is faster when only ranking
  // quality, not timing, is under test.
  let runs: ComparisonRun[];
  if (serial) {
    runs = [];
    for (const cell of COMPARE_CELLS) runs.push(await runCell(cell));
  } else {
    runs = await Promise.all(COMPARE_CELLS.map(runCell));
  }

  for (const run of runs) {
    const secs = (run.latencyMs / 1000).toFixed(1);
    console.log(
      `\n=== ${run.cell.label}  —  ${secs}s  —  ` +
        `${run.ok ? `${run.rows.length} results` : "UNAVAILABLE"} ===`,
    );
    if (!run.ok) continue;
    run.rows.forEach((row, index) => {
      console.log(
        `${String(index + 1).padStart(2)}. ${nameById.get(row.id) ?? row.id}`,
      );
      console.log(`    ${row.reason}`);
    });
  }

  console.log("\n--- latency summary ---");
  for (const run of runs) {
    console.log(
      `${run.cell.label.padEnd(24)} ${(run.latencyMs / 1000)
        .toFixed(1)
        .padStart(6)}s   ${
        run.ok ? `${run.rows.length} results` : "UNAVAILABLE"
      }`,
    );
  }
}

async function runSingle(apiKey: string): Promise<void> {
  const args = process.argv.slice(2);
  const dumpSnapshot = args.includes("--snapshot");
  const query = args.find((arg) => !arg.startsWith("--")) ?? "";

  const { snapshot, idByIndex, nameById } = await buildSnapshotFromDb(query);

  console.log(`today: ${snapshot.today}`);
  console.log(`query: ${query ? JSON.stringify(query) : "(empty)"}`);
  console.log(`tail mode: ${process.env.AI_TAIL_MODE ?? "pithy"}`);
  console.log(
    `catalog: ${snapshot.options.length} Options   ` +
      `log: ${snapshot.log.length} dinners\n`,
  );

  if (dumpSnapshot) {
    console.log("--- snapshot sent to the model ---");
    console.log(JSON.stringify(snapshot, null, 2));
    console.log("--- end snapshot ---\n");
  }

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
    console.log(
      `${String(index + 1).padStart(2)}. ${nameById.get(row.id) ?? row.id}`,
    );
    console.log(`    ${row.reason}`);
  });
}

async function main(): Promise<void> {
  // Re-load `.env` with `override`, so the key in `.env` wins over an empty
  // `ANTHROPIC_API_KEY` the shell may export (the Claude Code harness does);
  // plain `dotenv/config` above keeps an already-present var, leaving the key
  // blank. By here the DB client has its `DATABASE_URL` from the first load.
  config({ override: true });

  const args = process.argv.slice(2);

  // `--mode=X` overrides the tail mode for this run by setting the env var
  // `createAiSearchClient` reads, so a `full` / `pithy` / `drop` comparison
  // needs no `.env` edit between runs.
  const modeArg = args.find((arg) => arg.startsWith("--mode="))?.slice(7);
  if (modeArg !== undefined) {
    if (!(TAIL_MODES as readonly string[]).includes(modeArg)) {
      console.error(`--mode must be one of: ${TAIL_MODES.join(", ")}`);
      process.exit(1);
    }
    process.env.AI_TAIL_MODE = modeArg;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set — add it to .env.");
    process.exit(1);
  }

  if (args.includes("--compare")) {
    await runComparison(apiKey, args.includes("--serial"));
  } else {
    await runSingle(apiKey);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Eval run failed.");
    console.error(error);
    process.exit(1);
  });
