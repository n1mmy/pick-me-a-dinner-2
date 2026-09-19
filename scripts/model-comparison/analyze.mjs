/**
 * Cross-cell analysis of AI-search model comparison runs.
 *
 *   node scripts/model-comparison/analyze.mjs                      # baseline
 *   node scripts/model-comparison/analyze.mjs runs-2027-03         # a later sweep
 *   node scripts/model-comparison/analyze.mjs . runs-2027-03 \
 *     --out=scripts/model-comparison/runs-2027-03/summary.md       # both, elsewhere
 *
 * Takes any mix of run files and directories (see `runs.mjs`); with no
 * arguments it reads this directory. Writes `summary.md` beside the inputs —
 * or wherever `--out=` points — and prints it.
 *
 * The measures below are deliberately MECHANICAL — they count things the
 * system prompt in `lib/ai-search.ts` states as explicit rules, so they can be
 * checked without judgment:
 *
 * - `dateRefs`   — the prompt forbids calendar dates, day counts, and
 *                  how-long-ago arithmetic in a rationale ("9 days ago",
 *                  "5/14", "since early September"). Each hit is a rule break.
 * - `nameOpens`  — the prompt forbids opening a rationale with the Option's
 *                  own name, since the household reads it right beside it.
 * - `emptyReasons` — in `pithy` tail mode an obviously bad pick should get an
 *                  EMPTY reason. A cell with none has flattened the tiering
 *                  the mode asks for.
 * - `meanChars` / `endsWithPeriod` — the prompt asks for one short clause, not
 *                  a sentence. Length and terminal punctuation are a proxy.
 *
 * Ranking *quality* is not scored: there is no ground truth for "what should we
 * eat tonight", so that stays a human read of `summary.md` and the rationales
 * in the run files themselves.
 *
 * Two rules hold every pooled number here honest, and both matter more as runs
 * accumulate across dates:
 *
 * - Reps pool only within one **snapshot identity** (`runs.mjs`). Ranking a
 *   different day's data is a different task, not a flakier model.
 * - A between-cell difference means something only if it exceeds that cell's
 *   own rep-to-rep noise, which is why the within-cell and between-cell
 *   ordering tables sit next to each other.
 */
import { statSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  artifactDir,
  groupBy,
  largestSnapshotGroup,
  loadRunsOrExit,
  parseArgs,
} from "./runs.mjs";

/**
 * Calendar dates, day counts, and how-long-ago arithmetic — the phrasings the
 * prompt rules out. Kept explicit rather than clever so a hit is auditable.
 *
 * Weekday names are deliberately NOT here: the prompt's own example of a good
 * rationale is "the standing Wednesday pick", so naming a day-of-week rhythm is
 * exactly what it asks for. Counting weekdays as breaks would penalise the
 * day-of-week pattern-finding that is the point of the feature (ADR-0005).
 * Likewise "just had it" / "overdue" are the sanctioned plain-words phrasings.
 */
const DATE_REF = new RegExp(
  [
    "\\byesterday\\b",
    "\\b(day|night|week|month)s? ago\\b",
    "\\bover (a|two|three) (week|month)s?\\b",
    "\\b(many|several|two|three) (week|month)s\\b",
    "\\bfor months\\b",
    "\\bsince (early|mid|late)\\b",
    "\\b(January|February|March|April|May|June|July|August|September|October|November|December)\\b",
    "\\b\\d{1,2}/\\d{1,2}\\b",
    "\\bthis (past )?week\\b",
    "\\bthis month\\b",
    "\\ba few days\\b",
    "\\btwo nights\\b",
  ].join("|"),
  "i",
);

/** First word of the Option name appearing as the rationale's first word. */
function opensWithName(name, reason) {
  if (!reason) return false;
  const firstNameWord = name.split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, "");
  const firstReasonWord = reason
    .split(/\s+/)[0]
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  return firstNameWord.length > 2 && firstNameWord === firstReasonWord;
}

/**
 * Vocabulary that names a *pattern* rather than restating recency. ADR-0005's
 * whole claim is that the AI path beats the deterministic recency sort by
 * finding habits; a rationale drawing on this vocabulary is at least reaching
 * for one. Weekday names count — "the standing Wednesday pick" is the prompt's
 * own model answer.
 */
