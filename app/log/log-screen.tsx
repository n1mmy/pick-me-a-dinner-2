"use client";

import Link from "next/link";
import { type FormEvent, useId, useState, useTransition } from "react";
import type { LogEntryRow, OptionChoice } from "../../db/queries";
import { splitDinners } from "../../lib/dinner-grouping";
import { logForDate } from "./actions";
import { DinnerGroup, inputClass, labelClass } from "./log-entry-row";

/** The Upcoming strip stays compact — at most this many Planned Dinners show. */
const UPCOMING_CAP = 5;

/**
 * The Log screen (plan §9, §16) — past and Planned dinners. A compact, capped
 * "Upcoming" strip of future-dated Dinners sits on top so a plan never buries
 * today; below it, reverse-chronological history grouped by date. Every entry
 * is editable and deletable inline.
 *
 * The realized/Planned split, the date grouping, and the date label live in
 * the pure `lib/dinner-grouping` module; the Log entry row and its inline edit
 * form live in `log-entry-row` — both shared with the Option detail page so
 * the two screens render a Dinner identically.
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
  // `entries` arrive newest-`eaten_on` first; `splitDinners` keeps the realized
  // history in that order and returns the Planned dinners soonest-first.
  const { planned, realized } = splitDinners(entries, today);
  const shownUpcoming = planned.slice(0, UPCOMING_CAP);
  const hiddenUpcoming = planned.length - shownUpcoming.length;

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

      {planned.length > 0 && (
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

      {realized.length > 0 && (
        <section className="flex flex-col gap-2">
          {planned.length > 0 && <h2 className={labelClass}>History</h2>}
          {realized.map((dinner) => (
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
