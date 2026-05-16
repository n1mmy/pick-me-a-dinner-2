/**
 * Next.js calls register() once per server instance at boot. We use it for two
 * startup gates (plan §3):
 *  - the config check (review fix F8): exit non-zero when a required env var is
 *    missing or `APP_TZ` is not a valid zone — the build needs no env vars, but
 *    the running server does;
 *  - the schema check: abort the boot when the DB is behind the migrations
 *    bundled in the image, rather than serve pages that 500 on missing columns.
 */
export async function register(): Promise<void> {
  // register() also fires in the Edge runtime; both checks need Node's
  // filesystem and the Postgres driver. Keeping the imports inside this static
  // condition lets the Edge build drop them entirely.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { checkEnvOnBoot } = await import("./lib/check-env");
    checkEnvOnBoot();
    const { checkSchemaOnBoot } = await import("./lib/schema-check");
    await checkSchemaOnBoot();
  }
}