const PATTERN_VOCAB = new RegExp(
  [
    "\\bcadence\\b",
    "\\brhythm\\b",
    "\\brotation\\b",
    "\\brotat",
    "\\b(weekly|monthly|fortnightly|biweekly)\\b",
    "\\bevery few\\b",
    "\\bstreak\\b",
    "\\bstanding\\b",
    "\\bdue\\b",
    "\\boverdue\\b",
    "\\bdrift",
    "\\bdropped out\\b",
    "\\bslipped out\\b",
    "\\bquota\\b",
    "\\bslot\\b",
    "\\bpick\\b",
    "\\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\\b",
    "\\bweeknight\\b",
    "\\bweekend\\b",
  ].join("|"),
  "i",
);

/** Clause joiners — the prompt asks for ONE clause, "never a compound of two". */
const COMPOUND = /( and | but |; | — |, though| while | plus |, and )/i;

/**
 * Cuisine keywords, for a name-vs-reason coherence check. A rationale that
 * names a cuisine the Option plainly is not is the flagrant failure mode (see
 * the Aji Ichi / "Mediterranean slot" row in finding 4). Options whose name
 * carries no cuisine, or more than one, are skipped rather than guessed at —
 * the check is built to avoid false positives, so a zero is weak evidence but
 * a hit is worth reading.
 *
 * This is the one table here coupled to the household's actual Catalog: the
 * per-cuisine words include restaurant-name fragments ("sofra", "beijing").
 * When the Catalog grows, extend it — an Option whose cuisine nothing here
 * matches is silently skipped, so a stale list under-reports rather than
 * lies. `summary.md` prints the coverage it achieved for exactly that reason.
 */
const CUISINES = {
  japanese: ["japanese", "sushi", "sashimi"],
  korean: ["korean", "kimchi", "tofu house"],
  mexican: ["mexican", "taqueria", "taco"],
  vietnamese: ["vietnamese", "pho"],
  italian: ["italian", "pasta", "pizza"],
  mediterranean: ["mediterranean", "falafel", "shawarma", "sofra"],
  peruvian: ["peruvian", "ceviche"],
  // "fried rice" is deliberately NOT a keyword: in this household it is a
  // cross-cutting constraint (Helen having had fried rice suppresses the
  // Korean, Vietnamese and Thai places alike), so every model cites it on
  // non-Chinese Options as correct reasoning. Treating it as a cuisine marker
  // made ~80% of this check's hits false positives.
  chinese: ["chinese", "beijing"],
  thai: ["thai"],
  indian: ["indian"],
  american: ["american", "burger"],
  ethiopian: ["ethiopian"],
};

function cuisinesIn(text) {
  const lower = text.toLowerCase();
  return Object.entries(CUISINES)
    .filter(([, words]) => words.some((w) => lower.includes(w)))
    .map(([cuisine]) => cuisine);
}

/** Pearson correlation, used for the reason-length-vs-rank gradient. */
function pearson(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return dx === 0 || dy === 0 ? null : num / Math.sqrt(dx * dy);
}

/**
 * Ranks of the Options both lists returned, renumbered 1..n **within that
 * shared set**.
 *
 * The renumbering is not cosmetic. Spearman's ρ and a mean displacement in
 * "places" are both defined over two permutations of the *same* n items; feed
 * them raw positions from lists of different depth — a narrowing query's
 * 8-Option shortlist against a 34-Option full list, or one rep that dropped an
 * Option — and the shared items carry positions from different scales. The
 * arithmetic then leaves the valid range entirely (a first pass printed a
 * Spearman of -30.5). Comparing within the shared set is the only comparison
 * the two lists actually support; how much each list left out is reported
 * separately, as depth in the per-run table.
 */
function commonRanks(orderA, orderB) {
  const setA = new Set(orderA);
  const setB = new Set(orderB);
  const commonA = orderA.filter((n) => setB.has(n));
  const commonB = orderB.filter((n) => setA.has(n));
  return {
    names: commonA,
    rankA: new Map(commonA.map((n, i) => [n, i + 1])),
    rankB: new Map(commonB.map((n, i) => [n, i + 1])),
  };
}

