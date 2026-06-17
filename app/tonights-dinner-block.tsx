"use client";

import Link from "next/link";
import { type FormEvent, useId, useState, useTransition } from "react";
import {
  decidedActions,
  type DecidedAction,
  type TonightsDinnerEntry,
} from "../lib/tonights-dinner";
import { kindBarClass } from "./kind-bar";
import { deleteLogEntry, updateLogEntry } from "./log/actions";
import { inputClass, labelClass } from "./log/log-entry-row";
import { RowChips } from "./tonight-row";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-action";

// The decided row's filled action style — the charcoal `action` button the
// Menu / Call / Recipe links share, so they read as one set.
const actionFill =
  "inline-flex min-h-11 items-center rounded-control bg-action px-4 text-body " +
  `font-emphasis text-action-ink transition-colors duration-short hover:bg-action-hover ${focusRing}`;

/**
 * Tonight's dinner — the decided block (PRD: Tonight — decided mode). Under a
 * quiet "Tonight's dinner" sub-label it lists the Picked Options in pick order,
 * oldest first. Each row shows the Option name, the 3px meal-kind bar on its
 * left edge, and the Recency chip + Tag chips — the same chip row Tonight's
 * picker uses, so a decided dinner still shows how long it had been.
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
 *
 * And every row carries an inline, click-to-edit note (interaction principle,
 * ADR-0007 — the note is shown and edited wherever the Pick appears). The note
 * text sits under the chips as quiet muted copy — a faint "Add a note…" prompt
 * when none is set — and tapping it turns it into a textarea that saves the
 * Pick's `dinner_log` note via the existing `updateLogEntry` action. Saving an
 * empty one clears it. No button: the note itself is the affordance.
 */
export function TonightsDinnerBlock({
  entries,
  dayLabel,
  eatenOn,
}: {
  entries: TonightsDinnerEntry[];
  /**
   * Day-aware label noun — `"tonight"` for today, the weekday name (e.g.
   * `"Friday"`) when the Selected day is in the future (ADR-0009). Drives
   * both the visible H2 ("Tonight's dinner" vs "Friday's dinner") and the
   * section's accessible label.
   */
  dayLabel: string;
  /**
   * The anchor day every Pick in this block is dated on (the Selected day) —
   * the `eaten_on` the note editor passes to `updateLogEntry` to edit a row in
   * place without moving it to another day.
   */
  eatenOn: string;
}) {
  // "Tonight's dinner" reads with a capital T; a weekday name is already
  // proper-cased, so reuse it as-is. The aria-label uses a plain apostrophe
  // so assistive tech reads it cleanly; the visible H2 uses the typographic
  // curly apostrophe to match the rest of the screen's copy.
  const headingLeft = dayLabel === "tonight" ? "Tonight" : dayLabel;
  const ariaLabel = `${headingLeft}'s dinner`;
  return (
    <section aria-label={ariaLabel} className="flex flex-col gap-2">
      <h2 className="text-meta uppercase tracking-wide text-muted">
        {headingLeft}&rsquo;s dinner
      </h2>
      <ul className="flex flex-col">
        {entries.map((entry) => (
          <DecidedRow key={entry.entryId} entry={entry} eatenOn={eatenOn} />
        ))}
      </ul>
    </section>
  );
}

/**
 * One row of Tonight's dinner: the Picked Option's name with the inline
 * "Remove" control beside it and the 3px meal-kind bar on the left edge, then
 * the Recency + Tag chips, the click-to-edit note, and the Menu/Call/Recipe
 * action buttons. While the note editor is open the Menu/Call/Recipe row hides,
 * so the editor's Save/Cancel are the only buttons on the row.
 */
