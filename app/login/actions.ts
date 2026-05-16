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
