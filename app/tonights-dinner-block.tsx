import {
  decidedActions,
  type DecidedAction,
  type TonightsDinnerEntry,
} from "../lib/tonights-dinner";
import { KindBadge, RowTags } from "./tonight-row";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-accent";

/**
 * Tonight's dinner — the decided block (PRD: Tonight — decided mode). Under a
 * quiet "Tonight's dinner" sub-label it lists the Picked Options in pick order,
 * oldest first. Each row shows the Option name, its Home/Restaurant badge, and
 * its Tag chips with per-Tag recency — and deliberately no Explanation chip:
 * the chip exists to help *choose*, and the choice is already made.
 *
 * Each row also surfaces its action buttons — for a Restaurant a "Menu" and a
 * "Call", for a Home meal a "Recipe" — so once the choice is made the screen
 * helps the Household *act on it*. `decidedActions` decides which buttons a row
 * gets from the Option's `kind`, `url`, and `phone`, so a row with no source
 * field for an action simply shows no button.
 *
 * The decided row's inline "Remove" control is a separate slice — issue 03 —
 * and adds to this file later.
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
        {entries.map(({ entryId, row }) => {
          const actions = decidedActions(row.option);
          return (
            <li key={entryId} className="border-b border-line py-3">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-name font-name text-ink">
                  {row.option.name}
                </span>
                <KindBadge kind={row.option.kind} />
              </div>
              {row.tags.length > 0 && <RowTags tags={row.tags} />}
              {actions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {actions.map((action) => (
                    <ActionButton key={action.label} action={action} />
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * One decided-row action button — "Menu", "Call", or "Recipe". A plain anchor
 * so it is keyboard-operable for free; `min-h-11` plus the horizontal padding
 * keep it at least 44×44px for a comfortable kitchen tap. "Call" is a `tel:`
 * link; "Menu" and "Recipe" open the Option's `url` in a new tab.
 */
function ActionButton({ action }: { action: DecidedAction }) {
  const isCall = action.label === "Call";
  return (
    <a
      href={action.href}
      {...(isCall
        ? {}
        : { target: "_blank", rel: "noopener noreferrer" })}
      className={`inline-flex min-h-11 items-center rounded-control bg-accent
        px-4 text-body font-emphasis text-accent-ink transition-colors
        duration-short hover:bg-accent-dark ${focusRing}`}
    >
      {action.label}
    </a>
  );
}