function DecidedRow({
  entry,
  eatenOn,
}: {
  entry: TonightsDinnerEntry;
  eatenOn: string;
}) {
  const { entryId, row, note } = entry;
  const actions = decidedActions(row.option);
  const [editing, setEditing] = useState(false);
  // A light wash of the Option's kind hue tints each decided row, so the
  // "Tonight's dinner" block reads as a distinct shaded area above the picker.
  const washClass =
    row.option.kind === "home"
      ? "bg-kind-home-wash"
      : "bg-kind-restaurant-wash";
  return (
    <li
      className={`border-b border-line py-3 last:border-b-0 ${washClass}
        ${kindBarClass(row.option.kind)}`}
    >
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/catalog/${row.option.id}`}
          className={`font-display text-name font-name text-ink
            underline-offset-2 hover:underline ${focusRing}`}
        >
          {row.option.name}
        </Link>
        <RemoveControl entryId={entryId} />
      </div>
      <RowChips
        recencyDays={row.recencyDays}
        neverEaten={row.neverEaten}
        tags={row.tags}
      />
      {editing ? (
        <NoteForm
          entryId={entryId}
          optionId={row.option.id}
          eatenOn={eatenOn}
          note={note}
          onClose={() => setEditing(false)}
        />
      ) : (
        <NoteRest note={note} onEdit={() => setEditing(true)} />
      )}
      {/* The Menu/Call/Recipe actions hide while the note editor is open, so the
          editor's Save/Cancel never sit beside another button row. */}
      {!editing && actions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {actions.map((action) => (
            <ActionButton key={action.label} action={action} />
          ))}
        </div>
      )}
    </li>
  );
}

/**
 * The decided row's resting note line (Q1 option C). The note shows as quiet
 * muted text — a faint "Add a note…" prompt when none is set — styled as a
 * full-width tappable area so the whole line is a comfortable kitchen tap
 * target. Tapping it opens the editor; the note text itself is the affordance,
 * so there is no separate button.
 */
function NoteRest({
  note,
  onEdit,
}: {
  note: string | null;
  onEdit: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={note ? "Edit note" : "Add note"}
      className={`mt-2 block min-h-11 w-full rounded-control px-1 py-1 text-left
        text-chip text-muted transition-colors duration-short ${focusRing} ${
          note ? "hover:text-ink" : "italic opacity-70 hover:opacity-100"
        }`}
    >
      {note ?? "Add a note…"}
    </button>
  );
}

/**
 * The decided row's inline note editor (interaction principle, ADR-0007). A
 * textarea seeded with the Pick's current note, saved via the existing
 * `updateLogEntry` action with the Option and date held fixed — so it edits the
 * note in place and never moves the entry to another day or collides with
 * another Pick. An empty note is cleared (`updateLogEntry` trims to null);
 * `updateLogEntry` revalidates Tonight, so on Save the row re-renders with the
 * new note. Errors surface inline the same way the Log editor's do.
 */
function NoteForm({
  entryId,
  optionId,
  eatenOn,
  note,
  onClose,
}: {
  entryId: string;
  optionId: string;
  eatenOn: string;
  note: string | null;
  onClose: () => void;
}) {
  const fieldId = useId();
  const [value, setValue] = useState(note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateLogEntry(entryId, {
        optionId,
        eatenOn,
        note: value,
      });
      if (result.ok) {
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-1">
      <label htmlFor={`${fieldId}-note`} className={labelClass}>
        Note
      </label>
      <textarea
        id={`${fieldId}-note`}
        className={`${inputClass} py-2`}
        rows={2}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        autoFocus
        aria-invalid={error !== null}
        aria-describedby={error ? `${fieldId}-error` : undefined}
      />
      {error && (
        <p id={`${fieldId}-error`} className="text-chip text-danger" role="alert">
          {error}
        </p>
      )}
      <div className="mt-1 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className={`min-h-11 rounded-control bg-action px-4 text-body
            font-emphasis text-action-ink transition-colors duration-micro
            hover:bg-action-hover disabled:opacity-60 ${focusRing}`}
        >
          Save
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className={`min-h-11 rounded-control px-3 text-body text-muted
            disabled:opacity-60 ${focusRing}`}
        >
          Cancel
        </button>
      </div>
    </form>
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
      className={actionFill}
    >
      {action.label}
    </a>
  );
}
