/**
 * Backfill **Prepared notes** for past dates: today first, then each day
 * before it back to the first Logged dinner, one note per date that has none.
 * Each snapshot is built in backtest mode (`snapshotForDay`), as the Household
 * saw the date before deciding it: no Log entry or Rejection dated on or
 * after it, so neither the Pick nor any later dinner is in the note's input.
 * The Catalog is read as it is now.
 *
 * A date that already has a note is left alone, so a stopped run picks up by
 * running again; a row the sweep claimed and never wrote a note into is
 * filled, unless its claim is still live. A failed generation writes nothing
 * and is listed at the end.
 *
 *   npx tsx scripts/backfill-prepared-notes.ts --dry-run       # list the dates
 *   npx tsx scripts/backfill-prepared-notes.ts --concurrency=3 --limit=30
 *
 * `--concurrency` is how many requests are in flight at once (default 1);
 * `--limit` caps the dates generated this run. Env is as for
 * `scripts/prepared-note-eval.ts`: `DATABASE_URL`, `APP_TZ`, and the
 * `LOCAL_AI_*` variables, which `--env-file` flags ahead of `.env.local` win.
 */
import "./load-env";
import { isNotNull, min, sql } from "drizzle-orm";
import { db } from "../db";
import { getDecidedDates } from "../db/queries";
import { dinnerLog, preparedNotes } from "../db/schema";
import { shiftSqlDate, today } from "../lib/local-day";
import { createPreparedNoteClient, localModelConfig } from "../lib/prepared-note";
import { inputHash } from "../lib/prepared-notes";
import { snapshotForDay } from "../lib/snapshot";

/** A `--name=N` flag's value, refused unless a positive integer. */
function numberArg(args: string[], name: string): number | undefined {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  if (!arg) return undefined;
  const raw = arg.slice(name.length + 3);
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    console.error(`--${name} must be a positive integer, got ${raw}`);
    process.exit(1);
  }
  return n;
}

function log(event: string, fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ event, ...fields }));
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const concurrency = numberArg(args, "concurrency") ?? 1;
  const limit = numberArg(args, "limit") ?? Infinity;

  const config = localModelConfig();
  if (!config.baseUrl || !config.model) {
    console.error("LOCAL_AI_BASE_URL and LOCAL_AI_MODEL are not set.");
    process.exit(1);
  }
  log("backfill_config", {
    baseUrl: config.baseUrl,
    model: config.model,
    maxTokens: config.maxTokens ?? "default",
    reasoningEffort: config.reasoningEffort ?? "server default",
    database: new URL(process.env.DATABASE_URL ?? "").host,
    timeZone: process.env.APP_TZ,
    concurrency,
  });

  const [{ first }] = await db.select({ first: min(dinnerLog.eatenOn) }).from(dinnerLog);
  const last = today();
  if (first === null) {
    log("backfill_done", { reason: "empty Log" });
    return;
  }
  const noted = new Set(
    (
      await db
        .select({ day: preparedNotes.preparedFor })
        .from(preparedNotes)
        .where(isNotNull(preparedNotes.brief))
    ).map((row) => row.day),
  );
  const decided = new Set(await getDecidedDates(first, last));

  const days: string[] = [];
  for (let day = last; day >= first; day = shiftSqlDate(day, -1)) {
    if (!noted.has(day)) days.push(day);
  }
  const queue = days.slice(0, limit);
  log("backfill_plan", {
    from: last,
    to: first,
    withNote: noted.size,
    toWrite: days.length,
    thisRun: queue.length,
    undecided: queue.filter((day) => !decided.has(day)).length,
    firstDays: queue.slice(0, 5),
  });
  if (dryRun) return;

  const client = createPreparedNoteClient(config);
  const failed: string[] = [];
  let written = 0;
  let next = 0;
  const worker = async () => {
    while (next < queue.length) {
      const day = queue[next++];
      const built = await snapshotForDay({ asOf: day, query: "", backtest: true });
      if (built.idByCode.size === 0) {
        log("backfill_skipped", { day, reason: "no candidates" });
        continue;
      }
      const result = await client.prepare(built);
      if (!result.ok) {
        failed.push(day);
        continue;
      }
      // A note that appeared meanwhile, or a live claim — the sweep's — wins.
      const values = {
        brief: result.note.brief,
        ranking: result.note.ranking,
        inputHash: inputHash(built, config.model),
        model: config.model,
        preparedAt: new Date(),
      };
      const stored = await db
        .insert(preparedNotes)
        .values({ preparedFor: day, ...values })
        .onConflictDoUpdate({
          target: preparedNotes.preparedFor,
          set: values,
          setWhere: sql`${preparedNotes.brief} is null and (${preparedNotes.claimedUntil} is null or ${preparedNotes.claimedUntil} < now())`,
        })
        .returning({ day: preparedNotes.preparedFor });
      if (stored.length > 0) written++;
      log("backfill_day", { day, stored: stored.length > 0 });
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  log("backfill_done", { written, failed: failed.sort().reverse() });
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
