"use client";

import Link from "next/link";
import { type FormEvent, useId, useState, useTransition } from "react";
import type { LogEntryRow, OptionChoice } from "../../db/queries";
import { type Dinner, formatDinnerDate } from "../../lib/dinner-grouping";
import { OptionCombobox } from "../option-combobox";
import { PickButton } from "../pick-button";
import { deleteLogEntry, updateLogEntry } from "./actions";

/**
 * The Log entry row and its inline edit form — shared by the Log screen and
 * the Option detail page's History section, so a logged Dinner is edited and
 * deleted in place the same way wherever it appears (PRD: Option detail page).
 */

export const labelClass =
  "text-meta font-emphasis uppercase tracking-wide text-muted";
export const inputClass =
  "min-h-11 rounded-input border border-line bg-surface px-3 text-body text-ink " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-action";
const actionButton =
  "min-h-11 rounded-control px-2 text-chip focus-visible:outline " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action";

/** One Dinner: a date header above its one-or-more Log entry rows. */
export function DinnerGroup({
  dinner,
  optionChoices,
  today,
}: {
  dinner: Dinner<LogEntryRow>;
  optionChoices: OptionChoice[];
  today: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-chip font-emphasis text-muted">
        {formatDinnerDate(dinner.date, today)}
      </h3>
      <ul className="flex flex-col">
        {dinner.entries.map((entry) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            optionChoices={optionChoices}
          />
        ))}
      </ul>
    </div>
  );
}

/**
 * One Log entry row. Shows the Option name and note with Edit / Delete actions;
 * Edit expands the row in place into the form, Delete uses the §17
 * inline-confirm pattern. A saved edit collapses with a quiet "Saved".
 */
export function EntryRow({
  entry,
  optionChoices,
}: {
  entry: LogEntryRow;
  optionChoices: OptionChoice[];
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const kindBg =
    entry.kind === "restaurant" ? "bg-kind-restaurant-wash" : "bg-kind-home-wash";

  function runDelete() {
    startTransition(async () => {
      await deleteLogEntry(entry.id);
    });
  }

  function handleSaved() {
    setEditing(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  if (editing) {
    return (
      <li className={`border-b border-line ${kindBg} px-3 py-3`}>
        <EntryEditForm
          entry={entry}
          optionChoices={optionChoices}
          onCancel={() => setEditing(false)}
          onSaved={handleSaved}
        />
      </li>
    );
  }

  return (
    <li className={`flex flex-col gap-1 border-b border-line ${kindBg} px-3 py-3`}>
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/catalog/${entry.optionId}`}
          className="font-display text-name font-name text-ink underline-offset-2
            hover:underline focus-visible:outline focus-visible:outline-2
            focus-visible:outline-offset-2 focus-visible:outline-action"
        >
          {entry.optionName}
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          {saved && (
            <span className="text-chip text-success" aria-live="polite">
              Saved
            </span>
          )}
          {confirmDelete ? (
            <>
              <button
                type="button"
                disabled={pending}
                className={`${actionButton} font-emphasis text-danger`}
                onClick={runDelete}
              >
                Delete
              </button>
              <span aria-hidden="true" className="text-chip text-muted">
                ·
              </span>
              <button
                type="button"
                disabled={pending}
                className={`${actionButton} text-muted`}
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`${actionButton} text-muted`}
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
              <button
                type="button"
                className={`${actionButton} text-danger`}
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </button>
            </>
          )}
          <PickButton optionId={entry.optionId} />
        </div>
      </div>
      {entry.note && <p className="text-chip text-muted">{entry.note}</p>}
    </li>
  );
}

/**
 * The inline edit form for one Log entry: change the Option, the date
 * (`eaten_on` — including moving the entry between history and Upcoming), or
 * the note. An edit that collides with an existing `(option_id, eaten_on)` is
 * rejected with an inline error under the date field, the input preserved.
 */
function EntryEditForm({
  entry,
  optionChoices,
  onCancel,
  onSaved,
}: {
  entry: LogEntryRow;
  optionChoices: OptionChoice[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const fieldId = useId();
  // Seeded with the entry's current Option so the picker opens pre-filled. A
  // since-Archived Option is absent from `optionChoices`, so the combobox
  // displays it from `valueName` (the entry's own `optionName`) instead.
  const [optionId, setOptionId] = useState<string | null>(entry.optionId);
  const [eatenOn, setEatenOn] = useState(entry.eatenOn);
  const [note, setNote] = useState(entry.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!optionId) {
      setError("Pick an Option");
      return;
    }
    if (!eatenOn) {
      setError("Pick a valid date");
      return;
    }
    startTransition(async () => {
      const result = await updateLogEntry(entry.id, {
        optionId,
        eatenOn,
        note,
      });
      if (result.ok) {
        onSaved();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor={`${fieldId}-option`} className={labelClass}>
          Option
        </label>
        <OptionCombobox
          id={`${fieldId}-option`}
          choices={optionChoices}
          value={optionId}
          valueName={entry.optionName}
          onChange={(id) => {
            setOptionId(id);
            if (id) setError(null);
          }}
          placeholder="Search Options"
        />
        {error === "Pick an Option" && (
          <p
            id={`${fieldId}-error`}
            className="text-chip text-danger"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${fieldId}-date`} className={labelClass}>
          Date
        </label>
        <input
          id={`${fieldId}-date`}
          type="date"
          className={inputClass}
          value={eatenOn}
          onChange={(event) => setEatenOn(event.target.value)}
          aria-invalid={error !== null && error !== "Pick an Option"}
          aria-describedby={
            error && error !== "Pick an Option"
              ? `${fieldId}-error`
              : undefined
          }
        />
        {error && error !== "Pick an Option" && (
          <p id={`${fieldId}-error`} className="text-chip text-danger">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${fieldId}-note`} className={labelClass}>
          Note
        </label>
        <textarea
          id={`${fieldId}-note`}
          className={`${inputClass} py-2`}
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-control bg-action px-4 text-body
            font-emphasis text-action-ink transition-colors duration-micro
            hover:bg-action-hover focus-visible:outline focus-visible:outline-2
            focus-visible:outline-offset-2 focus-visible:outline-action
            disabled:opacity-60"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="min-h-11 rounded-control px-3 text-body text-muted
            focus-visible:outline focus-visible:outline-2
            focus-visible:outline-offset-2 focus-visible:outline-action"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
