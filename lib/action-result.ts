/**
 * The shared result type for a mutating Server Action: it either succeeds, or
 * carries a single message to show inline. Catalog and Log writes both return
 * this — a write failure (a constraint violation, a stale Option id) becomes a
 * reported `{ ok: false }` rather than an uncaught 500.
 */
export type ActionResult = { ok: true } | { ok: false; error: string };

/** Trim a free-text form field, storing `null` rather than an empty string. */
export function trimToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
