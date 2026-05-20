/**
 * Tonight's-dinner module — a deep, pure split of the Tonight screen into its
 * two modes (PRD: Tonight — decided mode). No DB, no React: given the ranked
 * Tonight rows and the Log entries dated on the anchor day it decides what has
 * been Picked and what is still pickable.
 *
 * The anchor day is the Tonight screen's **Selected day** (ADR-0009), which
 * defaults to today and may be a future date the Household stepped to. The
 * Tonight screen keys its mode off the result: an empty `tonightsDinner` is
 * picker mode, a non-empty one is decided mode. The anchor-day filter lives in
 * the caller (the page query that loads the entries), so this module stays
 * date-agnostic — feed it the entries for *the* anchor day and it does the
 * right thing whether that day is today or Friday.
 */
import type { TonightRow } from "./ranking";

/**
 * A `dinner_log` row dated on the anchor day, narrowed to what the decided
 * view needs. `createdAt` gives the pick order; `id` is the handle the
 * decided row's "Remove" deletes (issue 03).
 */
export type TodayLogEntry = {
  id: string;
  optionId: string;
  /** Row creation time — the Pick's wall-clock instant. */
  createdAt: Date;
};

/** One Option in Tonight's dinner: its Tonight row plus its Log entry id. */
export type TonightsDinnerEntry = {
  /** The today Log entry's id — the handle "Remove" deletes (issue 03). */
  entryId: string;
  row: TonightRow;
};

/** The Tonight screen split into its decided block and its picker list. */
export type SplitTonight = {
  /** The Picked Options, in pick order — oldest `createdAt` first. */
  tonightsDinner: TonightsDinnerEntry[];
  /** The ranked rows with every already-Picked Option removed. */
  picker: TonightRow[];
};

/**
 * Split the Tonight screen given the live ranked rows, the Log entries dated
 * on the anchor day, and `decidedRows`.
 *
 * `tonightsDinner` is the Picked Options ordered by pick order, oldest first,
 * so a multi-Option Dinner reads as how the evening came together and never
 * reshuffles when another Option is added. Each Option's row is taken from
 * `decidedRows` — the same Catalog ranked over the Log *before the anchor day*
 * — so a just-Picked Option's Recency and Tag chips show how overdue it was
 * when it was Picked rather than a meaningless "0d". `picker` is the live
 * `rankedRows` minus every Picked Option, so the picker only ever offers what
 * is not yet Picked, ranked as it is now.
 *
 * An anchor-day Log entry whose Option is not in `decidedRows` — e.g. the
 * Option was Archived after it was Picked — has no row to render; it is
 * skipped without error rather than crashing the screen.
 */
export function splitTonight(
  rankedRows: TonightRow[],
  todayEntries: TodayLogEntry[],
  decidedRows: TonightRow[],
): SplitTonight {
  const decidedByOptionId = new Map(
    decidedRows.map((row) => [row.option.id, row]),
  );

  const ordered = [...todayEntries].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );

  const tonightsDinner: TonightsDinnerEntry[] = [];
  const pickedOptionIds = new Set<string>();
  for (const entry of ordered) {
    const row = decidedByOptionId.get(entry.optionId);
    if (!row) continue;
    pickedOptionIds.add(entry.optionId);
    tonightsDinner.push({ entryId: entry.id, row });
  }

  const picker = rankedRows.filter(
    (row) => !pickedOptionIds.has(row.option.id),
  );

  return { tonightsDinner, picker };
}

/** The three action-button labels a decided row can surface. */
export type DecidedActionLabel = "Menu" | "Call" | "Recipe";

/**
 * One action button on a decided row: its label and the `href` it opens. A
 * "Call" button's `href` is a `tel:` link; "Menu" and "Recipe" open the
 * Option's `url`.
 */
export type DecidedAction = {
  label: DecidedActionLabel;
  href: string;
};

/**
 * Return `url` only when it parses as an `http(s)` link. A Catalog `url` is
 * free text the Household typed and is never scheme-checked on save, so a
 * `javascript:` or `data:` value must not become a clickable action button —
 * the decided row's Menu / Recipe `href` is the first place a Catalog `url`
 * is rendered as a live link. Anything that is not http/https yields no button.
 */
function safeHttpUrl(url: string): string | null {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/**
 * The action buttons a Picked Option's decided row should render.
 *
 * A **Restaurant** yields a "Menu" button (its `url`) and a "Call" button (a
 * `tel:` link from its `phone`); a **Home meal** yields a "Recipe" button (its
 * `url`). A button appears only when its source field is set, so a Restaurant
 * with no `phone` gets no "Call" and an Option with neither field gets no
 * buttons at all — the decided view never shows a dead control. A `url` that
 * is not an `http(s)` link yields no button either (see `safeHttpUrl`).
 *
 * The `url` button is labelled "Menu" for a Restaurant regardless of whether
 * the link is a menu or an order/delivery page. A Home meal never yields "Menu"
 * or "Call": its `phone` is ignored even on the off chance one is set.
 */
export function decidedActions(option: {
  kind: "home" | "restaurant";
  url: string | null;
  phone: string | null;
}): DecidedAction[] {
  const actions: DecidedAction[] = [];
  const link = option.url ? safeHttpUrl(option.url) : null;
  if (option.kind === "restaurant") {
    if (link) actions.push({ label: "Menu", href: link });
    if (option.phone) {
      actions.push({ label: "Call", href: `tel:${option.phone}` });
    }
  } else if (link) {
    actions.push({ label: "Recipe", href: link });
  }
  return actions;
}
