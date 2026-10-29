/**
 * The deterministic Tonight ranking (Score = Affinity × Readiness) run
 * through the AI ranking backtest (`scripts/backtest.ts`) as a free baseline
 * the model runs are read against. Free, instant, and no model: it answers
 * "what does the AI buy over the list Tonight loads without it?".
 *
 * Each day is ranked as `tonightForDay` would have ranked it with the Log cut
 * to before that day, Closed Restaurants off, and the day's own Rejections
 * ignored (they are ground truth, never a suppression). Rows carry no reason,
 * so the text flags and the empty-reason count mean nothing for this ranker.
 *
 *   npx tsx scripts/backtest-score.ts --json
 *   npx tsx scripts/backtest-score.ts --days=2026-10-02,2026-10-06 --json=x.json
 */
import "./load-env";
import { getTonightData } from "../db/queries";
import { tonightForDay } from "../lib/tonight-day";
import { parseBacktestArgs, runBacktest } from "./backtest";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  await runBacktest({
    args: parseBacktestArgs(args, "scripts/backtest-runs/score-baseline.json"),
    meta: { ranker: "deterministic Score" },
    generate: async (built) => {
      const day = built.snapshot.today.slice(0, 10);
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
      const candidates = new Set(built.idByCode.values());
      return {
        ok: true,
        ranking: view.picker
          .filter((row) => candidates.has(row.option.id))
          .map((row) => ({ id: row.option.id, reason: "" })),
      };
    },
  });
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
