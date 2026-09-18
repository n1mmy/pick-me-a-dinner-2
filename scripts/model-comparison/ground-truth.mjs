/**
 * Dump what the database actually says about one Option — its notes, tags,
 * every Rejection recorded against it, and when it was eaten.
 *
 *   npx tsx scripts/model-comparison/ground-truth.mjs Tadu
 *   npx tsx scripts/model-comparison/ground-truth.mjs Tadu --log=30
 *
 * A comparison that judges a ranking against a household constraint ("closed
 * Thursdays") has to establish the constraint from the DATA, not from the
 * rationales the models wrote — otherwise a shared hallucination reads as
 * ground truth and the model that ignored it looks wrong. That failure mode is
 * easy to fall into: a fluent rationale is indistinguishable from a datum until
 * you check. Makes no API call; needs `DATABASE_URL`.
 */
import "dotenv/config";
import { config } from "dotenv";
import { getActiveCatalog, getLog, getRejections } from "../../db/queries.ts";
import { todaySqlDate } from "../../lib/local-day.ts";

config({ override: true });

const args = process.argv.slice(2);
const needle = (args.find((a) => !a.startsWith("--")) ?? "").toLowerCase();
const logLimit = Number.parseInt(
  args.find((a) => a.startsWith("--log="))?.slice(6) ?? "10",
  10,
);

if (!needle) {
  console.error("usage: npx tsx ground-truth.mjs <option name substring> [--log=N]");
  process.exit(1);
}

const today = todaySqlDate(new Date(), process.env.APP_TZ ?? "UTC");
const [{ home, restaurants }, rejections, log] = await Promise.all([
  getActiveCatalog(),
  getRejections(),
  getLog(),
]);

const matches = [...home, ...restaurants].filter((o) =>
  o.name.toLowerCase().includes(needle),
);

if (!matches.length) {
  console.error(
    `no active Option matches "${needle}" (${home.length + restaurants.length} in the Catalog)`,
  );
  process.exit(1);
}

// Dates are printed against the anchor day, because "upcoming" vs "past" is
// the distinction the prompt asks the model to make for itself (ADR-0008).
console.log(`today: ${today}\n`);

for (const option of matches) {
  console.log(`=== ${option.name} (${option.kind}) ===`);
  console.log(`tags:  ${option.tags.join(", ") || "(none)"}`);
  console.log(`notes: ${option.notes ?? "(none)"}`);

  const when = (date) => (date > today ? "upcoming" : "past");

  const mine = rejections.filter((r) => r.optionId === option.id);
  console.log(`\nrejections (${mine.length}):`);
  for (const r of mine) {
    console.log(
      `  ${r.rejectedOn} [${when(r.rejectedOn)}]  ${r.reason ?? "(no reason)"}`,
    );
  }

  const eaten = log.filter((e) => e.optionId === option.id);
  console.log(`\neaten (${eaten.length}, newest first):`);
  for (const e of eaten.slice(0, logLimit)) {
    console.log(`  ${e.eatenOn} [${when(e.eatenOn)}]  ${e.note ?? ""}`);
  }
  if (eaten.length > logLimit) {
    console.log(`  … ${eaten.length - logLimit} more (--log=${eaten.length} for all)`);
  }
  console.log("");
}

process.exit(0);
