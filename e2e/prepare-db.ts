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

/** The model recorded on the fixture's notes. */
const FIXTURE_MODEL = "e2e-fixture";

const OPTIONS = [
  { name: "Lemon Chicken Traybake", kind: "home", tags: ["comfort"] },
  { name: "Mushroom Risotto", kind: "home", tags: ["comfort", "vegetarian"] },
  { name: "Black Bean Tacos", kind: "home", tags: ["quick", "spicy", "vegetarian"] },
  // Never eaten: the Cold start.
  { name: "Miso Salmon Bowls", kind: "home", tags: ["quick"] },
  { name: "Pho Saigon", kind: "restaurant", tags: ["quick", "takeout"] },
  // Closed on the weekday two days out, so neither today's nor tomorrow's
  // candidate set depends on the day the suite runs.
  { name: "Luigi's Pizzeria", kind: "restaurant", tags: ["comfort", "takeout"], closedInDays: 2 },
  { name: "Thai Basil", kind: "restaurant", tags: ["quick", "spicy", "takeout"] },
] as const;

/** Past dinners, by days ago: about ten over the last forty days. */
const LOG: { daysAgo: number; name: string; note?: string }[] = [
  { daysAgo: 2, name: "Pho Saigon", note: "Broth was great — ask for extra basil next time." },
  { daysAgo: 5, name: "Mushroom Risotto" },
  { daysAgo: 9, name: "Lemon Chicken Traybake", note: "Kids finished it. Double the potatoes." },
  { daysAgo: 13, name: "Luigi's Pizzeria" },
  { daysAgo: 17, name: "Thai Basil", note: "Too spicy for Mia." },
  { daysAgo: 21, name: "Pho Saigon" },
  { daysAgo: 26, name: "Lemon Chicken Traybake" },
  { daysAgo: 30, name: "Mushroom Risotto" },
  { daysAgo: 35, name: "Luigi's Pizzeria", note: "Long wait on a weekend." },
  { daysAgo: 39, name: "Black Bean Tacos" },
];

const DAY_NOTE = "Sam's back late from football — something quick.";

/** Tomorrow's Planned dinner. */
const PLANNED = { name: "Thai Basil", note: "Pickup at six, mild for Mia." };

const TODAY_BRIEF =
  "Sam's back late, so tonight wants something quick that doesn't keep anyone " +
  "at the stove. Tacos haven't been on the table in over a month and come " +
  "together in twenty minutes; Pho Saigon is the easy fallback if nobody wants " +
  "to cook.";

/** Today's Prepared ranking, by name, rationales tapering from three sentences to one. */
const TODAY_RANKING: [string, string][] = [
  [
    "Black Bean Tacos",
    "It's been more than a month since the last taco night. They're on the " +
      "table in twenty minutes, which suits a late evening. Go easy on the " +
      "chipotle for Mia.",
  ],
  [
    "Miso Salmon Bowls",
    "Still untried, and quick enough for tonight. The rice cooker does most " +
      "of the work. A good night to finally give it a go.",
  ],
  [
    "Pho Saigon",
    "Two nights ago, but it's the quickest thing going. Order ahead and it's " +
      "ready when Sam is.",
  ],
  [
    "Lemon Chicken Traybake",
    "A crowd-pleaser last time. It needs forty minutes in the oven, though.",
  ],
  ["Luigi's Pizzeria", "Comfort, but the wait can run long."],
  ["Mushroom Risotto", "Too much stirring for a late night."],
  ["Thai Basil", "Already planned for tomorrow."],
];

const TOMORROW_BRIEF =
  "Thai Basil is planned, so tomorrow is settled. If plans change, the tacos " +
  "still haven't had their turn.";

/**
 * The instant that reads `hour`:00 on `day` in `timeZone`: the UTC guess
 * corrected by the zone's offset at that guess.
 */
function atLocalHour(day: string, hour: number, timeZone: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  const guess = Date.UTC(year, month - 1, date, hour);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(new Date(guess));
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const shown = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
  );
  return new Date(guess - (shown - guess));
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
      ranking: ranking.filter((row) => row.id !== idOf(PLANNED.name)),
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
