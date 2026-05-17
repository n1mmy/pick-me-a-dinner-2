import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  // The screen-level test renders `.tsx` components with React Testing Library;
  // esbuild's automatic JSX runtime transforms the JSX. It is inert for the
  // pure-logic and server-action suites, which have no JSX.
  esbuild: { jsx: "automatic" },
  test: {
    // Default environment is `node`; the React screen test opts into `jsdom`
    // with a `// @vitest-environment jsdom` pragma at the top of its file.
    environment: "node",
    // Parallel agents create git worktrees under `.claude/worktrees/`, each a
    // full repo copy. Without this every suite there runs as a duplicate.
    exclude: [...configDefaults.exclude, "**/.claude/worktrees/**"],
    // Server-action tests share one test database; run files sequentially so
    // they cannot truncate each other's rows mid-test.
    fileParallelism: false,
    globalSetup: ["./vitest.global-setup.ts"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
