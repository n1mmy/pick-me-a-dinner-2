import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { serverEnv } from "./server-env";

/**
 * Read by the server but safe to leave out of `serverEnv`: Next sets the first
 * two itself, and the AI tuning knobs do nothing while `ANTHROPIC_API_KEY` is
 * blank.
 */
const UNSET_OK = ["NODE_ENV", "NEXT_RUNTIME", "AI_EFFORT", "AI_TIMEOUT_MS"];

/** The server's own code: what `next start` runs, without its tests. */
function serverSources(): string[] {
  const inDirs = ["app", "lib", "db"].flatMap((dir) =>
    readdirSync(dir, { recursive: true, encoding: "utf8" }).map((file) => join(dir, file)),
  );
  return [...inDirs, "middleware.ts", "instrumentation.ts"].filter(
    (file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file),
  );
}

describe("serverEnv", () => {
  // `next start` fills any variable left undefined from the worktree's `.env`,
  // which can hold real keys. A name the server reads must be set here, even
  // to "", or a new metered key would reach the browser suite (CLAUDE.md,
  // billed-call rule). Variables an SDK reads on its own, like
  // `ANTHROPIC_BASE_URL`, never appear as `process.env.X`; `BLANKED` lists
  // those by hand.
  it("sets every variable the server reads", () => {
    const read = new Set(
      serverSources().flatMap((file) =>
        [...readFileSync(file, "utf8").matchAll(/process\.env\.([A-Z0-9_]+)/g)].map(
          (match) => match[1],
        ),
      ),
    );
    const unset = [...read].filter((name) => !(name in serverEnv) && !UNSET_OK.includes(name));

    expect(unset).toEqual([]);
  });
});
