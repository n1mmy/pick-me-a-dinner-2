"use client";

import Link from "next/link";
import { type FormEvent, useId, useState, useTransition } from "react";
import type {
  LogEntryRow,
  LogRejectionRow,
  OptionChoice,
} from "../../db/queries";
import {
  type DayRecord,
  formatDinnerDate,
  groupByDay,
} from "../../lib/dinner-grouping";
import { logForDate } from "./actions";
import { EntryRow, inputClass, labelClass } from "./log-entry-row";
import { AddRejectionForm, RejectionRow } from "./rejection-row";

/** The Upcoming strip stays compact — at most this many future date-groups show. */
const UPCOMING_CAP = 5;

/**
 * The Log screen (plan §9, §16; PRD: Dated Rejections on the Log) — the
 * Household's full nightly record. Each date-group shows that date's Dinner
 * (its Log entries) interleaved with that date's Rejections; a Rejection-only
 * date still forms its own group. A compact, capped "Upcoming" strip of
 * future-dated groups — Planned dinners and Planned rejections — sits on top;
 * below it, reverse-chronological history. Every entry and Rejection is
 * editable and deletable inline.
 *
 * The realized/Planned split, the interleaved day grouping, and the date label
 * live in the pure `lib/dinner-grouping` module; the Log entry row lives in
 * `log-entry-row` and the Rejection row in `rejection-row` — both shared with
 * the Option detail page so the two screens render a Dinner and a Rejection
 * identically.
 */
export function LogScreen({
  entries,
  rejections,
  optionChoices,
  today,
}: {
  entries: LogEntryRow[];
  rejections: LogRejectionRow[];
  optionChoices: OptionChoice[];
  today: string;
}) {
  // `entries` and `rejections` both arrive newest-date first; `groupByDay`
  // interleaves them into per-date records, Upcoming soonest-first and History
  // newest-first.
  const { upcoming, history } = groupByDay(entries, rejections, today);
  const shownUpcoming = upcoming.slice(0, UPCOMING_CAP);
  const hiddenUpcoming = upcoming.length - shownUpcoming.length;

  const isEmpty = entries.length === 0 && rejections.length === 0;

  return (
    <main className="column flex min-h-screen flex-col gap-5.5 pb-24 pt-5.5 desktop:pb-12">
      <h1 className="font-display text-h1 font-h1 text-ink">Log</h1>

      {optionChoices.length > 0 && (
        <TopAddControls optionChoices={optionChoices} today={today} />
      )}

      {isEmpty && (
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
          {shownUpcoming.map((record, index) => (
            <DayGroup
              key={record.date}
              record={record}
              optionChoices={optionChoices}
              today={today}
              isFirst={index === 0}
            />
          ))}
          {hiddenUpcoming > 0 && (
            <p className="text-chip text-muted">
              +{hiddenUpcoming} more planned
            </p>
          )}
        </section>
      )}

      {history.length > 0 && (
        <section className="flex flex-col gap-2">
          {upcoming.length > 0 && <h2 className={labelClass}>History</h2>}
          {history.map((record, index) => (
            <DayGroup
              key={record.date}
              record={record}
              optionChoices={optionChoices}
              today={today}
              isFirst={index === 0}
            />
          ))}
        </section>
      )}
    </main>
  );
}

// Secondary button — bordered, neutral-filled. Reads as a button without the
// weight of the filled `action` primary (Add / Pick).
const addButtonClass =
  "min-h-11 self-start rounded-control border border-line bg-raised px-3 " +
  "text-body font-emphasis text-ink transition-colors duration-micro " +
  "hover:bg-line focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-action";

const groupButtonClass =
  "min-h-11 self-start rounded-control border border-line bg-raised px-3 " +
  "text-chip font-emphasis text-ink transition-colors duration-micro " +
  "hover:bg-line focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-action";

/**
 * The two top-of-Log add controls (PRD: Dated Dinners — two add controls):
 * separate "Add a dinner" and "Add a rejection" buttons — each one direct
 * action, no mode toggle. Each opens its inline form below the buttons.
 */
