"use client";

import Link from "next/link";
import { type FormEvent, useId, useState, useTransition } from "react";
import type { LogRejectionRow, OptionChoice } from "../../db/queries";
import { OptionCombobox } from "../option-combobox";
import { inputClass, labelClass } from "./log-entry-row";
import {
  createRejection,
  deleteRejection,
  updateRejection,
} from "../rejection-actions";

/**
 * The Rejection row and its inline forms — shared by the Log screen and the
 * Option detail page's Rejections section (PRD: Dated Rejections — Option
 * detail page parity), so a Rejection is added, edited, and deleted in place
 * the same way wherever it appears. It mirrors `EntryRow` / `EntryEditForm`:
 * Edit expands the row into a form, Delete uses the §17 inline-confirm.
 */

const actionButton =
  "min-h-11 rounded-control px-2 text-chip focus-visible:outline " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action";

/**
 * The form body shared by the add-rejection form and the inline edit form: an
 * Option picker (the shared type-ahead `OptionCombobox`), a date, and an
 * optional reason, with Save/Add and Cancel. The add form opens with no Option
 * selected and blocks submit with an inline "Pick an Option" error; the edit
 * form opens pre-filled with the Rejection's current Option. A failed write —
 * a duplicate `(option_id, rejected_on)` or a stale Option — sets `error`,
 * shown inline under the date and never flashed as a success.
 */
function RejectionForm({
  optionChoices,
  initialOptionId,
  initialDate,
  initialReason,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  optionChoices: OptionChoice[];
  initialOptionId: string | null;
  initialDate: string;
  initialReason: string;
  submitLabel: string;
  onSubmit: (values: {
    optionId: string;
    rejectedOn: string;
    reason: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  onCancel: () => void;
}) {
  const fieldId = useId();
  const [optionId, setOptionId] = useState<string | null>(initialOptionId);
  const [rejectedOn, setRejectedOn] = useState(initialDate);
  const [reason, setReason] = useState(initialReason);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!optionId) {
      setError("Pick an Option");
      return;
    }
    if (!rejectedOn) {
      setError("Pick a valid date");
      return;
    }
    startTransition(async () => {
      const result = await onSubmit({ optionId, rejectedOn, reason });
      if (!result.ok) setError(result.error);
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
          onChange={setOptionId}
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
          value={rejectedOn}
          onChange={(event) => setRejectedOn(event.target.value)}
          aria-invalid={error !== null && error !== "Pick an Option"}
          aria-describedby={
            error && error !== "Pick an Option"
              ? `${fieldId}-error`
              : undefined
          }
        />
        {error && error !== "Pick an Option" && (
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
        <label htmlFor={`${fieldId}-reason`} className={labelClass}>
          Reason <span className="font-normal normal-case">(optional)</span>
        </label>
        <input
          id={`${fieldId}-reason`}
          type="text"
          className={inputClass}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
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
          {submitLabel}
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

/**
 * The inline "Add a rejection" form (PRD: Dated Rejections — adding a dated
 * Rejection): record a Rejection by hand for a deliberately chosen date — a
 * past date backfills one never tapped on Tonight, today records one from the
 * Log, a future date is a Planned rejection. The reason is optional. A
 * duplicate `(option_id, rejected_on)` is reported inline, never as success.
 *
 * `defaultDate` lets a date-group pre-fill the group's own date so the
 * Household does not re-type the date it is already looking at.
 */
export function AddRejectionForm({
  optionChoices,
  defaultDate,
  onCancel,
  onSaved,
}: {
  optionChoices: OptionChoice[];
  defaultDate: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  return (
    <RejectionForm
      optionChoices={optionChoices}
      initialOptionId={null}
      initialDate={defaultDate}
      initialReason=""
      submitLabel="Add"
      onCancel={onCancel}
      onSubmit={async (values) => {
        const result = await createRejection(
          values.optionId,
          values.rejectedOn,
          values.reason,
        );
        if (result.ok) onSaved();
        return result;
      }}
    />
  );
}

/**
 * One Rejection row (PRD: Dated Rejections — inline-editable rejection row).
 * Shows the Option name (linked to its detail page) and the optional reason,
 * with Edit / Delete actions. Edit expands the row in place into the form
 * (Option, date, reason); Delete uses the §17 inline-confirm — the row reveals
 * a confirm/cancel rather than a modal. Every Rejection is editable and
 * deletable regardless of age.
 *
 * Both screens that render it — the Log screen and the Option detail page —
 * group Rejections under a date header, so the row itself carries no date.
 */
export function RejectionRow({
  rejection,
  optionChoices,
}: {
  rejection: LogRejectionRow;
  optionChoices: OptionChoice[];
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function runDelete() {
    setDeleteError(null);
    startTransition(async () => {
      try {
        await deleteRejection(rejection.id);
      } catch {
        setDeleteError("Couldn't delete that — try again");
        setConfirmDelete(false);
      }
    });
  }

  function handleSaved() {
    setEditing(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  if (editing) {
    return (
      <li className="border-b border-line bg-danger-wash px-3 py-3">
        <RejectionForm
          optionChoices={optionChoices}
          initialOptionId={rejection.optionId}
          initialDate={rejection.rejectedOn}
          initialReason={rejection.reason ?? ""}
          submitLabel="Save"
          onCancel={() => setEditing(false)}
          onSubmit={async (values) => {
            const result = await updateRejection(rejection.id, values);
            if (result.ok) handleSaved();
            return result;
          }}
        />
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-1 border-b border-line bg-danger-wash px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-meta font-emphasis uppercase tracking-wide text-danger">
            Rejected
          </span>
          <Link
            href={`/catalog/${rejection.optionId}`}
            className="font-display text-name font-name text-ink underline-offset-2
              hover:underline focus-visible:outline focus-visible:outline-2
              focus-visible:outline-offset-2 focus-visible:outline-action"
          >
            {rejection.optionName}
          </Link>
        </div>
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
        </div>
      </div>
      {rejection.reason && (
        <p className="text-chip text-muted">{rejection.reason}</p>
      )}
      {deleteError && (
        <p className="text-chip text-danger" role="alert">
          {deleteError}
        </p>
      )}
    </li>
  );
}