/**
 * Spearman rank correlation between two orderings, over the Options both
 * ranked. This is the "is the general ordering the same" measure — unlike a
 * top-5 overlap it sees the whole list, which is what someone scanning for
 * inspiration actually reads.
 */
function spearman(orderA, orderB) {
  const { names, rankA, rankB } = commonRanks(orderA, orderB);
  const n = names.length;
  if (n < 3) return null;
  let sumD2 = 0;
  for (const name of names) sumD2 += (rankA.get(name) - rankB.get(name)) ** 2;
  return 1 - (6 * sumD2) / (n * (n * n - 1));
}

/** Mean absolute rank displacement — "an Option moves this many places". */
function meanAbsDelta(orderA, orderB) {
  const { names, rankA, rankB } = commonRanks(orderA, orderB);
  if (!names.length) return null;
  return (
    names.reduce((acc, n) => acc + Math.abs(rankA.get(n) - rankB.get(n)), 0) /
    names.length
  );
}

/**
 * Set overlap of the first `k` of two orderings, as a fraction of the most it
 * could have been — `min(k, |A|, |B|)`, not `k`.
 *
 * The denominator matters at any depth past the list's length, which is the
 * normal case for a narrowing query: two *identical* 8-Option rankings share
 * all 8 at k=20, and dividing by 20 scored that 0.40 — printed directly under
 * a note asserting overlap@20 is "1.00 by construction" on a list that short.
 * Normalising by what the shorter list can offer makes the column mean the same
 * thing at every depth: 1.00 is full agreement over the range compared.
 */
function overlapAt(orderA, orderB, k) {
  const denom = Math.min(k, orderA.length, orderB.length);
  if (!denom) return 0;
  const b = new Set(orderB.slice(0, k));
  return orderA.slice(0, k).filter((n) => b.has(n)).length / denom;
}

/**
 * Every distinct pair to compare. Within one list that is the unordered pairs;
 * across two lists it is every cross pair. All the measures are symmetric, so
 * one helper serves the within-cell (rep-to-rep) and between-cell (model-to-
 * model) tables alike — and the two are then read on the same scale.
 */
function* pairsOf(listA, listB) {
  if (listA === listB) {
    for (let i = 0; i < listA.length; i++) {
      for (let j = i + 1; j < listA.length; j++) yield [listA[i], listA[j]];
    }
    return;
  }
  for (const a of listA) for (const b of listB) yield [a, b];
}

/** Mean Spearman / mean move / overlap@k over all pairs between two groups. */
function agreement(listA, listB) {
  let rhoSum = 0;
  let rhoN = 0;
  let deltaSum = 0;
  let deltaN = 0;
  let sharedSum = 0;
  const overlaps = { 5: 0, 10: 0, 20: 0 };
  let pairs = 0;
  for (const [a, b] of pairsOf(listA, listB)) {
    sharedSum += commonRanks(a.order, b.order).names.length;
    const rho = spearman(a.order, b.order);
    if (rho !== null) {
      rhoSum += rho;
      rhoN += 1;
    }
    const delta = meanAbsDelta(a.order, b.order);
    if (delta !== null) {
      deltaSum += delta;
      deltaN += 1;
    }
    for (const k of [5, 10, 20]) overlaps[k] += overlapAt(a.order, b.order, k);
    pairs += 1;
  }
  if (!pairs) return null;
  return {
    pairs,
    /**
     * Mean size of the shared set each pair was scored over. Spearman on 3
     * shared Options swings to ±1.00 on one swap, so this column is what keeps
     * a narrowing query's shortlist comparison from being read as strongly as
     * an open query's 35-Option one.
     */
    shared: sharedSum / pairs,
    rho: rhoN ? rhoSum / rhoN : null,
    delta: deltaN ? deltaSum / deltaN : null,
    overlap: Object.fromEntries(
      [5, 10, 20].map((k) => [k, overlaps[k] / pairs]),
    ),
  };
}

const { flags, positionals } = parseArgs(process.argv.slice(2));
const { runs: loaded, docs, skipped } = loadRunsOrExit(positionals);

if (!loaded.length) {
  console.error(
    `no runs found in ${positionals.length ? positionals.join(", ") : artifactDir}`,
  );
  for (const s of skipped) console.error(`  skipped ${s.file}: ${s.reason}`);
  process.exit(1);
}

