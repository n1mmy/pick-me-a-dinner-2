import { configDefaults, defineConfig } from "vitest/config";

/**
 * Database integration suite — the `*.db.test.ts` files. Runs `globalSetup` to
 * create and migrate a per-worktree test database, and serialises test files so
 * they cannot truncate each other's rows. Invoked via `pnpm test:db`.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.db.test.ts"],
    // `.claude/worktrees/` holds full repo copies created by parallel agents.
    exclude: [...configDefaults.exclude, "**/.claude/worktrees/**"],
    // Tests in this suite share one test database; run files sequentially so
    // they cannot truncate each other's rows mid-test.
    fileParallelism: false,
    globalSetup: ["./vitest.global-setup.ts"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
