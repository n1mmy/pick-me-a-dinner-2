import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Server-action tests share one test database; run files sequentially so
    // they cannot truncate each other's rows mid-test.
    fileParallelism: false,
    globalSetup: ["./vitest.global-setup.ts"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