/** Per-run metrics. One row per successful or failed model call. */
const cells = loaded.map((run) => {
  const reasons = run.ranking.map((r) => r.reason ?? "");
  const nonEmpty = reasons.filter((r) => r.trim() !== "");
  const dateHits = run.ranking.filter((r) => r.reason && DATE_REF.test(r.reason));
  return {
    ...run,
    returned: run.ranking.length,
    top5: run.ranking.slice(0, 5).map((r) => r.name),
    /** The whole ordering, for the scan-down-the-list measures. */
    order: run.ranking.map((r) => r.name),
    rows: run.ranking.map((r) => ({ name: r.name, reason: r.reason ?? "" })),
    emptyReasons: reasons.length - nonEmpty.length,
    dateRefs: dateHits.length,
    dateExamples: dateHits.slice(0, 3).map((r) => `${r.name}: "${r.reason}"`),
    nameOpens: run.ranking.filter((r) => opensWithName(r.name, r.reason)).length,
    meanChars: nonEmpty.length
      ? Math.round(nonEmpty.reduce((a, r) => a + r.length, 0) / nonEmpty.length)
      : 0,
    endsWithPeriod: nonEmpty.filter((r) => r.trim().endsWith(".")).length,
  };
});

cells.sort(
  (a, b) =>
    a.query.localeCompare(b.query) ||
    a.label.localeCompare(b.label) ||
    a.rep - b.rep,
);

const out = [];
out.push("# Cross-cell analysis", "");
out.push(
  "Generated by `node scripts/model-comparison/analyze.mjs`. Mechanical rule-",
  "adherence counts only — ranking quality is a human read (see `README.md`).",
  "",
);

// --- Run manifest -------------------------------------------------------
// What went into this report, named up front. Once runs accumulate over
// several dates, "which files and which snapshots" is the first thing a reader
// needs — a pooled number over two anchor days would be meaningless, and the
// warnings below are how that gets caught rather than averaged away.
out.push("## Runs in this report", "");
out.push(
  "| source | query | runs | snapshot | mode |",
  "|---|---|---|---|---|",
);
for (const doc of docs) {
  out.push(
    `| \`${doc.file}\`${doc.inProgress ? " ⚠️ partial" : ""} | ${
      doc.query === "(empty)" ? "_(empty)_" : `"${doc.query}"`
    } | ${doc.count}${
      doc.duplicates.length ? ` _(+${doc.duplicates.length} dup)_` : ""
    } | ${doc.snap} | ${doc.mode ?? "—"} |`,
  );
}
out.push("");

// A merged file read alongside the sweep files it was built from — the state of
// the directory between `merge-runs.mjs` and the `git rm` it tells you to run —
// would otherwise count every run twice, inflating `n` and pulling each cell's
// rep-to-rep agreement toward a run's correlation with itself.
const dupDocs = docs.filter((d) => d.duplicates.length);
if (dupDocs.length) {
  out.push(
    "⚠️ **Duplicate runs de-duplicated.** Some runs appear in more than one",
    "input file — a merge and its own sources, most likely. Each was counted",
    "once, from the first file it was read out of:",
    "",
  );
  for (const doc of dupDocs) {
    const from = [...new Set(doc.duplicates.map((d) => d.firstSeenIn))];
    out.push(
      `- \`${doc.file}\` — ${doc.duplicates.length} run(s) already read from ` +
        `${from.map((f) => `\`${f}\``).join(", ")}`,
    );
  }
  out.push(
    "",
    "Once the merged file is checked, `git rm` the sources and this goes away.",
    "",
  );
}

const snapshots = [...new Set(loaded.map((r) => r.snap))];
if (snapshots.length > 1) {
  out.push(
    `⚠️ **${snapshots.length} distinct snapshots** in this set. Pooled measures`,
    "use the largest single-snapshot group per cell and report what they",
    "excluded; nothing is averaged across snapshots.",
    "",
  );
  for (const snap of snapshots) out.push(`- ${snap}`);
  out.push("");
}
if (docs.some((d) => d.inProgress)) {
  out.push(
    "⚠️ A source is marked `inProgress` — an aborted or still-running sweep.",
    "Its finished runs are valid; its missing cells are simply absent.",
    "",
  );
}
if (skipped.length) {
  out.push("Skipped:", "");
  for (const s of skipped) out.push(`- \`${s.file}\` — ${s.reason}`);
  out.push("");
}

