/**
 * Boot-time configuration gate (plan §3, review fix F8).
 *
 * The build needs no env vars (F2), but a *running* server with a missing or
 * invalid one is a configuration error that should fail loudly at startup
 * rather than surface later — a wrong-`APP_TZ` dinner silently logged on the
 * wrong calendar day, or a 500 on the first DB query. `instrumentation.ts`
 * calls {@link checkEnvOnBoot} first, before the schema check.
 */

/** The env vars the running server cannot function without. */
const REQUIRED = ["DATABASE_URL", "APP_SECRET", "APP_PASSWORD", "APP_TZ"] as const;

/** Whether `zone` is an IANA time zone the runtime's `Intl` accepts. */
function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Inspect the environment and return the list of problems — empty when the
 * config is sound. Pure over its `env` argument so it is testable without
 * mutating the real process environment.
 */
export function envProblems(
  env: Record<string, string | undefined> = process.env,
): string[] {
  const problems: string[] = [];
  for (const name of REQUIRED) {
    if (!env[name]) problems.push(`${name} is not set`);
  }
  const tz = env.APP_TZ;
  if (tz && !isValidTimeZone(tz)) {
    problems.push(`APP_TZ is not a valid IANA time zone: "${tz}"`);
  }
  return problems;
}

/**
 * Run {@link envProblems}; on any problem, log every line and exit non-zero so
 * the pod crash-loops visibly on a misconfiguration instead of serving traffic
 * with broken config.
 */
export function checkEnvOnBoot(): void {
  const problems = envProblems();
  if (problems.length === 0) return;

  console.error(
    "\n" +
      "========================================================\n" +
      "  STARTUP ABORTED — configuration error\n" +
      problems.map((problem) => `    - ${problem}`).join("\n") +
      "\n" +
      "========================================================\n",
  );
  process.exit(1);
}
