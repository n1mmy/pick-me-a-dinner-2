import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { sealData } from "iron-session";
import { middleware } from "./middleware";
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "./lib/session";

// At least 32 characters — iron-session's minimum sealing-password length.
const SECRET = "test-secret-at-least-32-characters-long";

function requestFor(path: string, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    headers: cookie ? { cookie } : undefined,
  });
}

/** A sealed session cookie header, as `login`'s `session.save()` would write. */
async function sessionCookie(authenticated: boolean): Promise<string> {
  const sealed = await sealData(
    { authenticated },
    { password: SECRET, ttl: SESSION_TTL_SECONDS },
  );
  return `${SESSION_COOKIE_NAME}=${sealed}`;
}

beforeEach(() => {
  process.env.APP_SECRET = SECRET;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("middleware route gate", () => {
  it("redirects an unauthenticated request to /login", async () => {
    const response = await middleware(requestFor("/catalog"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });

  it("leaves /login itself ungated", async () => {
    const response = await middleware(requestFor("/login"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("lets an authenticated request through", async () => {
    const response = await middleware(
      requestFor("/", await sessionCookie(true)),
    );

    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects a request whose session cookie is malformed", async () => {
    const response = await middleware(
      requestFor("/", `${SESSION_COOKIE_NAME}=not-a-real-seal`),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });

  it("redirects a request whose session cookie has expired", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-16T12:00:00Z"));
    const cookie = await sessionCookie(true);

    // Jump a year ahead — well past the ~180-day embedded TTL.
    vi.setSystemTime(new Date("2027-05-16T12:00:00Z"));
    const response = await middleware(requestFor("/", cookie));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });
});

describe("middleware security headers", () => {
  it("stamps the §4 headers onto responses", async () => {
    const response = await middleware(requestFor("/login"));

    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("strict-transport-security")).toContain(
      "max-age=",
    );
    expect(response.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'none'",
    );
  });
});
