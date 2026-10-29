/**
 * Diff two backtest JSON files from scripts/backtest.ts (any ranker) over the
 * same day list. The read comes first: each day's top 10 and brief from both
 * runs, one under the other, with the Pick and any too-soon Rejection marked
 * on its row — a prompt change is judged by reading days, and the numbers are
 * context (issue 02). Then the aggregates side by side; the text counts —
 * how many top-10 rows state elapsed time, use a snapshot word, leak a code,
 * open with the name, quote the household, and so on, with coverage per run
 * (issue 14); per-day rank of the Pick and top-N overlap, hit flips, top-5
 * occupancy per Option, top-5 slots spent on Options never eaten in the
 * window, and empty top-10 reasons.
 *
 *   npx tsx scripts/backtest-compare.ts <a.json> <b.json>
 */
import { readFileSync } from "node:fs";

type Row = { rank: number; name: string; reason: string };
type Day = {
  day: string;
  weekday: string;
  picks: Array<string | { optionName?: string; name?: string }>;
  bestRank: number | null;
  ranking: Row[];
  hit3: boolean;
  hit5: boolean;
  hit10: boolean;
  tooSoonMisses: Array<{ name?: string; optionName?: string; rank?: number; reason?: string }>;
  candidates: number;
  latencyMs: number;
  outputTokens?: number;
  dayNote?: string | null;
  brief?: string;
};
type Run = { meta: Record<string, string>; aggregate: Record<string, unknown>; results: Day[] };

const [aPath, bPath] = process.argv.slice(2);
if (!aPath || !bPath) {
  console.error("usage: npx tsx scripts/backtest-compare.ts <a.json> <b.json>");
  process.exit(2);
}
const A = JSON.parse(readFileSync(aPath, "utf8")) as Run;
const B = JSON.parse(readFileSync(bPath, "utf8")) as Run;

const pickName = (p: Day["picks"][number]) => (typeof p === "string" ? p : p.optionName ?? p.name ?? "?");
const topN = (d: Day, n: number) => d.ranking.filter((r) => r.rank <= n).map((r) => r.name);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const fmt = (x: number, digits = 1) => x.toFixed(digits);

const daysA = new Map(A.results.map((d) => [d.day, d]));
const days = B.results.filter((d) => daysA.has(d.day));
if (days.length !== A.results.length || days.length !== B.results.length) {
  console.log(`! day lists differ: A ${A.results.length}, B ${B.results.length}, shared ${days.length}`);
}
const mismatch = days.filter((d) => daysA.get(d.day)!.candidates !== d.candidates);
if (mismatch.length) {
  console.log(`! candidate counts differ on ${mismatch.map((d) => d.day).join(", ")} — different DB or catalog`);
}

console.log(`A: ${aPath}  (${A.meta.model ?? A.meta.ranker}, effort ${A.meta.effort ?? "?"}, ${A.meta.tailMode ?? ""}, prompt v${A.meta.promptVersion ?? "?"})`);
console.log(`B: ${bPath}  (${B.meta.model ?? B.meta.ranker}, effort ${B.meta.effort ?? "?"}, ${B.meta.tailMode ?? ""}, prompt v${B.meta.promptVersion ?? "?"})`);

// The read: both runs' top 10 and brief per day. Markers on a row: ★ the
// Pick; [too-soon] an Option rejected that day as too soon; [empty] no
// reason.
console.log("\n=== the read: top 10 and brief per day, A then B ===");
const markers = (d: Day, row: Row): string => {
  const picks = new Set(d.picks.map(pickName));
  const out: string[] = [];
  if (picks.has(row.name)) out.push("★");
  if (d.tooSoonMisses.some((m) => (m.name ?? m.optionName) === row.name)) out.push("[too-soon]");
  if (!row.reason?.trim()) out.push("[empty]");
  return out.length ? ` ${out.join(" ")}` : "";
};
const printRun = (label: string, d: Day) => {
  console.log(`  ${label}`);
  if (d.brief !== undefined) {
    console.log(`    brief: ${d.brief || "(SKIPPED)"}`);
  }
  for (const row of d.ranking.filter((r) => r.rank <= 10)) {
    console.log(`    ${String(row.rank).padStart(2)}. ${row.name}${markers(d, row)}`);
    console.log(`        ${row.reason || "(empty)"}`);
  }
  const pickRows = d.ranking.filter((r) => r.rank > 10 && d.picks.map(pickName).includes(r.name));
  for (const row of pickRows) {
    console.log(`    ${String(row.rank).padStart(2)}. ${row.name}${markers(d, row)}`);
    console.log(`        ${row.reason || "(empty)"}`);
  }
};
for (const b of days) {
  const a = daysA.get(b.day)!;
  console.log(`\n${b.day} (${b.weekday}) — ate ${b.picks.map(pickName).join(" + ")}${b.dayNote ? ` — day note: ${b.dayNote}` : ""}`);
  printRun("A", a);
  printRun("B", b);
}

