import type { TonightsDinnerEntry } from "../lib/tonights-dinner";
import { KindBadge, RowTags } from "./tonight-row";

/**
 * Tonight's dinner — the decided block (PRD: Tonight — decided mode). Under a
 * quiet "Tonight's dinner" sub-label it lists the Picked Options in pick order,
 * oldest first. Each row shows the Option name, its Home/Restaurant badge, and
 * its Tag chips with per-Tag recency — and deliberately no Explanation chip:
 * the chip exists to help *choose*, and the choice is already made.
 *
 * The decided row's action buttons (Menu / Call / Recipe) and inline "Remove"
 * are separate slices — issues 02 and 03 — and add to this file later.
 */
export function TonightsDinnerBlock({
  entries,
}: {
  entries: TonightsDinnerEntry[];
}) {
  return (
    <section aria-label="Tonight's dinner" className="flex flex-col gap-2">
      <h2 className="text-meta uppercase tracking-wide text-muted">
        Tonight&rsquo;s dinner
      </h2>
      <ul className="flex flex-col">
        {entries.map(({ entryId, row }) => (
          <li key={entryId} className="border-b border-line py-3">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-name font-name text-ink">
                {row.option.name}
              </span>
              <KindBadge kind={row.option.kind} />
            </div>
            {row.tags.length > 0 && <RowTags tags={row.tags} />}
          </li>
        ))}
      </ul>
    </section>
  );
}
