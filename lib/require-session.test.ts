import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.fn();
const getSession = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => redirect(...args),
}));
vi.mock("./get-session", () => ({ getSession: () => getSession() }));

import { requireSession } from "./require-session";

beforeEach(() => {
  redirect.mockClear();
  getSession.mockReset();
});

describe("requireSession (auth by default — review fix F1)", () => {
  it("passes an authenticated session through without redirecting", async () => {
    getSession.mockResolvedValue({ authenticated: true });

    await requireSession();

    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects to /login when there is no session", async () => {
    getSession.mockResolvedValue({});

    await requireSession();

    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("redirects to /login when authenticated is explicitly false", async () => {
    getSession.mockResolvedValue({ authenticated: false });

    await requireSession();

    expect(redirect).toHaveBeenCalledWith("/login");
  });
});
