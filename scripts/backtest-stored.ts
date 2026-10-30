/**
 * The stored **Prepared notes** run through the AI ranking backtest
 * (`scripts/backtest.ts`): every decided past date with a note in
 * `prepared_notes` is scored against what was eaten, with no model call. It
 * reads the notes the sweep and `scripts/backfill-prepared-notes.ts` wrote.
 *
 * The snapshot each day is scored beside is the backtest-mode one, as the
 * backfill built it; a note the sweep wrote before the day was decided saw
 * the full Log of its time instead, so its Pick timing columns may differ.
 *
 *   npx tsx scripts/backtest-stored.ts --json
 *   npx tsx scripts/backtest-stored.ts --days=2026-10-02,2026-10-06
 *
 * Without `--days` it prints the day list it scored, for
 * `scripts/backtest-score.ts --days=…` to run the baseline on the same days.
 */
import "./load-env";
import { and, isNotNull, lt } from "drizzle-orm";
import { db } from "../db";
import { getDecidedDates, getPreparedNote } from "../db/queries";
import { preparedNotes } from "../db/schema";
import { today } from "../lib/local-day";
import { parseBacktestArgs, runBacktest } from "./backtest";

async function main(): Promise<void> {
  const args = parseBacktestArgs(
    process.argv.slice(2),
    "scripts/backtest-runs/stored-notes.json",
  );
  if (!args.days) {
    const noted = (
      await db
        .select({ day: preparedNotes.preparedFor })
        .from(preparedNotes)
        .where(and(isNotNull(preparedNotes.brief), lt(preparedNotes.preparedFor, today())))
    ).map((row) => row.day);
    const decided = new Set(
      noted.length > 0 ? await getDecidedDates(noted.sort()[0], today()) : [],
    );
    args.days = noted.filter((day) => decided.has(day)).sort();
  }
  await runBacktest({
    args,
    meta: { ranker: "stored Prepared notes" },
    generate: async (built) => {
      const note = await getPreparedNote(built.snapshot.today.slice(0, 10));
      if (note === null) return { ok: false, ranking: [] };
      // Only today's candidates hold a place, as on Tonight: a note written
      // before No Shared Dinner left the candidates may still rank it.
      const candidates = new Set(built.idByCode.values());
      return {
        ok: true,
        ranking: note.ranking.filter((row) => candidates.has(row.id)),
        brief: note.brief,
      };
    },
  });
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
