import { revalidatePath } from "next/cache";

/**
 * Every mutating Server Action's revalidation set lives here — one module, so
 * the two sets can't drift apart the way the old per-file helpers did. The
 * rule: a write revalidates every route whose content it can change, and a
 * Catalog write can change Tonight — archiving, un-archiving, editing, or
 * hard-deleting an Option changes who is in Tonight's ranked list, so a
 * Catalog write must revalidate `/` too, not just `/catalog`.
 */

/**
 * Revalidate every screen a Log or Rejection write changes: Tonight's
 * ranking, the Log, and the Option detail page's History/Rejections section —
 * a Log or Rejection entry edited or deleted from the detail page must
 * refresh in place there too (PRD: Option detail page — controls behave
 * identically wherever invoked).
 */
export function revalidateDinnerViews(): void {
  revalidatePath("/");
  revalidatePath("/log");
  revalidatePath("/catalog/[id]", "page");
}

/**
 * Revalidate every screen a Catalog write changes: Tonight's ranked list, the
 * Catalog list, and the Option detail page. Every Catalog write — create,
 * edit, archive, un-archive, hard-delete — goes through here, so Tonight
 * never shows a stale ranked list after a Catalog change made elsewhere.
 */
export function revalidateCatalogViews(): void {
  revalidatePath("/");
  revalidatePath("/catalog");
  revalidatePath("/catalog/[id]", "page");
}
