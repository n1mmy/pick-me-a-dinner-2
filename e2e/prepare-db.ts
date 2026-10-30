/**
 * Prepare the browser suite's database: create it if missing, migrate it, wipe
 * it, and insert the fixture. Run by Playwright's web-server command ahead of
 * `next start` (see `playwright.config.ts`), so migration always precedes the
 * boot-time schema check and every run re-seeds against today.
 *
 * `DATABASE_URL` and `APP_TZ` come from the web server's environment. Every
 * date is relative to today in `APP_TZ`, so chip ages and heatmap colours read
 * the same whichever day the suite runs. What the fixture holds:
 * `e2e/README.md`.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { db } from "../db";
import {
  dayNotes,
  dinnerLog,
  options,
  optionTags,
  preparedNotes,
  tags,
} from "../db/schema";
import { truncateAll } from "../db/test-support";
import {
  appTimeZone,
  shiftSqlDate,
  today,
  weekdayFromSqlDate,
} from "../lib/local-day";
import { inputHash } from "../lib/prepared-notes";
import { snapshotForDay } from "../lib/snapshot";
import {
  DAY_NOTE,
  FIXTURE_MODEL,
  LOG,
  OPTIONS,
  PLANNED,
  TODAY_BRIEF,
  TODAY_RANKING,
  TOMORROW_BRIEF,
  TOMORROW_RANKING,
} from "./fixture";

/**
 * The instant that reads `hour`:00 on `day` in `timeZone`: the UTC guess
 * corrected by the zone's offset at the first estimate, not at the guess. On a
 * DST change day the guess sits near local midnight, on the other side of the
 * change from `hour`.
 */
function atLocalHour(day: string, hour: number, timeZone: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  const guess = Date.UTC(year, month - 1, date, hour);
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
  // How far the zone's wall clock runs from UTC at `instant`.
  const offsetAt = (instant: number): number => {
    const parts = format.formatToParts(new Date(instant));
    const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const shown = Date.UTC(
      part("year"),
      part("month") - 1,
      part("day"),
      part("hour"),
      part("minute"),
    );
    return shown - instant;
  };
  return new Date(guess - offsetAt(guess - offsetAt(guess)));
}

async function createAndMigrate(databaseUrl: string): Promise<void> {
  const name = new URL(databaseUrl).pathname.replace(/^\//, "");
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = "/postgres";
  const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`CREATE DATABASE "${name}"`);
  } catch (error) {
    // 42P04 = duplicate_database — already created by an earlier run.
    if ((error as { code?: string }).code !== "42P04") throw error;
  } finally {
    await admin.end();
  }
  const client = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  await client.end();
}

async function seed(): Promise<void> {
  const todaySql = today();
  const tomorrow = shiftSqlDate(todaySql, 1);
  const closedDay = weekdayFromSqlDate(shiftSqlDate(todaySql, 2));

  const tagNames = [...new Set(OPTIONS.flatMap((o) => o.tags))];
  const tagRows = await db
    .insert(tags)
    .values(tagNames.map((name) => ({ name })))
    .returning();
  const tagId = new Map(tagRows.map((t) => [t.name, t.id]));

  const optionRows = await db
    .insert(options)
    .values(
      OPTIONS.map((o) => ({
        name: o.name,
        kind: o.kind,
        closedDays: "closedInDays" in o ? [closedDay] : [],
      })),
    )
    .returning();
  const optionId = new Map(optionRows.map((o) => [o.name, o.id]));
  const idOf = (name: string): string => {
    const id = optionId.get(name);
    if (!id) throw new Error(`No fixture Option named ${name}`);
    return id;
  };

  await db.insert(optionTags).values(
    OPTIONS.flatMap((o) =>
      o.tags.map((tag) => ({ optionId: idOf(o.name), tagId: tagId.get(tag)! })),
    ),
  );
  await db.insert(dinnerLog).values([
    ...LOG.map((entry) => ({
      optionId: idOf(entry.name),
      eatenOn: shiftSqlDate(todaySql, -entry.daysAgo),
      note: entry.note ?? null,
    })),
    { optionId: idOf(PLANNED.name), eatenOn: tomorrow, note: PLANNED.note },
  ]);
  await db.insert(dayNotes).values({ notedOn: todaySql, note: DAY_NOTE });

  // Hashed last, over everything above, so today's note reads current.
  const built = await snapshotForDay({ asOf: todaySql, query: "" });
  const candidates = new Set(built.idByCode.values());
  const ranking = TODAY_RANKING.map(([name, reason]) => ({ id: idOf(name), reason }));
  if (
    ranking.length !== candidates.size ||
    !ranking.every((row) => candidates.has(row.id))
  ) {
    throw new Error("Today's fixture ranking does not cover exactly today's candidates");
  }

  const preparedAt = atLocalHour(todaySql, 7, appTimeZone());
  await db.insert(preparedNotes).values([
    {
      preparedFor: todaySql,
      brief: TODAY_BRIEF,
      ranking,
      inputHash: inputHash(built, FIXTURE_MODEL),
      model: FIXTURE_MODEL,
      preparedAt,
    },
    {
      // Decided, so the note reads frozen and its hash never matters.
      preparedFor: tomorrow,
      brief: TOMORROW_BRIEF,
      ranking: TOMORROW_RANKING.map(([name, reason]) => ({ id: idOf(name), reason })),
      inputHash: "frozen",
      model: FIXTURE_MODEL,
      preparedAt,
    },
  ]);
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");
  await createAndMigrate(databaseUrl);
  await truncateAll();
  await seed();
  await db.$client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
