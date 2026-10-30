import { defineConfig } from "@playwright/test";
import { serverEnv, STORAGE_STATE } from "./e2e/server-env";

/**
 * The browser suite (`pnpm test:e2e`): a real Chromium against a production
 * `next start`, seeded with a fixed fixture, with every AI and Places variable
 * blanked. Not in the verification gate: it needs Postgres. How to run it and
 * read its screenshots: `e2e/README.md`.
 */
export default defineConfig({
  testDir: "e2e",
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    // `localhost`, not a loopback IP: the session cookie is Secure outside
    // development, and Chromium accepts a Secure cookie over plain http only
    // for `localhost`.
    baseURL: "http://localhost:3100",
  },
  webServer: {
    // Preparing inside the server command, not a global setup, keeps migration
    // ahead of the boot-time schema check. The build runs before Playwright
    // (`test:e2e`): inside this command it would sit at the server timeout.
    command: "tsx e2e/prepare-db.ts && next start -p 3100",
    url: "http://localhost:3100/login",
    // Never reused, so every run re-seeds against today.
    reuseExistingServer: false,
    env: serverEnv,
  },
  projects: [
    { name: "setup", testMatch: /\.setup\.ts$/ },
    {
      name: "phone",
      dependencies: ["setup"],
      grepInvert: /@dark/,
      use: { viewport: { width: 375, height: 812 }, storageState: STORAGE_STATE },
    },
    {
      name: "desktop",
      dependencies: ["setup"],
      grepInvert: /@dark/,
      use: { viewport: { width: 1280, height: 800 }, storageState: STORAGE_STATE },
    },
    {
      // Phone only: the dark theme at desktop width is out of scope.
      name: "phone-dark",
      dependencies: ["setup"],
      grep: /@dark/,
      use: {
        viewport: { width: 375, height: 812 },
        colorScheme: "dark",
        storageState: STORAGE_STATE,
      },
    },
  ],
});
