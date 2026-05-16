import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Walking-skeleton guard: the first generated migration must encode the exact
 * v1 schema (PRD "Schema (4 tables — ADR-0001)"). This reads the committed
 * migration SQL rather than the Drizzle schema objects so it verifies what
 * actually applies to Postgres.
 */
const migrationsDir = join(process.cwd(), "drizzle");
const firstMigration = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()[0];
const sql = readFileSync(join(migrationsDir, firstMigration), "utf8");

describe("first migration", () => {
  it("creates the four v1 tables", () => {
    for (const table of ["options", "tags", "option_tags", "dinner_log"]) {
      expect(sql).toContain(`CREATE TABLE "${table}"`);
    }
  });

  it("defines the home/restaurant kind enum", () => {
    expect(sql).toContain(
      `CREATE TYPE "public"."option_kind" AS ENUM('home', 'restaurant')`,
    );
  });

  it("enforces case-insensitive Tag uniqueness on lower(name)", () => {
    expect(sql).toContain(`UNIQUE INDEX "tags_lower_name_unique"`);
    expect(sql).toContain(`lower("name")`);
  });

  it("cascades option_tags deletes from both foreign keys", () => {
    expect(sql).toContain(
      `"option_tags_option_id_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."options"("id") ON DELETE cascade`,
    );
    expect(sql).toContain(
      `"option_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade`,
    );
  });

  it("restricts dinner_log deletes so a logged Option cannot be hard-deleted", () => {
    expect(sql).toContain(
      `"dinner_log_option_id_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."options"("id") ON DELETE restrict`,
    );
  });

  it("blocks logging the same Option twice on one date", () => {
    expect(sql).toContain(`UNIQUE("option_id","eaten_on")`);
  });
});
