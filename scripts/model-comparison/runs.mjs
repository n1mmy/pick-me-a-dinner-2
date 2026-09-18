/**
 * Shared loader for the comparison artifacts every tool in this directory
 * reads — the `--json=` files written by `scripts/ai-search-eval.ts --compare`.
 *
 * Each tool takes the same positional arguments: any mix of run files and
 * directories of run files. With none, it reads this directory, which is where
 * the committed baseline lives. That is what makes a later comparison possible
 * without editing the tools:
 *
 *   node analyze.mjs                          # baseline only
 *   node analyze.mjs . runs-2027-03          # baseline + a later sweep
 *   node analyze.mjs runs-2027-03            # the later sweep alone
 *
 * A JSON file that is not a run document is skipped and reported, so the
 * directory can hold other JSON without breaking the tools.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** This directory — the default search path, and where the baseline sits. */
export const artifactDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Split `process.argv.slice(2)` into `--flag=value` pairs and positionals.
 * Bare `--flag` becomes `"true"`.
 */
export function parseArgs(argv) {
  const flags = new Map();
  const positionals = [];
  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const eq = arg.indexOf("=");
    if (eq === -1) flags.set(arg.slice(2), "true");
    else flags.set(arg.slice(2, eq), arg.slice(eq + 1));
  }
  return { flags, positionals };
}

/** Expand paths — files as themselves, directories as their `*.json`. */
function expand(paths) {
  const files = [];
  for (const entry of paths) {
    const resolved = path.resolve(entry);
    let stats;
    try {
      stats = statSync(resolved);
    } catch {
      throw new Error(`no such file or directory: ${entry}`);
    }
    if (stats.isDirectory()) {
      files.push(
        ...readdirSync(resolved)
          .filter((f) => f.endsWith(".json"))
          .sort()
          .map((f) => path.join(resolved, f)),
      );
    } else {
      files.push(resolved);
    }
  }
  // A path given twice (`.` plus a file inside it) must not double-count reps.
  return [...new Set(files)];
}

/**
 * Load every run in `paths` as a flat list.
 *
 * Returns `{ runs, docs, skipped }`. Each run carries the document-level
 * context it needs to be compared safely — above all `snap`, the **snapshot
 * identity**: reps only pool if they ranked the same data. A different anchor
 * day is a different task here (weekday rhythm and same-day rejections both
 * move), so a date rollover must never masquerade as model instability.
 */
export function loadRuns(paths) {
  const files = expand(paths.length ? paths : [artifactDir]);
  const runs = [];
  const docs = [];
  const skipped = [];

  for (const file of files) {
    const label = path.relative(process.cwd(), file);
    let doc;
    try {
      doc = JSON.parse(readFileSync(file, "utf8"));
    } catch (error) {
      skipped.push({ file: label, reason: `unparseable JSON (${error.message})` });
      continue;
    }
    if (!Array.isArray(doc.runs)) {
      skipped.push({ file: label, reason: "not a run document (no `runs` array)" });
      continue;
    }

    const snap = `${doc.today} · ${doc.catalog} options · ${doc.logEntries} log`;
    docs.push({
      file: label,
      query: doc.query,
      today: doc.today,
      snap,
      mode: doc.mode,
      reps: doc.reps,
      inProgress: doc.inProgress === true,
      count: doc.runs.length,
    });

    for (const run of doc.runs) {
      runs.push({
        file: label,
        query: doc.query,
        today: doc.today,
        snap,
        inProgress: doc.inProgress === true,
        label: run.label,
        model: run.model,
        effort: run.thinking?.effort ?? run.thinking?.type ?? "—",
        rep: run.rep,
        ok: run.ok,
        latencyMs: run.latencyMs,
        outputTokens: run.outputTokens,
        ranking: Array.isArray(run.ranking) ? run.ranking : [],
      });
    }
  }

  return { runs, docs, skipped };
}

/**
 * `loadRuns` with a readable message instead of a stack trace when a path is
 * wrong — a mistyped directory is the likeliest way to invoke these tools.
 */
export function loadRunsOrExit(paths) {
  try {
    return loadRuns(paths);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

/** Group by a key function, preserving insertion order. */
export function groupBy(items, keyOf) {
  const groups = new Map();
  for (const item of items) {
    const key = keyOf(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

/**
 * The largest set of runs that share one snapshot, plus how many were left
 * out. Every pooled measure goes through this: pooling across snapshots would
 * report a data change as a model difference.
 */
export function largestSnapshotGroup(runs) {
  const bySnap = groupBy(runs, (r) => r.snap);
  const groups = [...bySnap.entries()].sort((a, b) => b[1].length - a[1].length);
  if (!groups.length) return { snap: null, pooled: [], excluded: 0 };
  const [snap, pooled] = groups[0];
  return { snap, pooled, excluded: runs.length - pooled.length };
}
