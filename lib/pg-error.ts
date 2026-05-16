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
