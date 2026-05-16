import { redirect } from "next/navigation";
import { getSession } from "./get-session";

/**
 * Require an authenticated session, or stop the request.
 *
 * Server Actions call this (via `authedAction`) so authentication is enforced
 * in the action itself. Route middleware cannot do it: Next.js dispatches a
 * Server Action by its `Next-Action` id regardless of which route the POST
 * hits — including the unauthenticated `/login` — so a route gate alone leaves
 * every action reachable by anonymous callers (review fix F1 / review C1).
 *
 * An unauthenticated caller is redirected to `/login`; `redirect` throws, so
 * the wrapped action never runs.
 */
export async function requireSession(): Promise<void> {
  const session = await getSession();
  if (session.authenticated !== true) {
    redirect("/login");
  }
}
