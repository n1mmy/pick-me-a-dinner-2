import { configDefaults, defineConfig } from "vitest/config";

/**
 * Unit suite — pure logic and React screen tests. No database, no `globalSetup`,
 * no infrastructure: `pnpm test` runs anywhere. Database integration tests are
 * named `*.db.test.ts` and run under `vitest.config.db.ts` via `pnpm test:db`.
 */
export default defineConfig({
  // The screen-level test renders `.tsx` components with React Testing Library;
  // esbuild's automatic JSX runtime transforms the JSX. It is inert for the
  // pure-logic suites, which have no JSX.
  esbuild: { jsx: "automatic" },
  test: {
    // Default environment is `node`; the React screen test opts into `jsdom`
    // with a `// @vitest-environment jsdom` pragma at the top of its file.
    environment: "node",
    exclude: [
      ...configDefaults.exclude,
      // Parallel agents create git worktrees under `.claude/worktrees/`, each a
      // full repo copy. Without this every suite there runs as a duplicate.
      "**/.claude/worktrees/**",
      // Database integration tests — run via `pnpm test:db`.
      "**/*.db.test.ts",
    ],
  },
});
