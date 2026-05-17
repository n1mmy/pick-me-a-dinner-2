import "dotenv/config";
import { testDatabaseUrl } from "./vitest.test-db";

/**
 * Point server-action tests at a per-worktree `*_test` database so `pnpm
 * test:db` never truncates development data, and parallel agents never collide.
 * This runs in every worker before any test module imports `db/index.ts`;
 * `vitest.global-setup.ts` creates and migrates that database once per run.
 */
const base = process.env.DATABASE_URL;
if (base) {
  process.env.DATABASE_URL = testDatabaseUrl(base);
}
