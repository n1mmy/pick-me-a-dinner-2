import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appliedMigrationCount,
  bundledMigrationCount,
  checkSchemaOnBoot,
  schemaCheckResult,
} from "./schema-check";

describe("schemaCheckResult", () => {
  it("lets the app boot when the DB is at the current migration", () => {
    expect(schemaCheckResult(1, 1)).toEqual({ ok: true });
  });

  it("lets the app boot when the DB is ahead of the image", () => {
    expect(schemaCheckResult(1, 2)).toEqual({ ok: true });
  });

  it("blocks boot with a loud, specific message when the DB is behind", () => {
    const result = schemaCheckResult(3, 1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.behind).toBe(2);
    expect(result.message).toBe(
      "DB schema 2 migrations behind — run drizzle-kit migrate",
    );
  });

  it("uses the singular noun when exactly one migration behind", () => {
    const result = schemaCheckResult(1, 0);
    if (result.ok) throw new Error("expected the DB to be behind");
    expect(result.message).toBe(
      "DB schema 1 migration behind — run drizzle-kit migrate",
    );
  });
});

describe("counts against the migrated test database", () => {
  it("counts the bundled migrations from the Drizzle journal", async () => {
    expect(await bundledMigrationCount()).toBeGreaterThanOrEqual(1);
  });

  it("sees every bundled migration applied", async () => {
    // The test DB is migrated by vitest.global-setup.ts, so it is current.
    expect(await appliedMigrationCount()).toBe(await bundledMigrationCount());
  });
});

describe("checkSchemaOnBoot", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("boots normally when the DB is at the current migration", async () => {
    const exit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);
    await checkSchemaOnBoot();
    expect(exit).not.toHaveBeenCalled();
  });

  it("logs a loud message and exits non-zero when the DB is behind", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const exit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);

    await checkSchemaOnBoot(async () => ({ bundled: 3, applied: 1 }));

    expect(exit).toHaveBeenCalledWith(1);
    expect(error.mock.calls.flat().join("\n")).toContain(
      "DB schema 2 migrations behind — run drizzle-kit migrate",
    );
  });
});
