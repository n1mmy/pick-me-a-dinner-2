"use server";

import { redirect } from "next/navigation";
import { getSession } from "../../lib/get-session";
import { passwordMatches } from "../../lib/password";

/**
 * The Login form's result. An `error` is the inline message shown under the
 * field; on success the action redirects and never returns a value.
 */
export type LoginState = { error?: string };

/**
 * Validate the submitted shared password (ADR-0002). On a match, establish the
 * sealed iron-session cookie and send the Household to Tonight. A wrong password
 * returns an inline error — no lockout, no rate limit — and React 19 resets the
 * uncontrolled form, clearing the field.
 *
 * This is the **one** Server Action deliberately *not* `authedAction`-wrapped
 * (review fix F1): it cannot require a session, because it is how a session
 * starts. It is safe to leave public — it only ever sets a session for a
 * caller who already knows `APP_PASSWORD`.
 */
export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const expected = process.env.APP_PASSWORD;
  if (!expected) throw new Error("APP_PASSWORD is not set");

  const submitted = String(formData.get("password") ?? "");
  if (!passwordMatches(submitted, expected)) {
    return { error: "Incorrect password" };
  }

  const session = await getSession();
  session.authenticated = true;
  await session.save();
  redirect("/");
}

export async function logout(): Promise<void> {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}
