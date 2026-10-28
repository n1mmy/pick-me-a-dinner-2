/**
 * Diff two backtest JSON files from scripts/backtest.ts (any ranker) over the
 * same day list: aggregates side by side, per-day rank of the Pick and top-N
 * overlap, hit flips, top-5 occupancy per Option, top-5 slots spent on Options
 * never eaten in the window, empty top-10 reasons, flag counts per day.
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
  flags: { elapsed?: unknown[]; weekday?: unknown[]; timingOnly?: unknown[]; [k: string]: unknown };
  candidates: number;
  latencyMs: number;
  outputTokens?: number;
  dayNote?: string | null;
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
const flagCount = (d: Day, key: string) => {
  const v = d.flags?.[key];
  return Array.isArray(v) ? v.length : typeof v === "number" ? v : 0;
};
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

console.log(`A: ${aPath}  (${A.meta.model ?? A.meta.ranker}, effort ${A.meta.effort ?? "?"}, ${A.meta.tailMode ?? ""})`);
console.log(`B: ${bPath}  (${B.meta.model ?? B.meta.ranker}, effort ${B.meta.effort ?? "?"}, ${B.meta.tailMode ?? ""})`);

console.log("\n=== aggregate ===");
const aggKeys = ["hit3", "hit5", "hit10", "meanRank", "medianRank", "daysWithTooSoonMiss", "elapsedSuspects", "weekdayClaims", "timingOnlyTopRows", "briefNamedOutsideTop3", "briefMissingDayNote"];
for (const k of aggKeys) console.log(`${k.padEnd(22)} ${String(A.aggregate[k]).padStart(6)} ${String(B.aggregate[k]).padStart(6)}`);
console.log(`${"latency s (mean)".padEnd(22)} ${fmt(mean(A.results.map((d) => d.latencyMs)) / 1000).padStart(6)} ${fmt(mean(B.results.map((d) => d.latencyMs)) / 1000).padStart(6)}`);
console.log(`${"output tokens (mean)".padEnd(22)} ${fmt(mean(A.results.map((d) => d.outputTokens ?? 0)), 0).padStart(6)} ${fmt(mean(B.results.map((d) => d.outputTokens ?? 0)), 0).padStart(6)}`);

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
const occA = occ(A, 5), occB = occ(B, 5), occA3 = occ(A, 3), occB3 = occ(B, 3);
const names = [...new Set([...occA.keys(), ...occB.keys()])].sort((x, y) => (occB.get(y) ?? 0) + (occA.get(y) ?? 0) - (occB.get(x) ?? 0) - (occA.get(x) ?? 0));
console.log("option                            top5 A  top5 B  top3 A  top3 B  eaten");
for (const name of names) {
  console.log(`${name.padEnd(33)} ${String(occA.get(name) ?? 0).padStart(6)}  ${String(occB.get(name) ?? 0).padStart(6)}  ${String(occA3.get(name) ?? 0).padStart(6)}  ${String(occB3.get(name) ?? 0).padStart(6)}  ${String(eaten.get(name) ?? 0).padStart(5)}`);
}
const neverSlots = (run: Run, n: number) => run.results.reduce((acc, d) => acc + topN(d, n).filter((x) => !eaten.has(x)).length, 0);
console.log(`top-5 slots on never-eaten Options: A ${neverSlots(A, 5)}/${days.length * 5}  B ${neverSlots(B, 5)}/${days.length * 5} · top-3: A ${neverSlots(A, 3)}/${days.length * 3}  B ${neverSlots(B, 3)}/${days.length * 3}`);
const emptyTop10 = (run: Run) => run.results.reduce((acc, d) => acc + d.ranking.filter((r) => r.rank <= 10 && !r.reason?.trim()).length, 0);
console.log(`empty reasons in the top 10: A ${emptyTop10(A)}  B ${emptyTop10(B)}`);

console.log("\n=== flags per day (elapsed / weekday / timing-only), A vs B ===");
for (const b of days) {
  const a = daysA.get(b.day)!;
  console.log(`${b.day}  ${flagCount(a, "elapsed")}/${flagCount(b, "elapsed")}  ${flagCount(a, "weekdayClaims")}/${flagCount(b, "weekdayClaims")}  ${flagCount(a, "timingOnly")}/${flagCount(b, "timingOnly")}`);
}

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
