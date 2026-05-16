import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time comparison of a submitted password against `APP_PASSWORD`
 * (ADR-0002 — plaintext compare, no hashing). `timingSafeEqual` requires
 * equal-length buffers, so a length mismatch short-circuits to `false`; the
 * length of the shared password is not a secret worth protecting under this
 * threat model. The byte comparison itself stays constant-time.
 */
export function passwordMatches(submitted: string, expected: string): boolean {
  const a = Buffer.from(submitted, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
