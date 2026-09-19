/**
 * Render the exact prompt the comparison runs sent — system prompt plus the
 * user message — without calling the API.
 *
 *   npx tsx scripts/model-comparison/show-prompt.mjs           # open query
 *   npx tsx scripts/model-comparison/show-prompt.mjs "light"   # with a query
 *
 * Prints the system prompt and a structural view of the user message to stdout,
 * and writes two files beside this one:
 *
 * - `system-prompt.txt` — the static half alone, identical for every cell,
 *   model and effort level. Committed, so a later comparison can diff the
 *   prompt it ran against the one the recorded baseline ran against; a prompt
 *   edit between sweeps is otherwise invisible and explains ranking drift that
 *   would otherwise be blamed on the model.
 * - `prompt-dump.txt` — the complete request including the full snapshot JSON
 *   (~27.6k tokens of real Catalog and Log). Gitignored: regenerable, and the
 *   household's entire eating history in one file.
 *
 * The eval harness's `--snapshot` flag does something similar but spends a
 * live model call to do it. Needs `DATABASE_URL`; makes no API call.
 */
import "dotenv/config";
import { config } from "dotenv";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getRejections, getTonightData } from "../../db/queries.ts";
import { buildSnapshot, buildSystemPrompt, resolveTailMode } from "../../lib/ai-search.ts";
import { todaySqlDate } from "../../lib/local-day.ts";

config({ override: true });

const here = path.dirname(fileURLToPath(import.meta.url));
const query = process.argv[2] ?? "";
const tailMode = resolveTailMode();
const systemPrompt = buildSystemPrompt(tailMode);

const today = todaySqlDate(new Date(), process.env.APP_TZ ?? "UTC");
const [{ options, logEntries }, rejections] = await Promise.all([
  getTonightData(today),
  getRejections(),
]);
const { snapshot } = buildSnapshot({
  options: options.map((o) => ({
    id: o.id,
    name: o.name,
    kind: o.kind,
    tags: o.tags,
    notes: o.notes,
    closedDays: o.closedDays,
  })),
  logEntries: logEntries.map((e) => ({
    optionId: e.optionId,
    eatenOn: e.eatenOn,
    note: e.note,
  })),
  rejections,
  asOf: today,
  query,
});

// Exactly how `createAiSearchClient` splits the user turn: the stable snapshot
// body in a cache_control block, the volatile query trailing it uncached.
const { query: delimitedQuery, ...snapshotBody } = snapshot;
const queryBlock = `The household's query for this search (may be empty):\n${delimitedQuery}`;

console.log(`=== SYSTEM PROMPT (tail mode: ${tailMode}) ===\n`);
console.log(systemPrompt);

console.log(`\n\n=== USER MESSAGE — block 1 of 2 (cache_control: ephemeral) ===\n`);
console.log("JSON.stringify of the snapshot body. Shape:\n");
console.log(`  today:      ${JSON.stringify(snapshotBody.today)}`);
console.log(`  options:    ${snapshotBody.options.length} entries`);
console.log(`  log:        ${snapshotBody.log.length} entries`);
// Field names are the model's frame, not the app's — `rejectedTonight` /
// `notTodayRejections` (`lib/rejections.ts`). Worth printing exactly, since
// the whole point of this script is to show what the model actually receives.
console.log(
  `  rejections: { rejectedTonight: ${snapshotBody.rejections.rejectedTonight.length}, ` +
    `notTodayRejections: ${snapshotBody.rejections.notTodayRejections.length} }`,
);
console.log("\nFirst Option, first log entry, and first rejection verbatim:\n");
console.log(`  ${JSON.stringify(snapshotBody.options[0])}`);
console.log(`  ${JSON.stringify(snapshotBody.log[0])}`);
console.log(
  `  ${JSON.stringify(
    snapshotBody.rejections.notTodayRejections[0] ??
      snapshotBody.rejections.rejectedTonight[0] ??
      null,
  )}`,
);

console.log(`\n\n=== USER MESSAGE — block 2 of 2 (uncached) ===\n`);
console.log(queryBlock);

const dump = [
  `=== SYSTEM PROMPT (tail mode: ${tailMode}) ===`,
  "",
  systemPrompt,
  "",
  "=== USER MESSAGE block 1 (cache_control: ephemeral) ===",
  "",
  JSON.stringify(snapshotBody),
  "",
  "=== USER MESSAGE block 2 (uncached) ===",
  "",
  queryBlock,
  "",
].join("\n");
writeFileSync(path.join(here, "prompt-dump.txt"), dump);
// The static half on its own — the part that is identical for every cell,
// model and effort level, and the only half worth diffing when the prompt
// is edited.
writeFileSync(path.join(here, "system-prompt.txt"), `${systemPrompt}\n`);
console.log(`\n\nfull request written → scripts/model-comparison/prompt-dump.txt`);
console.log(`system prompt only  → scripts/model-comparison/system-prompt.txt`);

process.exit(0);
