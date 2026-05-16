import type { SessionOptions } from "iron-session";

/**
 * The sealed session payload. A single boolean is all v1 needs: the app is
 * single-Household with no per-person identity (ADR-0002), so a valid session
 * means "this browser cleared the shared-password gate" and nothing more.
 */
export interface AppSession {
  authenticated?: boolean;
}

/** The name of the sealed iron-session cookie. */
export const SESSION_COOKIE_NAME = "pmad_session";

/**
 * ~180 days, in seconds — the TTL embedded in the sealed cookie. A copied
 * cookie self-expires after this rather than replaying until `APP_SECRET` is
 * rotated (ADR-0002, plan §4).
 */
export const SESSION_TTL_SECONDS = 180 * 24 * 60 * 60;

/**
 * iron-session configuration. `password` seals (encrypts + signs) the cookie
 * and comes from `APP_SECRET`, which must be at least 32 characters. The cookie
 * flags happen to be iron-session's defaults but are set explicitly so the §4
 * contract is legible: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`. TLS
 * terminates at the ingress and the app trusts `X-Forwarded-Proto`, so the
 * `Secure` cookie survives behind the proxy.
 */
export function sessionOptions(): SessionOptions {
  const password = process.env.APP_SECRET;
  if (!password) throw new Error("APP_SECRET is not set");
  return {
    password,
    cookieName: SESSION_COOKIE_NAME,
    ttl: SESSION_TTL_SECONDS,
    cookieOptions: {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    },
  };
}
