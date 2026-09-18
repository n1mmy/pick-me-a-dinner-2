/**
 * Where did one Option land in every recorded run?
 *
 *   node scripts/model-comparison/where-is.mjs Tadu
 *   node scripts/model-comparison/where-is.mjs Tadu runs-2027-03
 *   node scripts/model-comparison/where-is.mjs "big mouth" --cells=opus
 *
 * Prints its rank, list depth, and rationale for each run — the per-Option view
 * the aggregate tables in `summary.md` flatten away. Useful for auditing a
 * single known-hard case (an Option with a standing constraint, a just-eaten
 * one) rather than a whole ranking. Any trailing paths select which run files
 * to read (see `runs.mjs`); `--cells=` filters by label substring.
 *
 * Pair it with `ground-truth.mjs <name>` — this says where the models put the
 * Option, that says what the database actually records about it.
 */
import { loadRunsOrExit, parseArgs } from "./runs.mjs";

const { flags, positionals } = parseArgs(process.argv.slice(2));
const [rawNeedle, ...paths] = positionals;
const needle = (rawNeedle ?? "").toLowerCase();

if (!needle) {
  console.error(
    "usage: node where-is.mjs <option name substring> [run files or dirs] [--cells=<label substring>]",
  );
  process.exit(1);
}

const cellFilter = flags.get("cells")?.toLowerCase();
const { runs, skipped } = loadRunsOrExit(paths);
for (const s of skipped) console.error(`skipped ${s.file}: ${s.reason}`);

const rows = [];
for (const run of runs) {
  if (cellFilter && !run.label.toLowerCase().includes(cellFilter)) continue;
  if (!run.ok) {
    rows.push({ ...run, missing: "call failed" });
    continue;
  }
  const hit = run.ranking.find((r) => r.name.toLowerCase().includes(needle));
  rows.push({
    ...run,
    rank: hit?.rank,
    depth: run.ranking.length,
    reason: hit?.reason,
    missing: hit ? undefined : "not returned",
  });
}

if (!rows.length) {
  console.error("no runs matched — check the paths and --cells= filter");
  process.exit(1);
}

rows.sort(
  (a, b) =>
    a.snap.localeCompare(b.snap) ||
    a.query.localeCompare(b.query) ||
    a.label.localeCompare(b.label) ||
    (a.rank ?? 999) - (b.rank ?? 999),
);

// Grouped by snapshot first: a rank from a different anchor day is not
// comparable with one from this day, since the weekday and the day's
// rejections both moved.
let lastGroup = null;
for (const r of rows) {
  const group = `${r.snap} — query: ${r.query}`;
  if (group !== lastGroup) {
    console.log(`\n### ${group}\n`);
    lastGroup = group;
  }
  const where = r.missing
    ? `— ${r.missing}`
    : `#${String(r.rank).padStart(2)} of ${r.depth}`;
  console.log(`${r.label.padEnd(24)} rep ${r.rep}  ${where}   (${r.file})`);
  if (r.reason !== undefined) {
    console.log(`  reason: ${r.reason === "" ? "(empty)" : `"${r.reason}"`}`);
  }
}
