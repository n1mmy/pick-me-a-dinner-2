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
 *
 * `shrink-0` keeps the whole group at its natural width when the header row
 * runs out of space: on a phone the H1 beside it gives up the width instead,
 * so the forward arrow is never the thing that gets clipped (ADR-0009,
 * amendment 2026-09-08).
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

  // The stepper is deliberately compact: it shares a phone-width row with the
  // H1, and the native date input alone takes ~130px of it. Every pixel the
  // arrows and the input give up is a pixel the day name gets to keep, so these
  // sit below the 44px touch-target ideal by design (ADR-0009, amendment
  // 2026-09-08) — 36px is still a comfortable thumb target at this density.
  const buttonClass =
    "inline-flex h-9 w-9 items-center justify-center rounded-control " +
    "border border-line bg-surface text-ink transition-colors " +
    "duration-short hover:bg-raised disabled:opacity-40 disabled:hover:bg-surface " +
    focusRing;

  return (
    <div
      role="group"
      aria-label="Selected day"
      className="flex shrink-0 items-center gap-1"
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
        className={`h-9 rounded-input border border-line bg-surface px-2 text-meta text-ink ${focusRing}`}
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

/**
 * The Tonight H1's day name, doubling as the reset to today (ADR-0009,
 * amendment 2026-09-08). Tapping it returns the Selected day to today from any
 * distance, which the `‹ ›` stepper can only do one day per tap and the date
 * picker only by hunting for today's date by hand.
 *
 * It carries no visual affordance — a single household learns the gesture once
 * — but it is a real `<button>`, so the keyboard and assistive tech can still
 * reach it. Its accessible name spells out what the day name alone would not.
 *
 * The reset **deletes** `?day=` rather than setting today's date: any today
 * value the client holds was baked in at render, so a tab left open past
 * midnight would reset to yesterday. Dropping the parameter leaves the question
 * to the server, which resolves `today()` fresh on the re-render. When the
 * parameter is already absent there is nothing to navigate to, so the tap
 * re-fetches instead — which is what repairs that stale tab.
 */
export function DayNameReset({ heading }: { heading: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function resetToToday() {
    const params = new URLSearchParams(searchParams.toString());
    if (!params.has("day")) {
      router.refresh();
      return;
    }
    params.delete("day");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <button
      type="button"
      onClick={resetToToday}
      aria-label={`${heading} — reset to today`}
      className={`block max-w-full truncate rounded-control ${focusRing}`}
    >
      {heading}
    </button>
  );
}