console.log("\n=== aggregate ===");
const aggKeys = ["hit3", "hit5", "hit10", "meanRank", "medianRank", "daysWithTooSoonMiss"];
for (const k of aggKeys) console.log(`${k.padEnd(22)} ${String(A.aggregate[k]).padStart(6)} ${String(B.aggregate[k]).padStart(6)}`);
console.log(`${"latency s (mean)".padEnd(22)} ${fmt(mean(A.results.map((d) => d.latencyMs)) / 1000).padStart(6)} ${fmt(mean(B.results.map((d) => d.latencyMs)) / 1000).padStart(6)}`);
console.log(`${"output tokens (mean)".padEnd(22)} ${fmt(mean(A.results.map((d) => d.outputTokens ?? 0)), 0).padStart(6)} ${fmt(mean(B.results.map((d) => d.outputTokens ?? 0)), 0).padStart(6)}`);

// The text: the prose faults the prompt reads are judged on, counted the
// same way for every version (issue 14; the v17 reads each counted in a
// script of their own). Each is the number of shared-day top-10 rows the
// pattern hits, so a run's counts compare to another's on the same days;
// coverage is over the whole file, so a missing day is a coverage fact and
// not a prose score. A run file holds no codes and no list of the
// household's names, so those two counters are heuristics — a one- or
// two-letter capital word, and a word the runs themselves write capitalised
// mid-sentence — and print their rows for the eye to discard false hits.
const NUMBER_WORD =
  "(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|a few|a couple of|several)";
