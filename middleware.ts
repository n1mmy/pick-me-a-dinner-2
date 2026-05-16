import { NextResponse, type NextRequest } from "next/server";
import { unsealData } from "iron-session";
import {
  SESSION_COOKIE_NAME,
  sessionOptions,
  type AppSession,
} from "./lib/session";

/**
 * The §4 security headers, applied to every response the middleware returns.
 * `'unsafe-inline'` covers Next.js's framework-injected inline boot scripts and
 * styles; `'unsafe-eval'` is added only in development, where HMR needs it.
 */
function securityHeaders(): Record<string, string> {
  const scriptSrc =
    process.env.NODE_ENV === "production"
      ? "script-src 'self' 'unsafe-inline'"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
  return {
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  };
}

/** Stamp the §4 headers onto a response and return it. */
function withSecurityHeaders(response: NextResponse): NextResponse {
  for (const [name, value] of Object.entries(securityHeaders())) {
    response.headers.set(name, value);
  }
  return response;
}

/**
 * Whether the request carries a valid, unexpired session cookie. iron-session's
 * `unsealData` returns `{}` for a missing, tampered, or expired seal, so an
 * expired cookie fails this check exactly like an absent one.
 */
async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const sealed = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sealed) return false;
  const { password, ttl } = sessionOptions();
  const session = await unsealData<AppSession>(sealed, { password, ttl });
  return session.authenticated === true;
}

/**
 * The shared-password route gate (ADR-0002, plan §4). Every route except
 * `/login` and `/api/ready` — and the static assets excluded by
 * `config.matcher` — requires a valid session; an unauthenticated or expired
 * request is redirected to `/login`. The §4 security headers ride on every
 * response either way.
 *
 * `/api/ready` is exempt so the k8s readiness probe can reach it without a
 * session. Unlike `/login`, exempting it is safe: it is a GET-only route
 * handler with no server-action dispatch surface (review fix F1/F7).
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  if (pathname === "/login" || pathname === "/api/ready") {
    return withSecurityHeaders(NextResponse.next());
  }
  if (await isAuthenticated(request)) {
    return withSecurityHeaders(NextResponse.next());
  }
  const loginUrl = new URL("/login", request.url);
  return withSecurityHeaders(NextResponse.redirect(loginUrl));
}

export const config = {
  // Gate every route but the static assets Next.js serves without a session.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
