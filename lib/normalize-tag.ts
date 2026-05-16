/**
 * Canonical form of a Tag string: trimmed and lowercased.
 *
 * Every Tag passes through this on input so "Pasta" and "pasta " never become
 * two Tags. It is a *shared* helper on purpose — both the tag-attach path in
 * the Catalog form and the import script must normalize identically, or the
 * `tags.lower(name)` unique index would see drift the two call sites disagree
 * on. Keep it a pure function with no other dependencies.
 */
export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase();
}
