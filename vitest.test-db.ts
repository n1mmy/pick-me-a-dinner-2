import { basename } from "node:path";

/**
 * The test database name for the current git worktree. Parallel agents each
 * run in their own worktree under `.claude/worktrees/`; deriving the name from
 * the worktree directory gives every one its own database, so concurrent
 * `pnpm test:db` runs never create or truncate each other's tables.
 *
 * Imported by both `vitest.global-setup.ts` (which creates the database) and
 * `vitest.setup.ts` (which points tests at it) so the two never disagree.
 */
export function testDatabaseName(databaseUrl: string): string {
  const base = new URL(databaseUrl).pathname.replace(/^\//, "");
  const worktree = basename(process.cwd())
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
  return `${base}_test_${worktree}`;
}

/** The `DATABASE_URL` pointing at this worktree's test database. */
export function testDatabaseUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.pathname = `/${testDatabaseName(databaseUrl)}`;
  return url.toString();
}
