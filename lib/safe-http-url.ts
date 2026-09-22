/**
 * Return `url` only when it parses as an `http(s)` link. A Catalog `url` (or
 * a Restaurant's `mapsUrl`) is free text the Household typed and is never
 * scheme-checked on save, so a `javascript:` or `data:` value must never
 * become a live link — every render of one as an `<a href>` passes through
 * this guard: Tonight's decided-row Menu / Recipe buttons (`decidedActions`)
 * and the Option detail page's Link / Map fields alike. Anything that is not
 * http/https yields `null`; the caller picks the fallback — no action button
 * on the decided row, the raw value as plain text on the detail page.
 */
export function safeHttpUrl(url: string): string | null {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}
