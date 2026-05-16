# 08 — Shared-password auth gate

Status: done
Type: AFK

## Parent

[PRD: Pick Me a Dinner — v1](../PRD.md)

## What to build

The single-shared-password access gate (ADR-0002).

Build the **Login screen** — a quiet, centered single password field; wordmark
reads "Pick Me a Dinner", no tagline, no marketing copy. The login server action
compares the submitted value against the plaintext `APP_PASSWORD` env var with
`crypto.timingSafeEqual` (constant-time, no hashing). On a correct password it
establishes a session with **`iron-session`** — a sealed (encrypted + signed)
cookie keyed by `APP_SECRET`, flags `HttpOnly` / `Secure` / `SameSite=Lax` /
`Path=/` and an embedded ~180-day TTL. A wrong password shows an inline error
under the field with the field cleared — no lockout, no rate limit. There is no
logout UI in v1.

Add **Next.js middleware** that validates the session cookie on every route
except `/login` and static assets, redirecting an unauthenticated or expired
request to `/login`. Add the §4 security headers via `next.config` / middleware:
HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` + CSP
`frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, and a baseline CSP.
The app trusts `X-Forwarded-Proto` so `Secure` cookies work behind the ingress
proxy.

## Acceptance criteria

- [x] The Login screen renders a centered single password field with the
      "Pick Me a Dinner" wordmark and no tagline
- [x] A correct password establishes an `iron-session` sealed cookie
      (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, ~180-day TTL)
- [x] A wrong password shows an inline error with the field cleared — no lockout
- [x] Middleware redirects an unauthenticated or expired request to `/login`;
      `/login` and static assets are not gated
- [x] The §4 security headers are present on responses
- [x] Tests: correct password establishes the session; wrong password → inline
      error; middleware redirects an unauthenticated / expired request

## Blocked by

- Issue 01 — Walking skeleton
