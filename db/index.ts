import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * The Drizzle database client, typed against the v1 schema.
 *
 * `postgres()` is lazy — it opens no socket until the first query — so
 * importing this module never connects. That is what lets `next build` run
 * with no `DATABASE_URL` (the Dockerfile builds the image without one): the
 * data pages are `force-dynamic`, so the build evaluates this module but never
 * queries it. The *running* server still needs `DATABASE_URL`; `lib/check-env.ts`
 * fails the boot loudly when it is unset (review fix F2 / F8).
 */
const client = postgres(process.env.DATABASE_URL ?? "");

export const db = drizzle(client, { schema });
