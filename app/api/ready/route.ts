import { sql } from "drizzle-orm";
import { db } from "../../../db";

/** The probe must hit the live DB on every call — never cache or prerender it. */
export const dynamic = "force-dynamic";

/**
 * Kubernetes readiness probe (plan §3, review fix F7). Returns 200 when the
 * database is reachable and 503 when it is not, so an unreachable DB marks the
 * pod not-ready — traffic is held off it — instead of crash-looping the fleet
 * against a recovering database. The k8s `readinessProbe` must target this path.
 */
export async function GET(): Promise<Response> {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
