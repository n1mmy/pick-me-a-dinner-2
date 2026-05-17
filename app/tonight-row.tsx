"use client";

import { useState, useTransition } from "react";
import { CAP } from "../lib/ranking.config";
import type { TagRecency, TonightRow } from "../lib/ranking";
import { logForDate, pickTonight } from "./log/actions";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-accent";

const actionButton =
  `min-h-11 rounded-control px-2 text-chip transition-colors duration-micro ${focusRing}`;

/**
 * One Tonight row of the flat ledger (DESIGN.md "Tonight row anatomy"). Mobile
 * is two lines — rank + name + tags, then the Explanation chip + actions;
 * desktop collapses to one dense line via `desktop:contents` on the chip/action
 * wrapper. "Pick tonight" is the one-tap `pick = log` path; the picked button
 * briefly marks "Logged ✓". "Log another date" expands a date picker for a
 * backfilled (past) or Planned (future) dinner.
 */
export function TonightRowItem({
  row,
  rank,
  today,
}: {
  row: TonightRow;
  rank: number;
  today: string;
}) {
  const { option } = row;
  const [justLogged, setJustLogged] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [loggingDate, setLoggingDate] = useState(false);
  const [dateValue, setDateValue] = useState(today);
  const [dateError, setDateError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function pick() {
    setPickError(null);
    startTransition(async () => {
      const result = await pickTonight(option.id);
      if (!result.ok) {
        // Never flash a false "Logged ✓" — show the failure on the row instead.
        setPickError(result.error);
        return;
      }
      // Hold "Logged ✓" briefly; the revalidation re-sorts the list under it.
      setJustLogged(true);
      window.setTimeout(() => setJustLogged(false), 1600);
    });
  }

  function submitDate() {
    if (!dateValue) return;
    setDateError(null);
    startTransition(async () => {
      const result = await logForDate(option.id, dateValue);
      if (result.ok) {
        setLoggingDate(false);
        setDateValue(today);
      } else {
        setDateError(result.error);
      }
    });
  }

  return (
    <li className="border-b border-line py-3">
      <div
        className="flex flex-col gap-2 desktop:flex-row desktop:items-center
          desktop:gap-3"
      >
        <div className="desktop:min-w-0 desktop:flex-1">
          <div className="flex items-baseline gap-2">
            <span className="w-6 shrink-0 text-right font-mono text-meta tabular-nums text-muted">
              {rank}
            </span>
            <span className="font-display text-name font-name text-ink">
              {option.name}
            </span>
            <KindBadge kind={option.kind} />
          </div>
          {row.tags.length > 0 && <RowTags tags={row.tags} />}
        </div>
        <div className="flex items-center gap-2 desktop:contents">
          <span
            className="self-start rounded-badge bg-raised px-2 py-1 text-chip
              text-muted"
          >
            <MonoNumerals text={row.explanation} />
          </span>
          <div className="flex flex-wrap items-center gap-2 desktop:ml-auto">
            <button
              type="button"
              onClick={pick}
              disabled={pending}
              aria-live="polite"
              className={`min-h-11 rounded-control px-4 text-body font-emphasis
                transition-colors duration-short disabled:opacity-60 ${focusRing} ${
                  justLogged
                    ? "bg-raised text-success"
                    : "bg-accent text-accent-ink hover:bg-accent-dark"
                }`}
            >
              {justLogged ? "Logged ✓" : "Pick tonight"}
            </button>
            {!loggingDate && (
              <button
                type="button"
                onClick={() => {
                  setDateValue(today);
                  setDateError(null);
                  setLoggingDate(true);
                }}
                className={`${actionButton} text-muted`}
              >
                Log another date
              </button>
            )}
          </div>
        </div>
      </div>
      {pickError && (
        <p className="mt-2 text-chip text-danger" aria-live="polite">
          {pickError}
        </p>
      )}
      {loggingDate && (
        <div className="mt-2 flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              aria-label={`Date to log ${option.name}`}
              value={dateValue}
              onChange={(event) => setDateValue(event.target.value)}
              aria-invalid={dateError !== null}
              className={`min-h-11 rounded-input border border-line bg-surface
                px-3 font-mono text-body text-ink ${focusRing}`}
            />
            <button
              type="button"
              onClick={submitDate}
              disabled={pending}
              className={`min-h-11 rounded-control bg-accent px-4 text-body
                font-emphasis text-accent-ink transition-colors duration-micro
                hover:bg-accent-dark disabled:opacity-60 ${focusRing}`}
            >
              Log
            </button>
            <button
              type="button"
              onClick={() => {
                setLoggingDate(false);
                setDateError(null);
              }}
              disabled={pending}
              className={`${actionButton} text-muted`}
            >
              Cancel
            </button>
          </div>
          {dateError && <p className="text-chip text-danger">{dateError}</p>}
        </div>
      )}
    </li>
  );
}

/** The quiet Home / Restaurant kind marker. */
function KindBadge({ kind }: { kind: "home" | "restaurant" }) {
  const isHome = kind === "home";
  return (
    <span
      className={`shrink-0 rounded-badge bg-raised px-1.5 py-0.5 text-meta
        uppercase tracking-wide ${isHome ? "text-home" : "text-rest"}`}
    >
      {isHome ? "Home" : "Restaurant"}
    </span>
  );
}

/**
 * The Option's tags directly under the name, each rendered as a bordered chip
 * matching the Tonight tag-filter chips. Each carries its per-Tag recency
 * (`Nd`, capped `60d+`) with the numerals in Geist Mono; an Overdue Tag is
 * drawn in the accent color.
 */
function RowTags({ tags }: { tags: TagRecency[] }) {
  return (
    <ul className="mt-1 flex flex-wrap gap-1">
      {tags.map((tag) => {
        const recency = tag.days >= CAP ? `${CAP}d+` : `${tag.days}d`;
        return (
          <li
            key={tag.tag}
            className={`inline-flex items-center gap-1 rounded-badge border
              border-line bg-surface px-2 py-0.5 text-meta leading-tight ${
                tag.overdue ? "text-accent" : "text-muted"
              }`}
          >
            {tag.tag}
            <span className="font-mono tabular-nums">{recency}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Renders a string with every run of digits set in Geist Mono (tabular). */
function MonoNumerals({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\d+)/).map((part, index) =>
        /^\d+$/.test(part) ? (
          <span key={index} className="font-mono tabular-nums">
            {part}
          </span>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}
