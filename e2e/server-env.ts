import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import { testDatabaseUrl } from "../vitest.test-db";

/**
 * The browser suite's server environment: the committed, secret-free
 * `.env.ralph`, parsed rather than loaded into this process, with the
 * database renamed to this worktree's browser-test database.
 */
const defaults = parse(readFileSync(".env.ralph"));

/**
 * Every metered or shared service the server could reach, set to the empty
 * string. Next fills a variable from an env file only when it is undefined in
 * the process, so an explicit empty string blocks a worktree's real keys, and
 * every feature gate reads an empty string as unset: no AI search, no Places,
 * no Prepared-note sweep.
 */
const BLANKED = [
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_BASE_URL",
  "ANTHROPIC_CUSTOM_HEADERS",
  "AI_MODEL",
  "GOOGLE_PLACES_API_KEY",
  "LOCAL_AI_BASE_URL",
  "LOCAL_AI_API_KEY",
  "LOCAL_AI_MODEL",
  "LOCAL_AI_MAX_TOKENS",
  "LOCAL_AI_REASONING_EFFORT",
];

export const serverEnv: Record<string, string> = {
  ...defaults,
  DATABASE_URL: testDatabaseUrl(defaults.DATABASE_URL, "e2e"),
  ...Object.fromEntries(BLANKED.map((name) => [name, ""])),
};

/** The shared login password the `setup` project signs in with. */
export const APP_PASSWORD = defaults.APP_PASSWORD;

/** Where `setup` saves the logged-in session for every other project. */
export const STORAGE_STATE = "e2e/.auth/household.json";
