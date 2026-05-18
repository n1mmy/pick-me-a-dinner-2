import type { ActionResult } from "./action-result";

/**
 * The SQLSTATE code on a thrown error, or `undefined` when the error is not a
 * Postgres driver error. Server actions branch on this to turn an *expected*
 * constraint or input violation into an inline message instead of letting it
 * surface as an uncaught 500 (review fixes F3, F4).
 */
export function pgErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return undefined;
}

/**
 * The set of write-failure *concepts* a mutating Server Action can map a
 * Postgres driver error onto. Each concept hides a SQLSTATE code from callers:
 *
 * - `duplicate` — a `23505` unique-constraint violation (e.g. an Option already
 *   logged for that date).
 * - `missingOption` — a `22P02` invalid-uuid or a `23503` foreign-key violation:
 *   a malformed or stale Option id pointing at a row that no longer exists.
 * - `restricted` — a `23503` read as an `ON DELETE RESTRICT` block: the row is
 *   referenced and cannot be deleted (e.g. an Option with Log history). When
 *   both `restricted` and `missingOption` are supplied, `restricted` wins for
 *   `23503`.
 *
 * Each key is optional — a write supplies only the failure modes it can hit.
 */
export type PgErrorMessages = {
  duplicate?: string;
  missingOption?: string;
  restricted?: string;
};

/**
 * Translate an *expected* Postgres driver error into an `ActionResult` failure,
 * keeping the SQLSTATE-to-message decision in one place so callers never branch
 * on a raw code themselves. The caller passes a `messages` map keyed by failure
 * *concept*; an error whose code is not covered by the supplied keys is
 * re-thrown unchanged, so an unforeseen failure still surfaces as a 500 rather
 * than a misleading inline message.
 */
export function pgErrorMessage(
  error: unknown,
  messages: PgErrorMessages,
): { ok: false; error: string } {
  const code = pgErrorCode(error);
  if (code === "23505" && messages.duplicate !== undefined) {
    return { ok: false, error: messages.duplicate };
  }
  if (code === "23503" && messages.restricted !== undefined) {
    return { ok: false, error: messages.restricted };
  }
  if (
    (code === "22P02" || code === "23503") &&
    messages.missingOption !== undefined
  ) {
    return { ok: false, error: messages.missingOption };
  }
  throw error;
}

// `ActionResult` is re-exported so a caller importing the translator has the
// failure-shape type to hand without a second import path.
export type { ActionResult };
