import { sql } from "drizzle-orm";
import { db } from "./index";

/**
 * Wipe every table so each test starts clean. Server-action tests run against a
 * dedicated `*_test` database (see `vitest.global-setup.ts`), so truncating is
 * safe and keeps tests isolated without re-running migrations between them.
 */
export async function truncateAll(): Promise<void> {
  await db.execute(
    sql`truncate table "dinner_log", "option_tags", "options", "tags" restart identity cascade`,
  );
}
