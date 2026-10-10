"use client";

import { type FormEvent, useId, useState, useTransition } from "react";
import { setDayNote } from "./day-note-actions";
import { escapeToCancel } from "./escape-to-cancel";
import { focusRing } from "./focus-ring";
import { inputClass, labelClass } from "./log/log-entry-row";
import { pressFeedback } from "./press-feedback";

// The absent state's add control — borderless and unfilled until hovered,
// matching the Log's per-date add buttons (DESIGN.md, "Button hierarchy").
const addButtonClass =
  "min-h-11 self-start rounded-control px-3 text-chip font-emphasis " +
  `text-muted transition-colors duration-micro hover:bg-raised hover:text-ink ${focusRing}`;

/**
 * A date's **Day note** line (PRD: Day notes) — the evening's context, shown
 * under Tonight's heading for the Selected day and under a Log date group's
 * header. The same control on both screens (ADR-0007): each screen supplies
 * only its wording — `addLabel` for the absent state's add button, `label` for
 * the editor's field.
 *
 * The note shows as muted body text; tapping it edits it in place, as does
 * the add button when there is none. Saving goes through `setDayNote`, which
 * revalidates both screens, so a save simply closes the editor and the new
 * note arrives with the refreshed props. Saving empty text clears the note.
 *
 * `placement="header"` is Tonight's: the line reads as a subtitle under the
 * H1. Its resting 44px tap area keeps the floor but bleeds 22px down into the
 * section gap below (`-mb-5.5`, exactly that gap, so it never reaches the
 * content) and 12px left into the column padding (`-ml-3`, so the text lines
 * up with the H1). It cannot bleed up — the H1 is itself a button. The open
 * editor stays in normal flow. On the Log the line sits directly above
 * interactive rows, so it keeps the plain `"group"` placement.
 */
export function DayNoteLine({
  notedOn,
  note,
  label,
  addLabel,
  placement = "group",
}: {
  /** The SQL date the note is about. */
  notedOn: string;
  note: string | null;
  label: string;
  addLabel: string;
  placement?: "header" | "group";
}) {
  const bleed = placement === "header" ? "-mb-5.5" : "";
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className={placement === "header" ? "mt-2" : ""}>
        <DayNoteForm
          notedOn={notedOn}
          note={note}
          label={label}
          onClose={() => setEditing(false)}
        />
      </div>
    );
  }
  if (note === null) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`${addButtonClass} ${placement === "header" ? "-ml-3" : ""} ${bleed}`}
      >
        {addLabel}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`min-h-11 self-start rounded-control text-left text-body
        text-muted transition-colors duration-short hover:text-ink ${focusRing} ${bleed}`}
    >
      {note}
    </button>
  );
}

/**
 * The Day note's inline editor — the decided row's note-editor pattern
 * (`NoteForm`), on a single-line field because a Day note is one line.
 * Escape cancels like the Cancel button; a failed save shows inline. Exported
 * for the Log, which opens it from its own per-date "+ Note" button.
 */
export function DayNoteForm({
  notedOn,
  note,
  label,
  onClose,
}: {
  notedOn: string;
  note: string | null;
  label: string;
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
      const result = await setDayNote(notedOn, value);
      if (result.ok) {
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={escapeToCancel(onClose, pending)}
      className="expand-in flex flex-col gap-1"
    >
      <label htmlFor={`${fieldId}-note`} className={labelClass}>
        {label}
      </label>
      <input
        id={`${fieldId}-note`}
        type="text"
        className={inputClass}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (pending) return;
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
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
            font-emphasis text-action-ink hover:bg-action-hover
            disabled:opacity-60 ${pressFeedback} ${focusRing}`}
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