function TopAddControls({
  optionChoices,
  today,
}: {
  optionChoices: OptionChoice[];
  today: string;
}) {
  const [open, setOpen] = useState<"none" | "dinner" | "rejection">("none");

  if (open === "dinner") {
    return (
      <div className="border-b border-line py-3">
        <AddEntryForm
          optionChoices={optionChoices}
          defaultDate={today}
          onCancel={() => setOpen("none")}
          onSaved={() => setOpen("none")}
        />
      </div>
    );
  }
  if (open === "rejection") {
    return (
      <div className="border-b border-line py-3">
        <AddRejectionForm
          optionChoices={optionChoices}
          defaultDate={today}
          onCancel={() => setOpen("none")}
          onSaved={() => setOpen("none")}
        />
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => setOpen("dinner")}
        className={addButtonClass}
      >
        + Add a dinner
      </button>
      <button
        type="button"
        onClick={() => setOpen("rejection")}
        className={addButtonClass}
      >
        + Add a rejection
      </button>
    </div>
  );
}

/**
 * One date-group: a date header above that date's interleaved Log entry rows
 * and Rejection rows, plus per-group "Add a dinner" / "Add a rejection"
 * controls with the date pre-filled to this group's date (PRD: Dated
 * Rejections — per-date-group add controls). Log entries render first, then
 * Rejections; a Rejection-only group shows just its Rejections.
 */
function DayGroup({
  record,
  optionChoices,
  today,
  isFirst,
}: {
  record: DayRecord<LogEntryRow, LogRejectionRow>;
  optionChoices: OptionChoice[];
  today: string;
  isFirst: boolean;
}) {
  const [open, setOpen] = useState<"none" | "dinner" | "rejection">("none");

  return (
    <div
      className={
        isFirst
          ? "flex flex-col gap-1"
          : "flex flex-col gap-1 border-t-2 border-line pt-5.5"
      }
    >
      <h3 className="text-chip font-emphasis text-muted">
        {formatDinnerDate(record.date, today)}
      </h3>
      <ul className="flex flex-col">
        {record.entries.map((entry) => (
          <EntryRow key={entry.id} entry={entry} optionChoices={optionChoices} />
        ))}
        {record.rejections.map((rejection) => (
          <RejectionRow
            key={rejection.id}
            rejection={rejection}
            optionChoices={optionChoices}
          />
        ))}
      </ul>

      {optionChoices.length > 0 &&
        (open === "dinner" ? (
          <div className="py-2">
            <AddEntryForm
              optionChoices={optionChoices}
              defaultDate={record.date}
              onCancel={() => setOpen("none")}
              onSaved={() => setOpen("none")}
            />
          </div>
        ) : open === "rejection" ? (
          <div className="py-2">
            <AddRejectionForm
              optionChoices={optionChoices}
              defaultDate={record.date}
              onCancel={() => setOpen("none")}
              onSaved={() => setOpen("none")}
            />
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setOpen("dinner")}
              className={groupButtonClass}
            >
              + Dinner
            </button>
            <button
              type="button"
              onClick={() => setOpen("rejection")}
              className={groupButtonClass}
            >
              + Rejection
            </button>
          </div>
        ))}
    </div>
  );
}

/**
 * The inline "Add a dinner" form (plan §6) — create a new Log entry from the
 * Log screen for any Option (Active or Archived) on any date: a past date
 * backfills a forgotten dinner, a future date plans one. A date the Option is
 * already logged for is rejected inline, the same as an edit. `defaultDate`
 * lets a date-group pre-fill the group's own date.
 */
function AddEntryForm({
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
  const fieldId = useId();
  const [optionId, setOptionId] = useState(optionChoices[0]?.id ?? "");
  const [eatenOn, setEatenOn] = useState(defaultDate);
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
          <p id={`${fieldId}-error`} className="text-chip text-danger" role="alert">
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