const queries = [...new Set(cells.map((c) => c.query))];

for (const query of queries) {
  out.push(`## Query: ${query === "(empty)" ? "_(empty — open query)_" : `"${query}"`}`, "");
  out.push(
    "| cell | source | rep | ok | latency | out tok | rows | empty reasons | date refs | name opens | mean chars | ends with `.` |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|",
  );
  for (const c of cells.filter((c) => c.query === query)) {
    out.push(
      `| ${c.label} | \`${c.file}\` | ${c.rep} | ${
        c.ok ? "yes" : "**NO**"
      } | ${(c.latencyMs / 1000).toFixed(1)}s | ${c.outputTokens ?? "—"} | ${
        c.returned
      } | ${c.emptyReasons} | ${c.dateRefs} | ${c.nameOpens} | ${
        c.meanChars
      } | ${c.endsWithPeriod} |`,
    );
  }
  out.push("");

  out.push("### Top 5", "");
  for (const c of cells.filter((c) => c.query === query)) {
    if (!c.ok) {
      out.push(`- **${c.label}** (${c.file}, rep ${c.rep}) — no result`);
      continue;
    }
    out.push(
      `- **${c.label}** (${c.file}, rep ${c.rep}) — ${c.top5.join(" · ")}`,
    );
  }
  out.push("");

  // Rep-to-rep stability separates model difference from nondeterminism.
  // Pooled across files, because reps of one cell accumulate over several runs
  // — but only within a single snapshot identity. The largest matching group
  // wins and anything on another snapshot is reported as excluded rather than
  // silently averaged in.
  const queryCells = cells.filter((c) => c.query === query);
  const byLabel = groupBy(queryCells, (c) => c.label);
  /** Label → the pooled, same-snapshot, successful reps used by every measure. */
  const pooledByLabel = new Map();
  for (const [label, runs] of byLabel) {
    const { snap, pooled, excluded } = largestSnapshotGroup(
      runs.filter((r) => r.ok),
    );
    pooledByLabel.set(label, { snap, pooled, excluded, attempted: runs.length });
  }

  out.push("### Pooled rep stability", "");
  out.push(
    "Mean pairwise top-5 overlap over every rep of a cell that ranked the same",
    "snapshot. `n` is how many successful reps pooled.",
    "",
  );
  for (const [label, { snap, pooled, excluded, attempted }] of pooledByLabel) {
    if (pooled.length < 2) {
      out.push(
        `- **${label}** — not measurable (${pooled.length} usable of ` +
          `${attempted} rep(s)${excluded ? `, ${excluded} on another snapshot` : ""})`,
      );
      continue;
    }

    let overlapSum = 0;
    let pairs = 0;
    for (const [a, b] of pairsOf(pooled, pooled)) {
      overlapSum += a.top5.filter((n) => b.top5.includes(n)).length;
      pairs += 1;
    }
    const meanOverlap = (overlapSum / pairs).toFixed(1);

    // #1 agreement: a cell that cannot hold its top pick across reps is the
    // one the household would notice.
    const firstCounts = groupBy(pooled, (r) => r.top5[0]);
    const [modalFirst, modalRuns] = [...firstCounts.entries()].sort(
      (a, b) => b[1].length - a[1].length,
    )[0];

    out.push(
      `- **${label}** — n=${pooled.length}, mean overlap **${meanOverlap}/5**, ` +
        `#1 held ${modalRuns.length}/${pooled.length} (${modalFirst})` +
        (excluded ? `  _[${excluded} rep(s) excluded: other snapshot]_` : ""),
    );
    out.push(`  - snapshot: ${snap}`);
    out.push(
      `  - sources: ${[...new Set(pooled.map((r) => r.file))].join(", ")}`,
    );
  }
  out.push("");

  // --- Ordering agreement over the WHOLE list -------------------------
  // Top-5 overlap answers "is the headline pick stable". Someone scanning the
  // list for inspiration reads much further down, so these measure the
  // ordering as a whole: Spearman over every shared Option, the average number
  // of places an Option moves between runs, and overlap at increasing depth.
  out.push("### Ordering agreement within a cell (rep to rep)", "");
  out.push(
    "| cell | n | shared | Spearman | mean move | overlap@5 | overlap@10 | overlap@20 |",
    "|---|---|---|---|---|---|---|---|",
  );
  const fmt = (v) => (v === null || v === undefined ? "—" : v.toFixed(2));
  /** Label → within-cell agreement, reused as the noise floor below. */
  const withinByLabel = new Map();
  for (const [label, { pooled }] of pooledByLabel) {
    const stats = pooled.length >= 2 ? agreement(pooled, pooled) : null;
    withinByLabel.set(label, stats);
    if (!stats) {
      out.push(`| ${label} | ${pooled.length} | — | — | — | — | — | — |`);
      continue;
    }
    out.push(
      `| ${label} | ${pooled.length} | ${stats.shared.toFixed(0)} | ${fmt(stats.rho)} | ` +
        `${stats.delta === null ? "—" : stats.delta.toFixed(1)} places | ` +
        `${fmt(stats.overlap[5])} | ${fmt(stats.overlap[10])} | ` +
        `${fmt(stats.overlap[20])} |`,
    );
  }
  out.push("");
  // Overlap@k has a high floor: picking k of N at random already agrees k/N
  // of the time, so overlap@20 on a ~34-Option list cannot drop below ~0.59
  // however scrambled the ordering is. Stating the floor keeps the deep
  // columns from reading as agreement they have not earned.
  const okCells = queryCells.filter((c) => c.ok);
  const listLen = Math.round(
    okCells.reduce((a, c) => a + c.returned, 0) / Math.max(1, okCells.length),
  );
  // A depth at or past the list length compares two copies of the same set,
  // so its overlap is 1.00 by construction and carries no information.
  const baseline = [5, 10, 20]
    .map((k) =>
      k >= listLen
        ? `overlap@${k} = 1.00 by construction (list is only ~${listLen} long)`
        : `overlap@${k} ≈ ${(k / listLen).toFixed(2)}`,
    )
    .join(", ");
  out.push(
    "Spearman 1.00 = identical ordering, 0 = unrelated. `mean move` is how",
    "many places the average Option shifts between two runs of that cell,",
    "counted over the Options both runs returned (`shared`).",
    "",
    `Chance baseline: the list averages ~${listLen} Options, so random`,
    `orderings already score ${baseline}.`,
    "Read the deep columns against that floor, not against 1.00 — Spearman",
    "and `mean move` are the honest whole-list measures.",
    "",
  );

  // --- Between-cell ordering agreement --------------------------------
  // The comparison question proper: do two cells rank the list the same way?
  // Only meaningful against the within-cell numbers above — a between-cell
  // Spearman at or above both cells' own rep-to-rep figure means the two are
  // indistinguishable at this sample size, however different the top 5 looks.
  const crossLabels = [...pooledByLabel.entries()].filter(
    ([, v]) => v.pooled.length >= 1,
  );
  if (crossLabels.length >= 2) {
    out.push("### Ordering agreement between cells", "");
    out.push(
      "| cell A | cell B | pairs | shared | Spearman | mean move | overlap@5 | vs own noise |",
      "|---|---|---|---|---|---|---|---|",
    );
    const rows = [];
    for (let i = 0; i < crossLabels.length; i++) {
      for (let j = i + 1; j < crossLabels.length; j++) {
        const [labelA, a] = crossLabels[i];
        const [labelB, b] = crossLabels[j];
        // Cells that ranked different snapshots are not comparable at all.
        if (a.snap !== b.snap) {
          rows.push({
            labelA,
            labelB,
            rho: null,
            note: "different snapshots — not comparable",
          });
          continue;
        }
        const stats = agreement(a.pooled, b.pooled);
        if (!stats) continue;
        // The floor: the weaker of the two cells' own rep-to-rep agreement.
        const withinA = withinByLabel.get(labelA)?.rho;
        const withinB = withinByLabel.get(labelB)?.rho;
        const floor =
          withinA != null && withinB != null
            ? Math.min(withinA, withinB)
            : (withinA ?? withinB ?? null);
        const note =
          floor === null
            ? "no within-cell baseline"
            : stats.rho >= floor
              ? `**indistinguishable** (own noise ${floor.toFixed(2)})`
              : `separated by ${(floor - stats.rho).toFixed(2)}`;
        rows.push({ labelA, labelB, stats, note });
      }
    }
    rows.sort((x, y) => (y.stats?.rho ?? -Infinity) - (x.stats?.rho ?? -Infinity));
    for (const r of rows) {
      if (!r.stats) {
        out.push(`| ${r.labelA} | ${r.labelB} | — | — | — | — | — | ${r.note} |`);
        continue;
      }
      out.push(
        `| ${r.labelA} | ${r.labelB} | ${r.stats.pairs} | ` +
          `${r.stats.shared.toFixed(0)} | ${fmt(r.stats.rho)} | ` +
          `${r.stats.delta === null ? "—" : r.stats.delta.toFixed(1)} places | ` +
          `${fmt(r.stats.overlap[5])} | ${r.note} |`,
      );
    }
    out.push("");
    out.push(
      "Every rep of A against every rep of B, on the snapshot both share.",
      "`shared` is the mean number of Options both lists returned — the set the",
      "pair was scored over. On a shortlist of 3-5 shared Options, Spearman",
      "swings to ±1.00 on a single swap; read those rows as anecdote.",
      "`vs own noise` compares the pair's Spearman against the *weaker* of the",
      "two cells' own rep-to-rep Spearman: at or above it, the two cells order",
      "the list no more differently than one of them differs from itself, and",
      "any ranking difference between them is not yet evidence of anything.",
      "",
    );
  }

  // --- Reason quality -------------------------------------------------
  out.push("### Reason quality", "");
  out.push(
    "| cell | rep | pattern vocab | compound | len gradient | repeated | empty at rank | cuisine conflicts |",
    "|---|---|---|---|---|---|---|---|",
  );
  const conflictRows = [];
  const qualityRows = [];
  let cuisineKnown = 0;
  let cuisineTotal = 0;
  for (const c of queryCells) {
    if (!c.ok) continue;
    const nonEmpty = c.rows.filter((r) => r.reason.trim() !== "");
    const patternShare = nonEmpty.length
      ? nonEmpty.filter((r) => PATTERN_VOCAB.test(r.reason)).length /
        nonEmpty.length
      : 0;
    const compoundShare = nonEmpty.length
      ? nonEmpty.filter((r) => COMPOUND.test(r.reason)).length / nonEmpty.length
      : 0;
    // Pithy mode wants the rationale to SHRINK down the ranking, so a
    // negative gradient is the prompt being followed.
    const gradient = pearson(
      c.rows.map((_, i) => i + 1),
      c.rows.map((r) => r.reason.length),
    );
    const distinct = new Set(nonEmpty.map((r) => r.reason.trim().toLowerCase()));
    const repeated = nonEmpty.length - distinct.size;
    // Where the empty reasons sit, as a fraction of list depth: 1.0 means
    // they are all at the very bottom, which is the intended tiering.
    const emptyIdx = c.rows
      .map((r, i) => (r.reason.trim() === "" ? (i + 1) / c.rows.length : null))
      .filter((v) => v !== null);
    const emptyAt = emptyIdx.length
      ? (emptyIdx.reduce((a, b) => a + b, 0) / emptyIdx.length).toFixed(2)
      : "—";

    let conflicts = 0;
    for (const [i, r] of c.rows.entries()) {
      if (!r.reason.trim()) continue;
      const nameCuisines = cuisinesIn(r.name);
      cuisineTotal += 1;
      if (nameCuisines.length !== 1) continue;
      cuisineKnown += 1;
      const reasonCuisines = cuisinesIn(r.reason);
      if (!reasonCuisines.length) continue;
      if (!reasonCuisines.includes(nameCuisines[0])) {
        conflicts += 1;
        conflictRows.push(
          `${c.label} (${c.file}, rep ${c.rep}) #${i + 1} ${r.name} ` +
            `[${nameCuisines[0]}] → "${r.reason}" [${reasonCuisines.join("/")}]`,
        );
      }
    }

    qualityRows.push({
      label: c.label,
      patternShare,
      compoundShare,
      gradient,
      repeated,
      emptyAt: emptyIdx.length
        ? emptyIdx.reduce((a, b) => a + b, 0) / emptyIdx.length
        : null,
      conflicts,
    });

    out.push(
      `| ${c.label} | ${c.rep} | ${(patternShare * 100).toFixed(0)}% | ` +
        `${(compoundShare * 100).toFixed(0)}% | ` +
        `${gradient === null ? "—" : gradient.toFixed(2)} | ${repeated} | ` +
        `${emptyAt} | ${conflicts} |`,
    );
  }
  out.push("");

  // Per-cell means, so the comparison is not eyeballed across reps.
  out.push("#### Reason quality — per-cell means", "");
  out.push(
    "| cell | reps | pattern vocab | compound | len gradient | repeated | empty at rank | conflicts |",
    "|---|---|---|---|---|---|---|---|",
  );
  const qualityByLabel = groupBy(qualityRows, (r) => r.label);
  const mean = (values) => {
    const nums = values.filter((v) => v !== null && v !== undefined);
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
  };
  for (const [label, rs] of qualityByLabel) {
    const g = mean(rs.map((r) => r.gradient));
    const e = mean(rs.map((r) => r.emptyAt));
    out.push(
      `| ${label} | ${rs.length} | ` +
        `${(mean(rs.map((r) => r.patternShare)) * 100).toFixed(0)}% | ` +
        `${(mean(rs.map((r) => r.compoundShare)) * 100).toFixed(0)}% | ` +
        `${g === null ? "—" : g.toFixed(2)} | ` +
        `${mean(rs.map((r) => r.repeated)).toFixed(1)} | ` +
        `${e === null ? "—" : e.toFixed(2)} | ` +
        `${rs.reduce((a, r) => a + r.conflicts, 0)} |`,
    );
  }
  out.push("");
  out.push(
    "`pattern vocab` = share of non-empty reasons reaching for habit language",
    "(cadence / rotation / weekday / overdue). `compound` = share joining two",
    "clauses, which the prompt forbids. `len gradient` = correlation of reason",
    "length with rank; negative means reasons shrink down the list as `pithy`",
    "mode asks. `repeated` = non-empty reasons that are verbatim duplicates of",
    "another. `empty at rank` = mean depth of the empty reasons (1.0 = all at",
    "the bottom). `cuisine conflicts` = rows whose reason names a cuisine the",
    "Option's own name contradicts.",
    "",
  );
  if (cuisineTotal) {
    // A stale CUISINES table under-reports silently; this line is how that
    // shows up. A low share means the conflict column is mostly blind, not
    // that the models were coherent.
    out.push(
      `Cuisine check coverage: ${((cuisineKnown / cuisineTotal) * 100).toFixed(0)}% ` +
        `of rows (${cuisineKnown}/${cuisineTotal}) have exactly one recognised ` +
        "cuisine in the Option name and could be checked at all. Extend " +
        "`CUISINES` in `analyze.mjs` when the Catalog grows.",
      "",
    );
  }
  if (conflictRows.length) {
    out.push("#### Cuisine conflicts (verify by hand — heuristic)", "");
    for (const row of conflictRows) out.push(`- ${row}`);
    out.push("");
  }

  const withDates = queryCells.filter((c) => c.dateRefs > 0);
  if (withDates.length) {
    out.push("### Date / day-count rule breaks (examples)", "");
    for (const c of withDates) {
      out.push(`- **${c.label}** (rep ${c.rep}), ${c.dateRefs} hits:`);
      for (const ex of c.dateExamples) out.push(`  - ${ex}`);
    }
    out.push("");
  }
}

// Default the report next to its inputs: a later sweep given as its own
// directory gets its own `summary.md` rather than overwriting the baseline's.
// Anything else — several inputs, a single file, no argument — writes here.
function defaultOutDir() {
  if (positionals.length !== 1) return artifactDir;
  const only = path.resolve(positionals[0]);
  try {
    return statSync(only).isDirectory() ? only : artifactDir;
  } catch {
    return artifactDir;
  }
}
const outPath = flags.get("out")
  ? path.resolve(flags.get("out"))
  : path.join(defaultOutDir(), "summary.md");
const text = out.join("\n");
writeFileSync(outPath, text);
console.log(text);
console.log(`\nwrote ${outPath}`);
