/**
 * Scratch analysis beside the AI ranking backtest (scripts/backtest.ts):
 *
 * 1. The deterministic Tonight ranking (Score = Affinity × Readiness) scored
 *    on the same fixed day list, the Log cut to before each day, Closed
 *    Restaurants removed, Rejections on the day ignored (they are ground
 *    truth). A free baseline the model runs can be read against.
 * 2. For each day's Pick, the snapshot's own timing facts — how "due" the
 *    thing they actually ate was by daysSinceLast against intervalDays.
 * 3. Eat dates, gaps, and three Interval definitions (all-time median, median
 *    of the most recent half of the gaps, the last gap) for the Options the
 *    backtest keeps ranking high or low, as of the last backtest day.
 *
 *   npx tsx scripts/backtest-baseline.ts
 */
import "./load-env";
import { getDayNotes, getLog, getLogRejections, getTonightData } from "../db/queries";
import { epochDayFromSqlDate, weekdayName } from "../lib/local-day";
import { snapshotForDay } from "../lib/snapshot";
import { tonightForDay } from "../lib/tonight-day";

const DAYS = [
  "2026-10-02", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09",
  "2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14",
  "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19",
  "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-25", "2026-10-26",
];

const WATCH = [
  "Aji Ichi Japanese Restaurant", "Ninja Sushi", "Mazra", "Atlas Pizza Parlor",
  "Big Mouth Burgers", "Leftovers", "Quiche", "Hungryroot", "Chicken and Rice",
  "Mollie Stone's", "Local Kitchens", "Taqueria Mi Durango", "Societea Tea House & Eatery",
  "Thai Nakorn", "West Coast Cafe",
];

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

async function main() {
  const log = await getLog();

  console.log("=== 1. deterministic Score baseline ===");
  console.log("day         wkday  rank   top 5                                                  | pick (since/interval/eaten)");
  const bestRanks: (number | null)[] = [];
  for (const day of DAYS) {
    const picks = log.filter((entry) => entry.eatenOn === day);
    const { options, logEntries } = await getTonightData(day);
    const view = tonightForDay({
      options,
      logEntries: logEntries.filter((entry) => entry.eatenOn < day),
      dayEntries: [],
      rejections: [],
      selectedDay: day,
      today: day,
      dayNote: null,
    });
    const names = view.picker.map((row) => row.option.name);
    const ranks = picks
      .map((pick) => names.indexOf(pick.optionName) + 1)
      .filter((rank) => rank > 0);
    const best = ranks.length > 0 ? Math.min(...ranks) : null;
    bestRanks.push(best);

    const built = await snapshotForDay({ asOf: day, query: "", backtest: true });
    const due = picks.map((pick) => {
      const option = built.snapshot.options.find((o) => o.name === pick.optionName);
      return option
        ? `${pick.optionName} ${option.daysSinceLast ?? "never"}/${option.intervalDays ?? "—"}/${option.eaten}`
        : `${pick.optionName} (not a candidate)`;
    });
    console.log(
      `${day} ${weekdayName(day).slice(0, 3).padEnd(5)} ${(best === null ? "—" : `#${best}`).padStart(4)}   ` +
        `${names.slice(0, 5).join(" / ").padEnd(54)} | ${due.join(", ")}`,
    );
  }
  const scored = bestRanks.filter((rank): rank is number => rank !== null);
  const hit = (n: number) => scored.filter((rank) => rank <= n).length;
  console.log(
    `aggregate: scored ${scored.length}  mean ${(scored.reduce((a, b) => a + b, 0) / scored.length).toFixed(1)}  ` +
      `median ${median(scored)}  hit@3 ${hit(3)}  hit@5 ${hit(5)}  hit@10 ${hit(10)}`,
  );

  console.log("\n=== 2. eat dates, gaps, Interval definitions (as of 2026-10-26) ===");
  const asOf = epochDayFromSqlDate("2026-10-26");
  for (const name of WATCH) {
    const days = [...new Set(log.filter((e) => e.optionName === name && e.eatenOn <= "2026-10-26").map((e) => e.eatenOn))].sort();
    const epochs = days.map(epochDayFromSqlDate);
    const gaps = epochs.slice(1).map((d, i) => d - epochs[i]);
    const recentHalf = gaps.slice(gaps.length - Math.ceil(gaps.length / 2));
    const since = epochs.length > 0 ? asOf - epochs[epochs.length - 1] : null;
    console.log(`\n${name}: eaten ${days.length}, daysSinceLast ${since}`);
    console.log(`  interval all-time ${median(gaps)}  recent-half ${median(recentHalf)}  last gap ${gaps[gaps.length - 1] ?? "—"}`);
    console.log(`  dates: ${days.slice(-14).join(" ")}`);
    console.log(`  gaps:  ${gaps.join(" ")}`);
  }
  console.log("\n=== 3. Rejections dated 2026-08-15 .. 2026-10-26, and Day notes ===");
  const rejections = await getLogRejections();
  for (const row of rejections
    .filter((r) => r.rejectedOn >= "2026-08-15" && r.rejectedOn <= "2026-10-26")
    .sort((a, b) => a.rejectedOn.localeCompare(b.rejectedOn))) {
    const mark = DAYS.includes(row.rejectedOn) ? "*" : " ";
    console.log(`${mark} ${row.rejectedOn} ${weekdayName(row.rejectedOn).slice(0, 3)}  ${row.optionName}: ${row.reason ?? "(no reason)"}`);
  }
  const notes = await getDayNotes();
  for (const note of notes
    .filter((n) => n.notedOn >= "2026-08-15" && n.notedOn <= "2026-10-26")
    .sort((a, b) => a.notedOn.localeCompare(b.notedOn))) {
    console.log(`  day note ${note.notedOn}: ${note.note}`);
  }
  console.log("\n=== 4. the Log, 2026-09-20 .. 2026-10-26 ===");
  for (const entry of log
    .filter((e) => e.eatenOn >= "2026-09-20" && e.eatenOn <= "2026-10-26")
    .sort((a, b) => a.eatenOn.localeCompare(b.eatenOn))) {
    console.log(`  ${entry.eatenOn} ${weekdayName(entry.eatenOn).slice(0, 3)}  ${entry.optionName}${entry.note ? `  — ${entry.note}` : ""}`);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
