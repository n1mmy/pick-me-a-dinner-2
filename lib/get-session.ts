import { cookies } from "next/headers";
import { getIronSession, type IronSession } from "iron-session";
import { sessionOptions, type AppSession } from "./session";

/**
 * Read (or start) the iron-session for the current request — usable from server
 * components and server actions. It imports `next/headers`, so it must never be
 * pulled into middleware; the route gate there reads the cookie directly.
 */
export async function getSession(): Promise<IronSession<AppSession>> {
  return getIronSession<AppSession>(await cookies(), sessionOptions());
}
