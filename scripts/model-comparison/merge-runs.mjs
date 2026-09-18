/**
 * Collapse many run files into one per snapshot and query.
 *
 *   node scripts/model-comparison/merge-runs.mjs --dry-run
 *   node scripts/model-comparison/merge-runs.mjs
 *   node scripts/model-comparison/merge-runs.mjs runs-2027-03 --out-dir=.
 *
 * A comparison accumulates files, not runs: reps get topped up in a second
 * sweep, one cell gets re-run past the production timeout, a sweep is aborted
 * partway. Each lands in its own `--json=` file, and a dozen of them say
 * nothing a single file could not. This merges every run that ranked the SAME
 * snapshot and answered the SAME query into one document named for the anchor
 * day — `2026-09-17-open.json` — which is also the identity that decides
 * whether runs may be pooled at all (see `runs.mjs`).
 *
 * The output keeps the harness's own schema, so `analyze.mjs` and
 * `where-is.mjs` read a merged file exactly as they read a raw one, and the
 * numbers come out identical. Per-run provenance is preserved: `source` names
 * the file a run arrived in and `sourceRep` its rep number there, so merging
 * loses nothing except the file count. `rep` is renumbered 1..n per cell,
 * since three files each holding "rep 1" of the same cell is not information.
 *
 * Inputs are left alone — check the merged file, then delete them with
 * `git rm`. Re-running over an already-merged file is safe.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { artifactDir, expandPaths, parseArgs } from "./runs.mjs";

const { flags, positionals } = parseArgs(process.argv.slice(2));
const dryRun = flags.has("dry-run");
const outDir = path.resolve(flags.get("out-dir") ?? artifactDir);

let files;
try {
  files = expandPaths(positionals);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

/** Group key → merged document under construction. */
const groups = new Map();
const skipped = [];

for (const file of files) {
  const name = path.basename(file);
  let doc;
  try {
    doc = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    skipped.push(`${name}: unparseable JSON (${error.message})`);
    continue;
  }
  if (!Array.isArray(doc.runs)) {
    skipped.push(`${name}: not a run document (no \`runs\` array)`);
    continue;
  }

  // The anchor day and the query are what make two runs comparable; anything
  // else about where they came from is bookkeeping.
  const key = `${doc.today}|${doc.query}`;
  if (!groups.has(key)) {
    groups.set(key, {
      today: doc.today,
      query: doc.query,
      catalog: doc.catalog,
      logEntries: doc.logEntries,
      modes: new Set(),
      sources: [],
      runs: [],
    });
  }
  const group = groups.get(key);

  // A mismatch here means the anchor day matched but the data did not — a
  // Catalog edit between sweeps. Worth refusing rather than quietly pooling.
  if (group.catalog !== doc.catalog || group.logEntries !== doc.logEntries) {
    skipped.push(
      `${name}: same anchor day (${doc.today}) but different data ` +
        `(${doc.catalog}/${doc.logEntries} vs ${group.catalog}/${group.logEntries}) — ` +
        "not poolable, merge it separately",
    );
    continue;
  }

  group.modes.add(doc.mode ?? "unknown");
  group.sources.push({ file: name, runs: doc.runs.length });
  for (const run of doc.runs) {
    group.runs.push({
      ...run,
      // Keep the original provenance when re-merging an already-merged file.
      source: run.source ?? name,
      sourceRep: run.sourceRep ?? run.rep,
    });
  }
}

/** `""`/`"(empty)"` → `open`; otherwise a slug of the query text. */
function slug(query) {
  const text = (query === "(empty)" ? "" : query).trim().toLowerCase();
  if (!text) return "open";
  return (
    text
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "query"
  );
}

if (skipped.length) {
  console.log("skipped:");
  for (const line of skipped) console.log(`  ${line}`);
  console.log("");
}

if (!groups.size) {
  console.error("nothing to merge");
  process.exit(1);
}

for (const group of groups.values()) {
  // Stable order: cell, then rep within the cell. Renumber reps per cell.
  group.runs.sort(
    (a, b) =>
      a.label.localeCompare(b.label) ||
      a.source.localeCompare(b.source) ||
      a.sourceRep - b.sourceRep,
  );
  const repByLabel = new Map();
  for (const run of group.runs) {
    const next = (repByLabel.get(run.label) ?? 0) + 1;
    repByLabel.set(run.label, next);
    run.rep = next;
  }

  const anchorDate = group.today.split(" ")[0];
  const outPath = path.join(outDir, `${anchorDate}-${slug(group.query)}.json`);
  const merged = {
    today: group.today,
    query: group.query,
    mode: group.modes.size === 1 ? [...group.modes][0] : "mixed",
    /** Reps of the best-covered cell — the doc-level figure is a summary now. */
    reps: Math.max(...repByLabel.values()),
    catalog: group.catalog,
    logEntries: group.logEntries,
    /**
     * Always false: a merged file is a finished record. `inProgress` on a raw
     * file means the sweep that wrote it had cells still to come; that fact
     * survives as the run count in `mergedFrom`.
     */
    inProgress: false,
    mergedFrom: group.sources,
    runs: group.runs,
  };

  const cells = [...repByLabel.entries()]
    .map(([label, reps]) => `${label} ×${reps}`)
    .join(", ");
  console.log(
    `${dryRun ? "would write" : "wrote"} ${path.relative(process.cwd(), outPath)}`,
  );
  console.log(`  query: ${group.query}   snapshot: ${group.today}`);
  console.log(`  ${group.runs.length} runs from ${group.sources.length} file(s)`);
  console.log(`  cells: ${cells}`);
  console.log(
    `  sources: ${group.sources.map((s) => `${s.file} (${s.runs})`).join(", ")}`,
  );
  console.log("");

  if (!dryRun) writeFileSync(outPath, `${JSON.stringify(merged, null, 2)}\n`);
}

if (dryRun) {
  console.log("--dry-run: nothing written");
} else {
  console.log("inputs left in place — `git rm` them once the merge looks right");
}
