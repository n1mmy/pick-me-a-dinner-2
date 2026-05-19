import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  sessionOptions,
} from "./session";

// At least 32 characters — iron-session's minimum sealing-password length.
const SECRET = "test-secret-at-least-32-characters-long";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sessionOptions", () => {
  it("throws when APP_SECRET is not set", () => {
    vi.stubEnv("APP_SECRET", "");
    expect(() => sessionOptions()).toThrow("APP_SECRET is not set");
  });

  it("carries the §4 cookie contract and the ~180-day TTL", () => {
    vi.stubEnv("APP_SECRET", SECRET);
    const options = sessionOptions();

    expect(options.cookieName).toBe(SESSION_COOKIE_NAME);
    expect(options.ttl).toBe(SESSION_TTL_SECONDS);
    expect(options.cookieOptions).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  });

  it("marks the session cookie Secure in production", () => {
    vi.stubEnv("APP_SECRET", SECRET);
    vi.stubEnv("NODE_ENV", "production");

    expect(sessionOptions().cookieOptions?.secure).toBe(true);
  });

  it("leaves the session cookie non-Secure in development", () => {
    // A `Secure` cookie set over plain HTTP is silently dropped by the browser
    // unless the origin is `localhost` — an unconditional `Secure` would break
    // a `next dev` server reached over HTTP by host IP (login would appear to
    // work, but no following request would be authenticated).
    vi.stubEnv("APP_SECRET", SECRET);
    vi.stubEnv("NODE_ENV", "development");

    expect(sessionOptions().cookieOptions?.secure).toBe(false);
  });

  it("keeps the session cookie Secure when NODE_ENV is unset — fails closed", () => {
    // The gate is `!== "development"`, so anything that is not positively dev
    // — an unset or unexpected `NODE_ENV` — still yields a `Secure` cookie,
    // never silently shipping the session over plain HTTP.
    vi.stubEnv("APP_SECRET", SECRET);
    vi.stubEnv("NODE_ENV", undefined);

    expect(sessionOptions().cookieOptions?.secure).toBe(true);
  });
});