const ELAPSED = new RegExp(
  [
    // a count of days/weeks/months, unless it is a rhythm ("every two weeks") or a horizon ("two days out")
    `(?<!every )(?<!about every )(?<!every about )(?<!a-half-)(?<!and-a-half )\\b${NUMBER_WORD}[\\s-]+(?:full\\s+)?(?:days?|weeks?|months?)\\b(?![\\s-]+(?:out|ahead|from now|pace|minimum|gap|rhythm|window|cadence|apart))`,
    "\\bdays? ago\\b", "\\bweeks? ago\\b", "\\blast night\\b", "\\byesterday\\b", "\\bdays since\\b", "\\bat \\d+\\b",
    "\\b\\d+\\s*(?:,\\s*\\d+){2,}\\b", // a gap list as written: 21,21,14,6
    "\\b\\d+(?:–|-to-|-)\\d+\\b", // a gap range as written: 12-to-29, 12–16
  ].join("|"),
  "i",
);
const SNAPSHOT_WORD = /\b(?:tags?|tagged|gaps?|paces?|cadence|rhythms?|spacing)\b/i;
const CODE_WORD = /(?<![\w'’.])(?!A\b|I\b)[A-Z]{1,2}(?![\w'’.&-])/;
const WEEKDAY = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\b/i;
const STAND_IN_OPENER = /^(?:the|this|that|a|an|their)\s+(?:\S+\s+){0,3}(?:pick|option|choice|standby|staple|favou?rite|spot|place|habit)\b/i;
const AFTER_OPENER = /^after\b/i;
const QUOTE = /["“]\w[^"”]{3,}["”]/;
const NO_NOTE = /\bno (?:special |day |specific |particular )?note\b/i;
const strip = (s: string) => s.trim().replace(/^["'“‘]+/, "");
const opensWithName = (name: string, reason: string): boolean => {
  const r = strip(reason);
  if (r.toLowerCase().startsWith(name.toLowerCase())) return true;
  const [first, ...rest] = name.split(" ");
  return rest.length > 0 && first.length >= 4 && r.startsWith(first);
};
// Words either run writes capitalised mid-sentence three or more times, less
// weekdays, months, the snapshot's own nouns, and any word of an Option's
// name (so "frozen food" in prose is not a lowercase "Frozen food").
const STOP_WORDS = new Set("Option Options Log Day Catalog Tag Tags Pick Picks Rejection Rejections Note Notes Household".split(" "));
const DATE_WORD = /^(?:(?:mon|tues|wednes|thurs|fri|satur|sun)(?:day)?s?|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)$/i;
const optionWords = new Set(
  [...A.results, ...B.results].flatMap((d) => d.ranking.flatMap((r) => r.name.toLowerCase().split(/[^a-z]+/))),
);
const nameCounts = new Map<string, number>();
for (const d of [...A.results, ...B.results]) {
  for (const text of [...d.ranking.map((r) => r.reason ?? ""), d.brief ?? ""]) {
    for (const m of text.matchAll(/(?<=[^.!?:"“”]\s)([A-Z][a-z]{2,})\b/g)) {
      if (!STOP_WORDS.has(m[1]) && !DATE_WORD.test(m[1]) && !optionWords.has(m[1].toLowerCase())) nameCounts.set(m[1], (nameCounts.get(m[1]) ?? 0) + 1);
    }
  }
}
const properNouns = [...nameCounts].filter(([, n]) => n >= 3).map(([w]) => w).sort();
const LOWERCASE_NAME = properNouns.length ? new RegExp(`\\b(?:${properNouns.map((w) => w.toLowerCase()).join("|")})\\b`) : /$^/;

const ROW_COUNTERS: Array<[string, (row: Row, d: Day) => boolean]> = [
  ["states elapsed time", (r) => ELAPSED.test(r.reason ?? "")],
  ["snapshot word", (r) => SNAPSHOT_WORD.test(r.reason ?? "")],
  ["code as a word", (r) => CODE_WORD.test(r.reason ?? "")],
  ["lowercase name", (r) => LOWERCASE_NAME.test(r.reason ?? "")],
  ["opens with the name", (r) => opensWithName(r.name, r.reason ?? "")],
  ["opens with a stand-in", (r) => STAND_IN_OPENER.test(strip(r.reason ?? ""))],
  ['opens "After…"', (r) => AFTER_OPENER.test(strip(r.reason ?? ""))],
  ["quotes the household", (r) => QUOTE.test(r.reason ?? "")],
  ["names a weekday", (r) => WEEKDAY.test(r.reason ?? "")],
  ["names another weekday", (r, d) => [...(r.reason ?? "").matchAll(new RegExp(WEEKDAY.source, "gi"))].some((m) => m[1].toLowerCase() !== d.weekday.toLowerCase())],
];
const BRIEF_COUNTERS: Array<[string, (brief: string, d: Day) => boolean]> = [
  ["states elapsed time", (b) => ELAPSED.test(b)],
  ["snapshot word", (b) => SNAPSHOT_WORD.test(b)],
  ["code as a word", (b) => CODE_WORD.test(b)],
  ["lowercase name", (b) => LOWERCASE_NAME.test(b)],
  ["names a weekday", (b) => WEEKDAY.test(b)],
  ["announces no Day note", (b) => NO_NOTE.test(b)],
];
const shared = new Set(days.map((d) => d.day));
const topRows = (run: Run) => run.results.filter((d) => shared.has(d.day)).flatMap((d) => d.ranking.filter((r) => r.rank <= 10).map((r) => [r, d] as const));
const briefs = (run: Run) => run.results.filter((d) => shared.has(d.day) && d.brief !== undefined).map((d) => [d.brief ?? "", d] as const);
const rowsA = topRows(A), rowsB = topRows(B);
const briefsA = briefs(A), briefsB = briefs(B);
console.log(`\n=== the text: top-10 rows of the ${days.length} shared days hit by each pattern (A ${rowsA.length} rows, B ${rowsB.length}) ===`);
for (const [label, hit] of ROW_COUNTERS) {
  console.log(`${label.padEnd(24)} ${String(rowsA.filter(([r, d]) => hit(r, d)).length).padStart(6)} ${String(rowsB.filter(([r, d]) => hit(r, d)).length).padStart(6)}`);
}
console.log(`${"row length (mean chars)".padEnd(24)} ${fmt(mean(rowsA.map(([r]) => (r.reason ?? "").length)), 0).padStart(6)} ${fmt(mean(rowsB.map(([r]) => (r.reason ?? "").length)), 0).padStart(6)}`);
console.log(`${"top-5 length (mean)".padEnd(24)} ${fmt(mean(rowsA.filter(([r]) => r.rank <= 5).map(([r]) => (r.reason ?? "").length)), 0).padStart(6)} ${fmt(mean(rowsB.filter(([r]) => r.rank <= 5).map(([r]) => (r.reason ?? "").length)), 0).padStart(6)}`);
if (briefsA.length || briefsB.length) {
  console.log(`\n--- briefs (A ${briefsA.length}, B ${briefsB.length}) ---`);
  for (const [label, hit] of BRIEF_COUNTERS) {
    console.log(`${label.padEnd(24)} ${String(briefsA.filter(([b, d]) => hit(b, d)).length).padStart(6)} ${String(briefsB.filter(([b, d]) => hit(b, d)).length).padStart(6)}`);
  }
  console.log(`${"brief length (mean words)".padEnd(24)} ${fmt(mean(briefsA.map(([b]) => b.split(/\s+/).filter(Boolean).length)), 0).padStart(6)} ${fmt(mean(briefsB.map(([b]) => b.split(/\s+/).filter(Boolean).length)), 0).padStart(6)}`);
}
console.log(`names read from the runs (capitalised mid-sentence 3+ times): ${properNouns.join(", ") || "none"}`);
const usable = (run: Run) => run.results.filter((d) => d.ranking.length > 0);
const omitted = (run: Run) => usable(run).reduce((acc, d) => acc + Math.max(0, d.candidates - d.ranking.length), 0);
const briefless = (run: Run) => usable(run).filter((d) => d.brief !== undefined && !d.brief).length;
console.log(`coverage: A ${usable(A).length}/${A.results.length} days usable, ${briefless(A)} briefless, ${omitted(A)} candidate rows omitted · B ${usable(B).length}/${B.results.length} days usable, ${briefless(B)} briefless, ${omitted(B)} candidate rows omitted`);
const printHits = (label: string, hit: (row: Row, d: Day) => boolean) => {
  const hits = [...rowsA.map(([r, d]) => ["A", r, d] as const), ...rowsB.map(([r, d]) => ["B", r, d] as const)].filter(([, r, d]) => hit(r, d));
  if (!hits.length) return;
  console.log(`\n--- ${label}: the rows, for the eye ---`);
  for (const [run, r, d] of hits) console.log(`${run} ${d.day} #${r.rank} ${r.name}: ${(r.reason ?? "").slice(0, 160)}${(r.reason ?? "").length > 160 ? "…" : ""}`);
};
printHits("code as a word", (r) => CODE_WORD.test(r.reason ?? ""));
printHits("lowercase name", (r) => LOWERCASE_NAME.test(r.reason ?? ""));

console.log("\n=== per day ===");
console.log("day         wk   rankA rankB  Δ   ov3 ov5 ov10 same#1  tooSoon A/B  pick");
const ov3s: number[] = [], ov5s: number[] = [], ov10s: number[] = [];
let same1 = 0;
const flips = { h3: { gain: [] as string[], loss: [] as string[] }, h5: { gain: [] as string[], loss: [] as string[] }, h10: { gain: [] as string[], loss: [] as string[] } };
for (const b of days) {
  const a = daysA.get(b.day)!;
  const ov = (n: number) => topN(b, n).filter((x) => topN(a, n).includes(x)).length;
  const o3 = ov(3), o5 = ov(5), o10 = ov(10);
  ov3s.push(o3); ov5s.push(o5); ov10s.push(o10);
  const s1 = topN(a, 1)[0] === topN(b, 1)[0];
  if (s1) same1++;
  for (const [key, n] of [["h3", 3], ["h5", 5], ["h10", 10]] as const) {
    const ha = a.bestRank !== null && a.bestRank <= n;
    const hb = b.bestRank !== null && b.bestRank <= n;
    if (!ha && hb) flips[key].gain.push(b.day);
    if (ha && !hb) flips[key].loss.push(b.day);
  }
  const delta = a.bestRank !== null && b.bestRank !== null ? b.bestRank - a.bestRank : null;
  console.log(
    `${b.day} ${b.weekday.slice(0, 3)}  ${String(a.bestRank ?? "—").padStart(5)} ${String(b.bestRank ?? "—").padStart(5)} ${(delta === null ? "" : delta > 0 ? `+${delta}` : String(delta)).padStart(3)}   ${o3}   ${o5}   ${String(o10).padStart(2)}    ${s1 ? "✓" : "·"}       ${a.tooSoonMisses.length}/${b.tooSoonMisses.length}      ${b.picks.map(pickName).join(" + ")}`,
  );
}
console.log(`top-3 overlap mean ${fmt(mean(ov3s))} min ${Math.min(...ov3s)} · top-5 mean ${fmt(mean(ov5s))} min ${Math.min(...ov5s)} · top-10 mean ${fmt(mean(ov10s))} min ${Math.min(...ov10s)} · same #1 on ${same1}/${days.length}`);
const hist = (xs: number[], max: number) => Array.from({ length: max + 1 }, (_, i) => `${i}:${xs.filter((x) => x === i).length}`).join(" ");
console.log(`top-5 overlap histogram ${hist(ov5s, 5)}`);
for (const [key, n] of [["h3", 3], ["h5", 5], ["h10", 10]] as const) {
  console.log(`hit@${n} flips: A→B gained ${flips[key].gain.length} [${flips[key].gain.join(" ")}]  lost ${flips[key].loss.length} [${flips[key].loss.join(" ")}]`);
}

console.log("\n=== top-5 churn (Options in one run's top 5 and not the other's) ===");
for (const b of days) {
  const a = daysA.get(b.day)!;
  const onlyA = topN(a, 5).filter((x) => !topN(b, 5).includes(x));
  const onlyB = topN(b, 5).filter((x) => !topN(a, 5).includes(x));
  if (onlyA.length || onlyB.length) console.log(`${b.day}  A only: ${onlyA.join(", ") || "—"}  |  B only: ${onlyB.join(", ") || "—"}`);
}

console.log("\n=== top-5 occupancy per Option (days in the top 5), eaten = days Picked in the window ===");
const eaten = new Map<string, number>();
for (const d of days) for (const p of d.picks) eaten.set(pickName(p), (eaten.get(pickName(p)) ?? 0) + 1);
const occ = (run: Run, n: number) => {
  const m = new Map<string, number>();
  for (const d of run.results) for (const name of topN(d, n)) m.set(name, (m.get(name) ?? 0) + 1);
  return m;
};
const occA = occ(A, 5), occB = occ(B, 5), occA3 = occ(A, 3), occB3 = occ(B, 3), occA1 = occ(A, 1), occB1 = occ(B, 1);
const names = [...new Set([...occA.keys(), ...occB.keys()])].sort((x, y) => (occB.get(y) ?? 0) + (occA.get(y) ?? 0) - (occB.get(x) ?? 0) - (occA.get(x) ?? 0));
// The #1 columns show who leads: an Option at #1 on a third of the days and
// eaten on two of them is the clearest sign of a fact the model is over-reading.
console.log("option                            top5 A  top5 B  top3 A  top3 B    #1 A    #1 B  eaten");
for (const name of names) {
  console.log(`${name.padEnd(33)} ${String(occA.get(name) ?? 0).padStart(6)}  ${String(occB.get(name) ?? 0).padStart(6)}  ${String(occA3.get(name) ?? 0).padStart(6)}  ${String(occB3.get(name) ?? 0).padStart(6)}  ${String(occA1.get(name) ?? 0).padStart(6)}  ${String(occB1.get(name) ?? 0).padStart(6)}  ${String(eaten.get(name) ?? 0).padStart(5)}`);
}
const neverSlots = (run: Run, n: number) => run.results.reduce((acc, d) => acc + topN(d, n).filter((x) => !eaten.has(x)).length, 0);
console.log(`top-5 slots on never-eaten Options: A ${neverSlots(A, 5)}/${days.length * 5}  B ${neverSlots(B, 5)}/${days.length * 5} · top-3: A ${neverSlots(A, 3)}/${days.length * 3}  B ${neverSlots(B, 3)}/${days.length * 3}`);
const emptyTop10 = (run: Run) => run.results.reduce((acc, d) => acc + d.ranking.filter((r) => r.rank <= 10 && !r.reason?.trim()).length, 0);
console.log(`empty reasons in the top 10: A ${emptyTop10(A)}  B ${emptyTop10(B)}`);

console.log("\n=== the Pick's row in each run ===");
for (const b of days) {
  const a = daysA.get(b.day)!;
  for (const p of b.picks.map(pickName)) {
    const ra = a.ranking.find((r) => r.name === p);
    const rb = b.ranking.find((r) => r.name === p);
    console.log(`${b.day} ${p}`);
    console.log(`   A #${ra?.rank ?? "—"}: ${ra?.reason || "(empty)"}`);
    console.log(`   B #${rb?.rank ?? "—"}: ${rb?.reason || "(empty)"}`);
  }
}
