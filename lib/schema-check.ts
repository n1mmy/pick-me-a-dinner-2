import { readFile } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";

/** Parsed shape of `drizzle/meta/_journal.json` — only the entry list matters. */
interface DrizzleJournal {
  entries: unknown[];
}

/**
 * The outcome of the startup schema check. `ok` means the DB has every
 * migration bundled in the image applied; otherwise `behind` counts how many
 * are missing and `message` is the operator-facing line.
 */
export type SchemaCheck =
  | { ok: true }
  | { ok: false; behind: number; message: string };

/**
 * Decide whether the app may boot, given how many migrations the image bundles
 * and how many the DB has applied. The DB being *behind* is the only failure:
 * booting then would serve pages that 500 on columns the code expects but the
 * DB lacks. A DB *ahead* of the image (an older image against a newer DB) is
 * tolerated — the older code only touches columns that already exist.
 */
export function schemaCheckResult(
  bundled: number,
  applied: number,
): SchemaCheck {
  if (applied >= bundled) return { ok: true };
  const behind = bundled - applied;
  const noun = behind === 1 ? "migration" : "migrations";
  return {
    ok: false,
    behind,
    message: `DB schema ${behind} ${noun} behind — run drizzle-kit migrate`,
  };
}

/** Count the migration files bundled in the image, from the Drizzle journal. */
export async function bundledMigrationCount(): Promise<number> {
  const path = join(process.cwd(), "drizzle", "meta", "_journal.json");
  const journal = JSON.parse(await readFile(path, "utf8")) as DrizzleJournal;
  return journal.entries.length;
}

/**
 * Count the migrations Drizzle has recorded as applied in the target DB. A
 * brand-new DB has neither the `drizzle` schema nor the `__drizzle_migrations`
 * table, and both absences read as zero migrations applied.
 */
export async function appliedMigrationCount(): Promise<number> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 1 });
  try {
    const rows = await sql<{ count: number }[]>`
      select count(*)::int as count from drizzle.__drizzle_migrations
    `;
    return rows[0]?.count ?? 0;
  } catch (error) {
    const code = (error as { code?: string }).code;
    // 3F000 invalid_schema_name / 42P01 undefined_table — nothing applied yet.
    if (code === "3F000" || code === "42P01") return 0;
    throw error;
  } finally {
    await sql.end();
  }
}

/** The journal and DB counts; the live default for {@link checkSchemaOnBoot}. */
async function liveCounts(): Promise<{ bundled: number; applied: number }> {
  const [bundled, applied] = await Promise.all([
    bundledMigrationCount(),
    appliedMigrationCount(),
  ]);
  return { bundled, applied };
}

/**
 * The startup schema check (plan §3, review fix F7). `instrumentation.ts` runs
 * this once when a server boots:
 *  - DB *behind* the bundled migrations → log a loud, specific error and exit
 *    non-zero. That is a deploy-ordering mistake; crash-looping surfaces it.
 *  - DB *unreachable* → log a warning and continue. A transient outage must not
 *    crash-loop the whole fleet against a recovering database; the `/api/ready`
 *    probe holds traffic off each pod until the DB is back.
 *
 * `counts` is injectable only so tests can drive the behind case without a
 * real lagging DB.
 */
export async function checkSchemaOnBoot(
  counts: () => Promise<{ bundled: number; applied: number }> = liveCounts,
): Promise<void> {
  let bundled: number;
  let applied: number;
  try {
    ({ bundled, applied } = await counts());
  } catch (error) {
    console.warn(
      "[schema-check] could not reach the database at boot — continuing; " +
        "/api/ready will hold traffic off this pod until the DB recovers:",
      error,
    );
    return;
  }
  const result = schemaCheckResult(bundled, applied);
  if (result.ok) return;

  console.error(
    "\n" +
      "========================================================\n" +
      `  STARTUP ABORTED — ${result.message}\n` +
      "  The image is newer than the database. Apply migrations\n" +
      "  out of band, then restart this pod.\n" +
      "========================================================\n",
  );
  process.exit(1);
}
