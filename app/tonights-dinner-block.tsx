"use client";

import { useState, useTransition } from "react";
import {
  decidedActions,
  type DecidedAction,
  type TonightsDinnerEntry,
} from "../lib/tonights-dinner";
import { deleteLogEntry } from "./log/actions";
import { kindBarClass, RowTags } from "./tonight-row";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-action";

/**
 * Tonight's dinner — the decided block (PRD: Tonight — decided mode). Under a
 * quiet "Tonight's dinner" sub-label it lists the Picked Options in pick order,
 * oldest first. Each row shows the Option name, the 3px meal-kind bar on its
 * left edge, and its Tag chips with per-Tag recency — and deliberately no
 * Explanation chip: the chip exists to help *choose*, and the choice is made.
 *
 * Each row also surfaces its action buttons — for a Restaurant a "Menu" and a
 * "Call", for a Home meal a "Recipe" — so once the choice is made the screen
 * helps the Household *act on it*. `decidedActions` decides which buttons a row
 * gets from the Option's `kind`, `url`, and `phone`, so a row with no source
 * field for an action simply shows no button.
 *
 * Every row also carries an inline "Remove" control (issue 03) to undo a
 * mis-tapped Pick: it deletes today's Log entry for that Option via the
 * existing `deleteLogEntry` server action. The server then recomputes Tonight's
 * dinner — the Option drops out of this block and reappears in the picker — and
 * removing the last Option empties the block, so Tonight falls back to picker
 * mode with no extra logic here.
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
        {entries.map((entry) => (
          <DecidedRow key={entry.entryId} entry={entry} />
        ))}
      </ul>
    </section>
  );
}

/**
 * One row of Tonight's dinner: the Picked Option's name with the inline
 * "Remove" control beside it and the 3px meal-kind bar on the left edge, then
 * the Tag chips and the Menu/Call/Recipe action buttons.
 */
function DecidedRow({ entry }: { entry: TonightsDinnerEntry }) {
  const { entryId, row } = entry;
  const actions = decidedActions(row.option);
  return (
    <li className={`border-b border-line py-3 ${kindBarClass(row.option.kind)}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-name font-name text-ink">
          {row.option.name}
        </span>
        <RemoveControl entryId={entryId} />
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
}

const removeButton =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-control " +
  `px-2 text-chip transition-colors duration-short ${focusRing}`;

/**
 * The decided row's inline "Remove" control — the app's destructive-action
 * pattern (plan §17): a confirm step in place, no modal and no undo-toast, the
 * same as Delete on the Log screen. The first tap arms it; the armed "Remove"
 * then deletes today's Log entry for the Option via the existing
 * `deleteLogEntry` server action, and "Cancel" disarms it.
 *
 * `deleteLogEntry` revalidates Tonight, so on the next render the server drops
 * this row from the block (and, if it was the last one, returns the whole
 * screen to picker mode). The control therefore needs no post-delete cleanup —
 * it simply unmounts with its row.
 */
function RemoveControl({ entryId }: { entryId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function runRemove() {
    startTransition(async () => {
      await deleteLogEntry(entryId);
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={`${removeButton} shrink-0 text-danger`}
      >
        Remove
      </button>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={runRemove}
        className={`${removeButton} font-emphasis text-danger disabled:opacity-60`}
      >
        Remove
      </button>
      <span aria-hidden="true" className="text-chip text-muted">
        ·
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirming(false)}
        className={`${removeButton} text-muted disabled:opacity-60`}
      >
        Cancel
      </button>
    </div>
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
      className={`inline-flex min-h-11 items-center rounded-control bg-action
        px-4 text-body font-emphasis text-action-ink transition-colors
        duration-short hover:bg-action-hover ${focusRing}`}
    >
      {action.label}
    </a>
  );
}
