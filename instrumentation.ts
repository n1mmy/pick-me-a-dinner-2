/**
 * Next.js calls register() once per server instance at boot. We use it for the
 * startup schema check (plan §3): abort the boot when the DB is behind the
 * migrations bundled in the image, rather than serve pages that 500 on columns
 * the DB lacks.
 */
export async function register(): Promise<void> {
  // register() also fires in the Edge runtime; the schema check needs Node's
  // filesystem and the Postgres driver. Keeping the import inside this static
  // condition lets the Edge build drop it entirely.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { checkSchemaOnBoot } = await import("./lib/schema-check");
    await checkSchemaOnBoot();
  }
}
