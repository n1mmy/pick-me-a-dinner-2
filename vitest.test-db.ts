import { basename } from "node:path";

/**
 * A test database name for the current git worktree. Parallel agents each
 * run in their own worktree under `.claude/worktrees/`; deriving the name from
 * the worktree directory gives every one its own database, so concurrent
 * `pnpm test:db` runs never create or truncate each other's tables.
 *
 * `suffix` names the suite: `test` for the DB suite, `e2e` for the browser
 * suite (`playwright.config.ts`), so the two never share a database.
 *
 * Imported by `vitest.global-setup.ts` (which creates the database),
 * `vitest.setup.ts` (which points tests at it), and the browser suite's
 * config, so the derivations never disagree.
 */
export function testDatabaseName(databaseUrl: string, suffix: string): string {
  const base = new URL(databaseUrl).pathname.replace(/^\//, "");
  const worktree = basename(process.cwd())
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
  return `${base}_${suffix}_${worktree}`;
}

/** The `DATABASE_URL` pointing at this worktree's `suffix` test database. */
export function testDatabaseUrl(databaseUrl: string, suffix: string): string {
  const url = new URL(databaseUrl);
  url.pathname = `/${testDatabaseName(databaseUrl, suffix)}`;
  return url.toString();
}
