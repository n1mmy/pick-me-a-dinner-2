/**
 * AI search evaluation harness — run an AI search against the real dev
 * database from the command line, without the Tonight UI (ADR-0005).
 *
 * This is the iteration loop for the AI search prompt and snapshot
 * (`lib/ai-search.ts`): edit the system prompt or the snapshot shape, re-run
 * this, and read the ranked result and its rationales. No browser, no React,
 * one model call.
 *
 *   npx tsx scripts/ai-search-eval.ts "something light"
 *   npx tsx scripts/ai-search-eval.ts                      # empty query
 *   npx tsx scripts/ai-search-eval.ts --snapshot "guests"  # also dump the
 *                                                            JSON sent to the model
 *
 * `DATABASE_URL`, `APP_TZ`, and `ANTHROPIC_API_KEY` are read from `.env`. The
 * snapshot is built exactly as the `aiSearchAction` server action builds it,
 * so what this prints is what the Tonight screen would show.
 */
import "dotenv/config";
import { config } from "dotenv";
import { getTonightData } from "../db/queries";
import { buildSnapshot, createAiSearchClient } from "../lib/ai-search";
import { todaySqlDate } from "../lib/local-day";

async function main(): Promise<void> {
  // Re-load `.env` with `override`, so the key in `.env` wins over an empty
  // `ANTHROPIC_API_KEY` the shell may export (the Claude Code harness does);
  // plain `dotenv/config` above keeps an already-present var, leaving the key
  // blank. By here the DB client has its `DATABASE_URL` from the first load.
  config({ override: true });

  const args = process.argv.slice(2);
  const dumpSnapshot = args.includes("--snapshot");
  const query = args.find((arg) => !arg.startsWith("--")) ?? "";

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set — add it to .env.");
    process.exit(1);
  }

  const today = todaySqlDate(new Date(), process.env.APP_TZ ?? "UTC");
  const { options, logEntries } = await getTonightData(today);

  const snapshot = buildSnapshot({
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
    today,
    query,
  });

  console.log(`today: ${snapshot.today}`);
  console.log(`query: ${query ? JSON.stringify(query) : "(empty)"}`);
  console.log(
    `catalog: ${snapshot.options.length} Options   ` +
      `log: ${snapshot.log.length} dinners\n`,
  );

  if (dumpSnapshot) {
    console.log("--- snapshot sent to the model ---");
    console.log(JSON.stringify(snapshot, null, 2));
    console.log("--- end snapshot ---\n");
  }

  const activeIds = new Set(options.map((option) => option.id));
  const nameById = new Map(options.map((option) => [option.id, option.name]));

  const result = await createAiSearchClient(apiKey).search(snapshot, activeIds);

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
