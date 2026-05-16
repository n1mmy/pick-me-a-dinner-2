import "dotenv/config";

/**
 * Point server-action tests at a dedicated `*_test` database so `pnpm test`
 * never truncates development data. This runs in every worker before any test
 * module imports `db/index.ts`; `vitest.global-setup.ts` creates and migrates
 * that database once per run.
 */
const base = process.env.DATABASE_URL;
if (base) {
  const url = new URL(base);
  url.pathname = `/${url.pathname.replace(/^\//, "")}_test`;
  process.env.DATABASE_URL = url.toString();
}
