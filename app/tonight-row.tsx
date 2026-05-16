"use client";

import { useState, useTransition } from "react";
import { CAP } from "../lib/ranking.config";
import type { TagRecency, TonightRow } from "../lib/ranking";
import { logForDate, pickTonight } from "./log/actions";

const actionButton =
  "min-h-11 rounded-control px-2 text-chip focus-visible:outline " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/**
 * One Tonight row. Hierarchy per §9: name → Explanation chip → tag chips, then
 * the write actions. "Pick tonight" is the one-tap `pick = log` path; the
 * picked button briefly marks "Logged ✓" in `--success` while the action
 * revalidates and the list re-sorts. "Log another date" expands a date picker
 * for a backfilled (past) or Planned (future) dinner.
 */
export function TonightRowItem({
  row,
  today,
}: {
  row: TonightRow;
  today: string;
}) {
  const { option } = row;
  const [justLogged, setJustLogged] = useState(false);
  const [loggingDate, setLoggingDate] = useState(false);
  const [dateValue, setDateValue] = useState(today);
  const [pending, startTransition] = useTransition();

  function pick() {
    setJustLogged(true);
    startTransition(async () => {
      await pickTonight(option.id);
    });
    // Hold "Logged ✓" briefly; the revalidation re-sorts the list under it.
    window.setTimeout(() => setJustLogged(false), 1600);
  }

  function submitDate() {
    if (!dateValue) return;
    startTransition(async () => {
      await logForDate(option.id, dateValue);
    });
    setLoggingDate(false);
    setDateValue(today);
  }

  return (
    <li className="flex flex-col gap-1.5 border-b border-line py-3">
      <div className="flex items-center gap-2">
        <span className="text-name text-ink">{option.name}</span>
        <KindBadge kind={option.kind} />
      </div>
      <span
        className="self-start rounded-full bg-chip px-3 py-1.5 text-chip
          text-muted"
      >
        {row.explanation}
      </span>
      {row.tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {row.tags.map((tag) => (
            <TagChip key={tag.tag} tag={tag} />
          ))}
        </ul>
      )}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={pick}
          disabled={pending}
          aria-live="polite"
          className={`min-h-11 rounded-control px-4 text-body font-emphasis
            focus-visible:outline focus-visible:outline-2
            focus-visible:outline-offset-2 focus-visible:outline-accent
            disabled:opacity-60 ${
              justLogged ? "bg-chip text-success" : "bg-accent text-surface"
            }`}
        >
          {justLogged ? "Logged ✓" : "Pick tonight"}
        </button>
        {!loggingDate && (
          <button
            type="button"
            onClick={() => {
              setDateValue(today);
              setLoggingDate(true);
            }}
            className={`${actionButton} text-muted`}
          >
            Log another date
          </button>
        )}
      </div>
      {loggingDate && (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <input
            type="date"
            aria-label={`Date to log ${option.name}`}
            value={dateValue}
            onChange={(event) => setDateValue(event.target.value)}
            className="min-h-11 rounded-input border border-line bg-surface px-3
              text-body text-ink focus-visible:outline focus-visible:outline-2
              focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          <button
            type="button"
            onClick={submitDate}
            disabled={pending}
            className="min-h-11 rounded-control bg-accent px-4 text-body
              font-emphasis text-surface focus-visible:outline
              focus-visible:outline-2 focus-visible:outline-offset-2
              focus-visible:outline-accent disabled:opacity-60"
          >
            Log
          </button>
          <button
            type="button"
            onClick={() => setLoggingDate(false)}
            disabled={pending}
            className={`${actionButton} text-muted`}
          >
            Cancel
          </button>
        </div>
      )}
    </li>
  );
}

/** The quiet Home / Restaurant badge. */
function KindBadge({ kind }: { kind: "home" | "restaurant" }) {
  const isHome = kind === "home";
  return (
    <span
      className={`rounded-badge bg-chip px-1.5 py-0.5 text-meta uppercase
        tracking-wide ${isHome ? "text-home" : "text-rest"}`}
    >
      {isHome ? "Home" : "Restaurant"}
    </span>
  );
}

/**
 * A tag chip with its per-Tag recency. Recency reads as `Nd`, capped at `60d+`;
 * an Overdue Tag renders in the accent color.
 */
function TagChip({ tag }: { tag: TagRecency }) {
  const recency = tag.days >= CAP ? `${CAP}d+` : `${tag.days}d`;
  return (
    <li
      className={`rounded-full bg-chip px-2 py-1 text-chip ${
        tag.overdue ? "font-emphasis text-accent" : "text-muted"
      }`}
    >
      {tag.tag} {recency}
    </li>
  );
}
