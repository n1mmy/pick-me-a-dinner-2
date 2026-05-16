import { describe, expect, it } from "vitest";
import { envProblems } from "./check-env";

/** A fully-valid environment — the baseline each case mutates one field of. */
const VALID: Record<string, string | undefined> = {
  DATABASE_URL: "postgres://localhost/pmad",
  APP_SECRET: "a-secret-at-least-32-characters-long!",
  APP_PASSWORD: "hunter2",
  APP_TZ: "America/New_York",
};

describe("envProblems", () => {
  it("reports no problems when every required var is set and APP_TZ is valid", () => {
    expect(envProblems(VALID)).toEqual([]);
  });

  it("reports each missing required var by name", () => {
    expect(envProblems({ ...VALID, DATABASE_URL: undefined })).toEqual([
      "DATABASE_URL is not set",
    ]);
    expect(envProblems({ ...VALID, APP_SECRET: "" })).toEqual([
      "APP_SECRET is not set",
    ]);
  });

  it("reports an invalid APP_TZ", () => {
    const problems = envProblems({ ...VALID, APP_TZ: "Mars/Olympus" });
    expect(problems).toEqual([
      'APP_TZ is not a valid IANA time zone: "Mars/Olympus"',
    ]);
  });

  it("collects multiple problems at once", () => {
    expect(
      envProblems({ DATABASE_URL: "", APP_SECRET: "", APP_PASSWORD: "", APP_TZ: "" }),
    ).toHaveLength(4);
  });
});
