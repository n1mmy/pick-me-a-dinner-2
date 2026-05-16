import { beforeEach, describe, expect, it, vi } from "vitest";

/** A stand-in for the iron-session object `getSession` would return. */
const save = vi.fn();
let session: { authenticated?: boolean; save: typeof save };

// The real getSession reads `next/headers` cookies — unavailable outside a
// request scope — so the test swaps in a plain object and watches `save`.
vi.mock("../../lib/get-session", () => ({
  getSession: vi.fn(async () => session),
}));

// The real `redirect` throws a framework control-flow error; mirror that so
// `login` still never returns on success.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

import { login } from "./actions";

function passwordForm(password: string): FormData {
  const form = new FormData();
  form.set("password", password);
  return form;
}

beforeEach(() => {
  process.env.APP_PASSWORD = "open-sesame";
  session = { authenticated: false, save };
  save.mockClear();
});

describe("login", () => {
  it("establishes the session and redirects to Tonight on the correct password", async () => {
    await expect(login({}, passwordForm("open-sesame"))).rejects.toThrow(
      "NEXT_REDIRECT:/",
    );

    expect(session.authenticated).toBe(true);
    expect(save).toHaveBeenCalledOnce();
  });

  it("shows an inline error and establishes no session on a wrong password", async () => {
    const result = await login({}, passwordForm("not-the-password"));

    expect(result).toEqual({ error: "Incorrect password" });
    expect(session.authenticated).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });
});
