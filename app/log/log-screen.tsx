"use client";

import Link from "next/link";
import {
  type FormEvent,
  useId,
  useState,
  useTransition,
} from "react";
import type { LogEntryRow, OptionChoice } from "../../db/queries";
import { PickButton } from "../pick-button";
import { deleteLogEntry, logForDate, updateLogEntry } from "./actions";

/** The Upcoming strip stays compact — at most this many Planned Dinners show. */
const UPCOMING_CAP = 5;

const labelClass = "text-meta font-emphasis uppercase tracking-wide text-muted";
const inputClass =
  "min-h-11 rounded-input border border-line bg-surface px-3 text-body text-ink " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-action";
const actionButton =
  "min-h-11 rounded-control px-2 text-chip focus-visible:outline " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action";

/** A Dinner: one calendar date carrying one or more Log entries. */
type Dinner = { date: string; entries: LogEntryRow[] };

/** Group already-date-sorted entries into Dinners, preserving the input order. */
function groupByDate(entries: LogEntryRow[]): Dinner[] {
  const dinners: Dinner[] = [];
  for (const entry of entries) {
    const last = dinners[dinners.length - 1];
    if (last && last.date === entry.eatenOn) {
      last.entries.push(entry);
    } else {
      dinners.push({ date: entry.eatenOn, entries: [entry] });
    }
  }
  return dinners;
}

const DAY_MS = 86_400_000;

/** UTC-anchored ms for a `YYYY-MM-DD` — date arithmetic without a zone skew. */
function dateMs(sqlDate: string): number {
  return Date.UTC(
    Number(sqlDate.slice(0, 4)),
    Number(sqlDate.slice(5, 7)) - 1,
    Number(sqlDate.slice(8, 10)),
  );
}

/** A Dinner's date header — "Today" / "Tomorrow" / "Yesterday", else "Fri, May 16". */
function formatDinnerDate(sqlDate: string, today: string): string {
  const diff = Math.round((dateMs(sqlDate) - dateMs(today)) / DAY_MS);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(dateMs(sqlDate)));
}

/**
 * The Log screen (plan §9, §16) — past and Planned dinners. A compact, capped
 * "Upcoming" strip of future-dated Dinners sits on top so a plan never buries
 * today; below it, reverse-chronological history grouped by date. Every entry
 * is editable and deletable inline.
 */
export function LogScreen({
  entries,
  optionChoices,
  today,
}: {
  entries: LogEntryRow[];
  optionChoices: OptionChoice[];
  today: string;
}) {
  // `entries` arrive newest-`eaten_on` first. History keeps that order;
  // Upcoming wants soonest first, so its Dinner groups are reversed.
  const upcoming = groupByDate(
    entries.filter((entry) => entry.eatenOn > today),
  ).reverse();
  const past = groupByDate(entries.filter((entry) => entry.eatenOn <= today));
  const shownUpcoming = upcoming.slice(0, UPCOMING_CAP);
  const hiddenUpcoming = upcoming.length - shownUpcoming.length;

  const [adding, setAdding] = useState(false);

  return (
    <main className="column flex min-h-screen flex-col gap-5.5 pb-24 pt-5.5 desktop:pb-12">
      <h1 className="font-display text-h1 font-h1 text-ink">Log</h1>

      {optionChoices.length > 0 &&
        (adding ? (
          <div className="border-b border-line py-3">
            <AddEntryForm
              optionChoices={optionChoices}
              today={today}
              onCancel={() => setAdding(false)}
              onSaved={() => setAdding(false)}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="min-h-11 self-start rounded-control px-2 text-body
              font-emphasis text-action focus-visible:outline
              focus-visible:outline-2 focus-visible:outline-offset-2
              focus-visible:outline-action"
          >
            + Add a dinner
          </button>
        ))}

      {entries.length === 0 && (
        <p className="text-body text-muted">
          No dinners logged yet —{" "}
          <Link
            href="/"
            className="font-emphasis text-action focus-visible:outline
              focus-visible:outline-2 focus-visible:outline-offset-2
              focus-visible:outline-action"
          >
            pick one on Tonight →
          </Link>
        </p>
      )}

      {upcoming.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className={labelClass}>Upcoming</h2>
          {shownUpcoming.map((dinner) => (
            <DinnerGroup
              key={dinner.date}
              dinner={dinner}
              optionChoices={optionChoices}
              today={today}
            />
          ))}
          {hiddenUpcoming > 0 && (
            <p className="text-chip text-muted">
              +{hiddenUpcoming} more planned
            </p>
          )}
        </section>
      )}

      {past.length > 0 && (
        <section className="flex flex-col gap-2">
          {upcoming.length > 0 && <h2 className={labelClass}>History</h2>}
          {past.map((dinner) => (
            <DinnerGroup
              key={dinner.date}
              dinner={dinner}
              optionChoices={optionChoices}
              today={today}
            />
          ))}
        </section>
      )}
    </main>
  );
}

/** One Dinner: a date header above its one-or-more Log entry rows. */
function DinnerGroup({
  dinner,
  optionChoices,
  today,
}: {
  dinner: Dinner;
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
function EntryRow({
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
      <li className="border-b border-line py-3">
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
    <li className="flex flex-col gap-1 border-b border-line py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-name font-name text-ink">
          {entry.optionName}
        </span>
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
  const [optionId, setOptionId] = useState(entry.optionId);
  const [eatenOn, setEatenOn] = useState(entry.eatenOn);
  const [note, setNote] = useState(entry.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const homeChoices = optionChoices.filter((o) => o.kind === "home");
  const restChoices = optionChoices.filter((o) => o.kind === "restaurant");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
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
        <select
          id={`${fieldId}-option`}
          className={inputClass}
          value={optionId}
          onChange={(event) => setOptionId(event.target.value)}
        >
          {homeChoices.length > 0 && (
            <optgroup label="Home meals">
              {homeChoices.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </optgroup>
          )}
          {restChoices.length > 0 && (
            <optgroup label="Restaurants">
              {restChoices.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
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
          aria-invalid={error !== null}
          aria-describedby={error ? `${fieldId}-error` : undefined}
        />
        {error && (
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

/**
 * The inline "Add a dinner" form (plan §6) — create a new Log entry from the
 * Log screen for any Option (Active or Archived) on any date: a past date
 * backfills a forgotten dinner, a future date plans one. A date the Option is
 * already logged for is rejected inline, the same as an edit.
 */
function AddEntryForm({
  optionChoices,
  today,
  onCancel,
  onSaved,
}: {
  optionChoices: OptionChoice[];
  today: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const fieldId = useId();
  const [optionId, setOptionId] = useState(optionChoices[0]?.id ?? "");
  const [eatenOn, setEatenOn] = useState(today);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const homeChoices = optionChoices.filter((o) => o.kind === "home");
  const restChoices = optionChoices.filter((o) => o.kind === "restaurant");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!eatenOn) {
      setError("Pick a valid date");
      return;
    }
    startTransition(async () => {
      const result = await logForDate(optionId, eatenOn, note);
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
        <select
          id={`${fieldId}-option`}
          className={inputClass}
          value={optionId}
          onChange={(event) => setOptionId(event.target.value)}
        >
          {homeChoices.length > 0 && (
            <optgroup label="Home meals">
              {homeChoices.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </optgroup>
          )}
          {restChoices.length > 0 && (
            <optgroup label="Restaurants">
              {restChoices.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
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
          aria-invalid={error !== null}
          aria-describedby={error ? `${fieldId}-error` : undefined}
        />
        {error && (
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
          Add
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
