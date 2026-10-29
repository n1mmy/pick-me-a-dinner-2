/**
 * AI search evaluation harness — run an AI search against the real dev
 * database from the command line, without the Tonight UI (ADR-0005).
 *
 * This is the iteration loop for the AI search prompt (`lib/ai-search.ts`) and
 * snapshot (`lib/snapshot.ts`): edit the system prompt or the snapshot shape, re-run
 * this, and read the ranked result, its rationales, and the token usage.
 * No browser, no React, one model call.
 *
 *   npx tsx scripts/ai-search-eval.ts "something light"
 *   npx tsx scripts/ai-search-eval.ts                      # empty query
 *   npx tsx scripts/ai-search-eval.ts --day=2026-10-30     # a Selected day, not today
 *   npx tsx scripts/ai-search-eval.ts --snapshot "guests"  # also dump the
 *                                                            JSON sent to the model
 *   npx tsx scripts/ai-search-eval.ts --backtest --json    # score recent decided days
 *   npx tsx scripts/ai-search-eval.ts --backtest --days=2026-10-20,2026-10-23
 *
 * `--backtest` (`scripts/backtest.ts`, shared with the Prepared note eval)
 * runs an open search for each of about 20 recent decided days, built as the
 * Household saw it, and scores the ranking against what was eaten. One billed
 * call per day — state the count and get approval first (`CLAUDE.md`).
 *
 * A plain run uses the env-configured model / effort
 * (`AI_MODEL` / `AI_EFFORT`), exactly as the `aiSearchAction` server action,
 * and prints its input / output / cache token counts.
 *
 * `DATABASE_URL`, `APP_TZ`, and `ANTHROPIC_API_KEY` are read from `.env`, or
 * from the file `DOTENV_CONFIG_PATH` names (e.g. `.env.k8s`). The
 * snapshot is built exactly as the `aiSearchAction` server action builds it,
 * so what this prints is what the Tonight screen would show.
 */
import "dotenv/config";
import { config } from "dotenv";
import {
  AI_SEARCH_PROMPT_VERSION,
  createAiSearchClient,
  resolveModel,
  splitUserTurn,
} from "../lib/ai-search";
import { isValidSqlDate, today } from "../lib/local-day";
import { type BuiltSnapshot, snapshotForDay } from "../lib/snapshot";
import { parseBacktestArgs, runBacktest } from "./backtest";

/**
 * Run `call` with the `ai_search` log line `search` emits captured rather than
 * printed, so its token counts can be reported as a tidy summary. Everything
 * else printed while it runs passes through. The interception is process-wide,
 * so this may only wrap a call that is awaited on its own — never overlapping
 * ones, whose lines it could not tell apart.
 */
async function captureModelCall<T>(
  call: () => Promise<T>,
): Promise<{ value: T; modelCall?: Record<string, unknown> }> {
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
  try {
    return { value: await call(), modelCall };
  } finally {
    console.log = passThroughLog;
  }
}

/**
 * The anchor day: `--day=YYYY-MM-DD` — the Selected day, as a stepped Tonight
 * sends it — or today when absent.
 */
function anchorDay(): string {
  const arg = process.argv.find((a) => a.startsWith("--day="))?.slice(6);
  if (arg === undefined) return today();
  if (isValidSqlDate(arg)) return arg;
  console.error(`--day must be YYYY-MM-DD, got ${arg}`);
  process.exit(1);
}

async function buildSnapshotFromDb(query: string): Promise<BuiltSnapshot> {
  // `snapshotForDay` owns the reads and the mapping — this now measures
  // exactly the snapshot `aiSearchAction` builds, full Log (Planned dinners)
  // included, rather than the deterministic ranking's non-future Log.
  return snapshotForDay({ asOf: anchorDay(), query });
}

async function runSingle(apiKey: string): Promise<void> {
  const args = process.argv.slice(2);
  const dumpSnapshot = args.includes("--snapshot");
  const query = args.find((arg) => !arg.startsWith("--")) ?? "";

  const built = await buildSnapshotFromDb(query);
  const { snapshot, nameById } = built;

  console.log(`today: ${snapshot.today}`);
  console.log(`query: ${query ? JSON.stringify(query) : "(empty)"}`);
  console.log(`model: ${resolveModel()}`);
  console.log(
    `catalog: ${snapshot.options.length} Options   ` +
      `log: ${snapshot.log.length} dinners\n`,
  );

  if (dumpSnapshot) {
    const { snapshotBody, queryBlock } = splitUserTurn(snapshot);
    console.log("--- user turn sent to the model ---");
    console.log(JSON.stringify(snapshotBody, null, 2));
    console.log(queryBlock);
    console.log("--- end user turn ---\n");
  }

  // `search` emits one structured `ai_search` log line to stdout; capture it
  // so the token counts can be reprinted as a tidy summary instead of a raw
  // JSON blob in the middle of the output.
  const { value: result, modelCall } = await captureModelCall(() =>
    createAiSearchClient(apiKey).search(built),
  );

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
  // `DOTENV_CONFIG_PATH` (read by `dotenv/config` too) points both loads at
  // another file, e.g. `.env.k8s`.
  config({ path: process.env.DOTENV_CONFIG_PATH, override: true });

  const args = process.argv.slice(2);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set — add it to .env.");
    process.exit(1);
  }

  if (args.includes("--backtest")) {
    await runBacktest({
      // "-pithy" was the tail mode when there were three; it stays in the
      // name so new runs sort beside the recorded ones.
      args: parseBacktestArgs(
        args,
        `scripts/backtest-runs/ai-search-v${AI_SEARCH_PROMPT_VERSION}-${resolveModel().replace("claude-", "")}-pithy.json`,
      ),
      meta: {
        ranker: "AI search",
        model: resolveModel(),
        effort: process.env.AI_EFFORT || "default",
        promptVersion: AI_SEARCH_PROMPT_VERSION,
      },
      generate: async (built) => {
        const { value: result, modelCall } = await captureModelCall(() =>
          createAiSearchClient(apiKey).search(built),
        );
        return {
          ok: result.ok,
          ranking: result.ok ? result.results : [],
          latencyMs: Number(modelCall?.latencyMs) || undefined,
          outputTokens: Number(modelCall?.outputTokens) || undefined,
        };
      },
    });
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
