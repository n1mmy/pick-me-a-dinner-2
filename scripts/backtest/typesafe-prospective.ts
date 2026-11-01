/**
 * Jev asked about today before the Household decides: one state 6 request
 * with the judgments (`scripts/backtest/typesafe-eval.ts`, long context), saved in the
 * eval's format under `scripts/backtest-runs/jev-prospective-noul-reasoning/
 * <day>.txt` with the day added to `jev-prospective-days.txt`. Run once a day
 * before dinner, by hand or from a scheduler; a day already saved is not asked
 * again. Once the days are decided, `scripts/backtest/typesafe-rerank.ts` scores every
 * arm on them with no further call:
 *
 *   npx tsx scripts/backtest/typesafe-prospective.ts                # today, one billed call (~$0.002)
 *   npx tsx scripts/backtest/typesafe-prospective.ts --dry-run      # the request's size, no call
 *   npx tsx scripts/backtest/typesafe-rerank.ts --run=scripts/backtest-runs/jev-prospective \
 *     --days-file=scripts/backtest-runs/jev-prospective-days.txt --json
 *
 * The snapshot is built in backtest mode, as it is for a past day, so a Pick
 * already Logged for today is left out of what Jev reads. The three-way mean
 * and the `all+due+regular` arm's top five are printed for the eye.
 * `TYPESAFE_API_KEY`, `DATABASE_URL` and `APP_TZ` from `.env.local` then `.env`.
 */
import "../load-env";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isValidSqlDate, today } from "../../lib/local-day";
import { snapshotForDay } from "../../lib/snapshot";
import { askJev, jevRequest } from "./typesafe-eval";
import { listsFor, meanOfRanks, order, type Saved, scoreView } from "./typesafe-lists";

const RUN = "scripts/backtest-runs/jev-prospective";
const DAYS_FILE = `${RUN}-days.txt`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const day = args.find((a) => a.startsWith("--day="))?.slice(6) ?? today();
  if (!isValidSqlDate(day)) {
    console.error(`--day must be YYYY-MM-DD, got ${day}`);
    process.exit(1);
  }
  const built = await snapshotForDay({ asOf: day, query: "", backtest: true });
  const file = `${RUN}-noul-reasoning/${day}.txt`;

  if (args.includes("--dry-run")) {
    const request = jevRequest(built, "6", "1");
    const chars = JSON.stringify(request).length;
    console.log(`day: ${built.snapshot.today}   candidates: ${built.snapshot.options.length}   questions: ${Object.keys(request.questions).length}`);
    console.log(`request: ${chars} chars (~${Math.round(chars / 4)} tokens)   saved to: ${file}`);
    return;
  }
  if (existsSync(file)) {
    console.log(`${day} is already saved in ${file}; not asking again.`);
    return;
  }
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    console.error("TYPESAFE_API_KEY is not set — add it to .env.local.");
    process.exit(1);
  }

  const call = await askJev(apiKey, built, "6", true, "1");
  if (!call.ok) {
    console.error(`TypeSafe call failed: ${call.error}`);
    process.exit(1);
  }
  mkdirSync(`${RUN}-noul-reasoning`, { recursive: true });
  writeFileSync(file, JSON.stringify({ request: call.request, response: call.response }, null, 2));
  const days = existsSync(DAYS_FILE) ? readFileSync(DAYS_FILE, "utf8").split(/\s+/).filter(Boolean) : [];
  if (!days.includes(day)) appendFileSync(DAYS_FILE, `${day}\n`);
  console.log(
    `${day}: ${call.response.model}, ${call.response.usage.input_tokens} input tokens, ` +
      `${(call.latencyMs / 1000).toFixed(1)}s → ${file}`,
  );

  const lists = listsFor(built, { request: call.request, response: call.response } as Saved, await scoreView(built));
  if (typeof lists === "string") {
    console.error(lists);
    return;
  }
  const name = (id: string) => built.nameById.get(id) ?? id;
  const top = (value: (id: string) => number) =>
    order(value, lists.score)
      .slice(0, 5)
      .map((row, i) => `${i + 1}. ${name(row.id)}`)
      .join("   ");
  console.log(`noul+choice+score:  ${top(meanOfRanks(lists.noul, lists.choice, lists.score))}`);
  console.log(
    `all+due+regular:    ${top(meanOfRanks(lists.noul, lists.choice, lists.score, lists.judgments!.due, lists.judgments!.regular))}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("TypeSafe prospective failed.");
    console.error(error);
    process.exit(1);
  });
