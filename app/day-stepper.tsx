"use client";

import type { ChangeEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { shiftSqlDate } from "../lib/local-day";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-action";

/**
 * The Tonight screen's **Selected day** stepper (ADR-0009, amended): a
 * `‹ day ›` control plus a native date picker that lets the Household step to
 * any date — forward to plan ahead, back to edit a past night's Pick or
 * backfill a forgotten dinner. The Selected day lives in the URL as
 * `?day=YYYY-MM-DD`; this component writes it via `router.replace`, so
 * refresh, link-sharing, and back/forward navigation preserve it for free.
 *
 * Stepping back to today clears `?day=` from the URL rather than carrying a
 * redundant today value, so a request to `/` with no `?day=` is exactly the
 * same screen as one with `?day=today`.
 */
export function DayStepper({
  selectedDay,
  todaySql,
}: {
  /** The Selected day as a SQL date — already parsed and clamped server-side. */
  selectedDay: string;
  /** Today's SQL date in the Household's `APP_TZ`. */
  todaySql: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigateTo(nextSql: string) {
    const params = new URLSearchParams(searchParams.toString());
    // Stepping back to today drops `?day=` so the URL is honest — the today
    // case is the no-query-string render (PRD: backward compatibility).
    if (nextSql === todaySql) {
      params.delete("day");
    } else {
      params.set("day", nextSql);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function stepBack() {
    navigateTo(shiftSqlDate(selectedDay, -1));
  }

  function stepForward() {
    navigateTo(shiftSqlDate(selectedDay, 1));
  }

  function onPickerChange(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value;
    if (!raw) return; // a cleared picker is a no-op; the value stays as-is
    navigateTo(raw);
  }

  const buttonClass =
    "inline-flex h-11 w-11 items-center justify-center rounded-control " +
    "border border-line bg-surface text-h2 text-ink transition-colors " +
    "duration-short hover:bg-raised disabled:opacity-40 disabled:hover:bg-surface " +
    focusRing;

  return (
    <div
      role="group"
      aria-label="Selected day"
      className="flex items-center gap-1.5"
    >
      <button
        type="button"
        onClick={stepBack}
        aria-label="Previous day"
        className={buttonClass}
      >
        ‹
      </button>
      <input
        type="date"
        value={selectedDay}
        onChange={onPickerChange}
        aria-label="Pick a date"
        className={`h-11 rounded-input border border-line bg-surface px-3 text-body text-ink ${focusRing}`}
      />
      <button
        type="button"
        onClick={stepForward}
        aria-label="Next day"
        className={buttonClass}
      >
        ›
      </button>
    </div>
  );
}
