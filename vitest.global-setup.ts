import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { testDatabaseName } from "./vitest.test-db";

/**
 * Create and migrate the dedicated test database once per `pnpm test:db` run.
 * The database is named per git worktree (see `vitest.test-db.ts`), so parallel
 * agents each get their own and never collide. Server-action tests run against
 * it (see `vitest.setup.ts`) so they can truncate freely without touching
 * development data.
 */
export default async function setup(): Promise<void> {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL is not set");

  const testName = testDatabaseName(base);

  const adminUrl = new URL(base);
  adminUrl.pathname = "/postgres";
  const admin = postgres(adminUrl.toString(), { max: 1 });
  try {
    await admin.unsafe(`CREATE DATABASE "${testName}"`);
  } catch (error) {
    // 42P04 = duplicate_database — already created by an earlier run.
    if ((error as { code?: string }).code !== "42P04") throw error;
  } finally {
    await admin.end();
  }

  const testUrl = new URL(base);
  testUrl.pathname = `/${testName}`;
  const client = postgres(testUrl.toString(), { max: 1 });
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  await client.end();
}
