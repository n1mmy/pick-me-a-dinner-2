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
 * and comes from `APP_SECRET`, which must be at least 32 characters. The §4
 * cookie flags are set explicitly so the contract is legible: `HttpOnly`,
 * `SameSite=Lax`, `Path=/`, and `Secure` — the last gated on `NODE_ENV`.
 *
 * `Secure` must be conditional. In production TLS terminates at the ingress,
 * the browser sees HTTPS, and the `Secure` cookie holds. But a browser
 * silently drops a `Secure` cookie set over plain HTTP unless the origin is
 * `localhost` — so an unconditional `Secure` breaks a `next dev` server
 * reached over HTTP by host IP: login appears to succeed but the cookie is
 * never stored, and every following request is unauthenticated.
 *
 * The gate is `NODE_ENV !== "development"`, not `=== "production"`, so it
 * **fails closed**: only `next dev` — which always sets exactly
 * `"development"` — drops `Secure`; an unset or unexpected `NODE_ENV` still
 * yields a `Secure` cookie rather than silently shipping the session over
 * plain HTTP in production.
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
      secure: process.env.NODE_ENV !== "development",
      sameSite: "lax",
      path: "/",
    },
  };
}
