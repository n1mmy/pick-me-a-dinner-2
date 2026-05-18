"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { TodayRejection } from "../db/queries";
import type { AiRankingRow } from "../lib/ai-search";
import type { TonightRow } from "../lib/ranking";
import {
  chipStateLabel,
  cycleChipState,
  distinctTags,
  filterHint,
  filterTonightRows,
  type ChipState,
  type KindFilter,
  type TagFilters,
} from "../lib/tonight-filter";
import type { TonightsDinnerEntry } from "../lib/tonights-dinner";
import { deleteRejection } from "./rejection-actions";
import { aiSearchAction } from "./tonight-actions";
import { TonightRowItem } from "./tonight-row";
import { TonightsDinnerBlock } from "./tonights-dinner-block";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-action";

/**
 * The Tonight screen (plan §9, §16; PRD: Tonight — decided mode) — the home
 * screen, with two modes decided server-side from the Household's Log.
 *
 * **Picker mode** — no Log entry dated today — is the ranked picker exactly as
 * v1: the All/Home/Restaurant kind segment, the tri-state Tag filters, and the
 * flat ranked list.
 *
 * **Decided mode** — one or more Log entries dated today — surfaces a "Tonight's
 * dinner" block of what was Picked, then keeps the ranked picker open below it
 * under an "Add another option" divider. Picking from that picker appends the
 * Option to Tonight's dinner — a deliberate second dinner, not a replacement,
 * which the divider's heading and hint make explicit. The heading stays
 * "Tonight" in both modes; a visually-hidden live region announces the switch.
 *
 * The mode is not client state: it follows `tonightsDinner`, which the server
 * recomputes from today's Log on every Pick. A new calendar day empties
 * `tonightsDinner` on its own, so Tonight returns to picker mode with no
 * day-boundary logic here.
 */
export function TonightScreen({
  tonightsDinner,
  pickerRows,
  searchEnabled,
  allRejected = false,
  rejectedTonight = [],
}: {
  /** The Picked Options, in pick order — non-empty puts Tonight in decided mode. */
  tonightsDinner: TonightsDinnerEntry[];
  /** The ranked picker rows, with Picked and today-rejected Options removed. */
  pickerRows: TonightRow[];
  /** Whether AI search is configured — gates the search box (`aiSearchEnabled`). */
  searchEnabled: boolean;
  /**
   * True when the picker had rows but every one was rejected for tonight (PRD:
   * Rejections). It separates an all-rejected empty list — a real state, with
   * the Options back tomorrow — from a genuinely empty Catalog.
   */
  allRejected?: boolean;
  /**
   * Today's Rejections (PRD: Rejections on Tonight) — what the "Rejected
   * tonight" disclosure lists and lets the Household bring back. Empty by
   * default, so the disclosure costs nothing until something is rejected.
   */
  rejectedTonight?: TodayRejection[];
}) {
  const decided = tonightsDinner.length > 0;
  // Picker mode with nothing to rank at all — an empty Catalog, not "all Picked"
  // and not "all rejected" (both of which are real states with their own copy).
  const catalogEmpty = !decided && pickerRows.length === 0 && !allRejected;

  // The All/Home/Restaurant kind filter lives here so its segment can sit in
  // the page header beside "Tonight"; the Picker still owns the filtering.
  const [kind, setKind] = useState<KindFilter>("all");
  // The Picker reports when an AI result is on screen — the kind segment hides
  // then, since an AI result is ranked by the query alone.
  const [aiActive, setAiActive] = useState(false);

  // A Pick grows `tonightsDinner`; when it does, animate the page up to the
  // "Tonight's dinner" block so the Household sees the Option land there. The
  // effect runs after the Pick's revalidation has committed, so the scroll
  // animates against the settled layout — scrolling on the tap instead races
  // that reflow and gets jolted. The previous count is held in `sessionStorage`,
  // not a ref or state, so the comparison survives the revalidation even if it
  // remounts this component; a Remove (which shrinks the count) never scrolls.
  const dinnerCount = tonightsDinner.length;
  useEffect(() => {
    const key = "pmad:tonightDinnerCount";
    const stored = sessionStorage.getItem(key);
    const previous = stored === null ? dinnerCount : Number(stored);
    sessionStorage.setItem(key, String(dinnerCount));
    if (dinnerCount > previous) {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    }
  }, [dinnerCount]);

  // The mode restated for assistive tech. A live region voices only changes, so
  // a fresh load is silent; a Pick that flips picker → decided (or a Remove
  // that flips back) is announced.
  const modeStatus = decided
    ? "Tonight's dinner is decided."
    : "Choosing tonight's dinner.";

  // The kind segment shows only when a Picker is actually on screen and not
  // overridden by an AI result. The picker is on screen whenever there are rows
  // to rank — in picker mode, and below the divider in decided mode.
  const pickerRendered = pickerRows.length > 0;
  const showKindSegment = pickerRendered && !aiActive;

  return (
    <main className="column flex min-h-screen flex-col gap-5.5 pb-24 pt-5.5 desktop:pb-12">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="font-display text-h1 font-h1 text-ink">Tonight</h1>
        {showKindSegment && <KindSegment kind={kind} onChange={setKind} />}
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {modeStatus}
      </p>

      {catalogEmpty ? (
        <p className="text-body text-muted">
          Your Catalog is empty.{" "}
          <Link
            href="/catalog"
            className={`font-emphasis text-action ${focusRing}`}
          >
            Add your first meals →
          </Link>
        </p>
      ) : !decided && allRejected ? (
        // Every Option was rejected for tonight — a real state, not a broken
        // screen. A Rejection means "not tonight": the Options return tomorrow.
        <p className="text-body text-muted">
          Every Option has been rejected for tonight. They&rsquo;ll be back
          tomorrow.
        </p>
      ) : decided ? (
        <>
          <TonightsDinnerBlock entries={tonightsDinner} />
          {pickerRows.length === 0 ? (
            <p className="border-t border-line pt-5.5 text-body text-muted">
              {allRejected
                ? "Every remaining Option has been rejected for tonight."
                : "Every Option is already on tonight’s dinner."}
            </p>
          ) : (
            // The ranked picker stays open below the decided block, under a
            // divider. Picking from it Picks a *second* dinner for tonight
            // rather than replacing the first — the heading and hint say so.
            <section
              aria-label="Add another option"
              className="flex flex-col gap-2 border-t border-line pt-5.5"
            >
              <h2 className="text-meta uppercase tracking-wide text-muted">
                Add another option
              </h2>
              <p className="text-meta text-muted">
                Picking one adds it to tonight&rsquo;s dinner — it won&rsquo;t
                replace what&rsquo;s already chosen.
              </p>
              <Picker
                rows={pickerRows}
                searchEnabled={searchEnabled}
                kind={kind}
                onAiActiveChange={setAiActive}
              />
            </section>
          )}
        </>
      ) : (
        <Picker
          rows={pickerRows}
          searchEnabled={searchEnabled}
          kind={kind}
          onAiActiveChange={setAiActive}
        />
      )}

      {/* Pinned to the bottom of the page, after the ranked rows — collapsed
          by default, so it costs no screen space until scrolled to. Rendered
          whenever something was rejected today; it then lists today's
          Rejections with a "Bring back" undo. */}
      {rejectedTonight.length > 0 && (
        <RejectedTonightDisclosure rejections={rejectedTonight} />
      )}
    </main>
  );
}

/**
 * The "Rejected tonight (N)" disclosure (PRD: Rejections on Tonight) — pinned
 * at the bottom of the picker list, collapsed by default so it costs no screen
 * space until the Household scrolls to it. The heading carries a count of
 * today's Rejections.
 *
 * Expanded, it lists each of today's Rejections — the Option name, and the
 * reason when one was given — each with a "Bring back" control. "Bring back"
 * calls `deleteRejection`, which **deletes** the Rejection record: the
 * Option returns to tonight's list immediately and — because the record is
 * gone, not merely expired — a mis-tapped Rejection never reaches AI search.
 * Only today's Rejections appear here; managing the historical Rejection log
 * is out of scope (PRD: Out of Scope).
 */
function RejectedTonightDisclosure({
  rejections,
}: {
  rejections: TodayRejection[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function bringBack(rejectionId: string) {
    startTransition(async () => {
      await deleteRejection(rejectionId);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((isOpen) => !isOpen)}
        className={`min-h-11 self-start rounded-control border border-line
          px-4 text-body font-emphasis text-action transition-colors
          duration-short hover:bg-raised ${focusRing}`}
      >
        {`Rejected tonight (${rejections.length})`}
      </button>
      {open && (
        <ul className="flex flex-col">
          {rejections.map((rejection) => (
            <li
              key={rejection.id}
              className="flex items-start gap-3 border-b border-line py-3"
            >
              <div className="min-w-0 flex-1">
                <span className="font-display text-name font-name text-ink">
                  {rejection.optionName}
                </span>
                {rejection.reason && (
                  <p className="mt-0.5 text-meta text-muted">
                    {rejection.reason}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => bringBack(rejection.id)}
                disabled={pending}
                className={`min-h-11 shrink-0 rounded-control border
                  border-line px-3 text-body font-emphasis text-action
                  transition-colors duration-short hover:bg-raised
                  disabled:opacity-60 ${focusRing}`}
              >
                Bring back
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The ranked picker: a sticky filter zone — optional AI search box, the
 * tri-state Tag filter chips — above the flat ranked `<ol>`. It is the whole
 * screen in picker mode and the collapsible body in decided mode; its behavior
 * is identical either way. The All/Home/Restaurant kind segment lives in the
 * page header (`TonightScreen`) and scrolls away with it; the picker only reads
 * the resulting `kind` and reports AI-result state back via `onAiActiveChange`
 * so the header can hide the segment.
 *
 * The search box appears only when AI search is configured (`searchEnabled`).
 * Submitting it runs an **AI search** (PRD: AI search) — the deterministic list
 * swaps in place for an AI-ranked result, each row carrying an AI rationale.
 * While an AI result is shown the kind segment and Tag chips are hidden so the
 * query is the single ranking authority; clearing the search restores both.
 *
 * Each row carries the `pick = log` write action (§6) in `tonight-row.tsx`.
 */
function Picker({
  rows,
  searchEnabled,
  kind,
  onAiActiveChange,
}: {
  rows: TonightRow[];
  searchEnabled: boolean;
  kind: KindFilter;
  onAiActiveChange: (active: boolean) => void;
}) {
  const [tagFilters, setTagFilters] = useState<TagFilters>({});

  // AI search state. `aiResults === null` is the default deterministic view;
  // a non-null value swaps the list for the AI result.
  const [query, setQuery] = useState("");
  const [aiResults, setAiResults] = useState<AiRankingRow[] | null>(null);
  const [aiError, setAiError] = useState(false);
  const [pending, startTransition] = useTransition();

  // A submitted Rejection removes its row from the list on revalidation; this
  // live region — stable across that re-render, unlike the row itself —
  // announces the removal to assistive tech (PRD: Rejections, story 33).
  const [rejectNotice, setRejectNotice] = useState("");

  const tags = useMemo(() => distinctTags(rows), [rows]);
  // Rank reflects each Option's position in the picker ranking, so a filtered
  // row keeps its true rank (#4, #7, ...) rather than being renumbered.
  const rankOf = useMemo(
    () => new Map(rows.map((row, index) => [row.option.id, index + 1])),
    [rows],
  );
  const visible = useMemo(
    () => filterTonightRows(rows, kind, tagFilters),
    [rows, kind, tagFilters],
  );
  const hint = filterHint(kind, tagFilters);

  // The AI search mode restated for assistive tech: a polite announcement of
  // the pending state and of the swap between the deterministic list and the
  // AI result. The initial string is not announced — a live region only voices
  // changes — so a fresh load stays silent. A failed search is announced
  // separately by the inline error on the search box.
  const searchStatus = pending
    ? "Searching for dinner…"
    : aiResults === null
      ? "Showing the ranked dinner list."
      : aiResults.length === 0
        ? "AI search found no Options."
        : "Showing AI search results.";

  // The AI result resolved against the rows already on screen: every validated
  // id is in the active Catalog, so it has a row to render with name and Tags.
  const aiRows = useMemo(() => {
    if (aiResults === null) return null;
    const byId = new Map(rows.map((row) => [row.option.id, row]));
    return aiResults.flatMap((result) => {
      const row = byId.get(result.id);
      return row ? [{ row, reason: result.reason }] : [];
    });
  }, [aiResults, rows]);

  // Surface the AI-result state to the page header so its kind segment hides
  // while an AI result is on screen.
  useEffect(() => {
    onAiActiveChange(aiRows !== null);
  }, [aiRows, onAiActiveChange]);

  function cycleTag(tag: string) {
    setTagFilters((prev) => ({
      ...prev,
      [tag]: cycleChipState(prev[tag] ?? "off"),
    }));
  }

  function runSearch() {
    startTransition(async () => {
      const result = await aiSearchAction(query);
      if (!result.ok) {
        // A failed search leaves the deterministic list exactly as it was. The
        // inline error is persistent — it is not cleared on submit, only when a
        // later search succeeds (below) or the query is cleared.
        setAiError(true);
        return;
      }
      setAiError(false);
      setAiResults(result.results);
    });
  }

  function clearSearch() {
    setAiResults(null);
    setAiError(false);
    setQuery("");
  }

  return (
    <>
      <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-2 bg-bg px-4 py-3">
        {/* The search box appears only when AI search is configured; with
            no key Tonight is exactly v1 and the box is absent entirely. */}
        {searchEnabled && (
          <>
            <SearchBox
              query={query}
              onQueryChange={setQuery}
              onSubmit={runSearch}
              onClear={clearSearch}
              pending={pending}
              error={aiError}
              showClear={aiResults !== null || aiError}
            />
            <p className="sr-only" role="status" aria-live="polite">
              {searchStatus}
            </p>
          </>
        )}
        {/* The filter zone — kind segment and Tag chips — is hidden while an
            AI result is shown so the query alone ranks the list; clearing
            the search restores it with the deterministic list. */}
        {aiRows === null && (
          <>
            {tags.length > 0 && (
              <div
                role="group"
                aria-label="Filter by tag"
                className="flex flex-wrap gap-1"
              >
                {tags.map((tag) => (
                  <TagFilterChip
                    key={tag}
                    tag={tag}
                    state={tagFilters[tag] ?? "off"}
                    onClick={() => cycleTag(tag)}
                  />
                ))}
              </div>
            )}
            <p role="status" aria-live="polite" className="text-meta text-muted">
              {hint}
            </p>
          </>
        )}
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {rejectNotice}
      </p>
      {aiRows !== null ? (
        aiRows.length === 0 ? (
          // An empty AI result is a real answer — the model legitimately
          // found nothing fitting the query — not a broken screen. The
          // message mirrors the deterministic "No Options match" state; the
          // inline control returns the screen to the deterministic list.
          <div className="flex flex-col items-start gap-2">
            <p className="text-body text-muted">No Options fit that search.</p>
            <button
              type="button"
              onClick={clearSearch}
              className={`min-h-11 rounded-control px-3 text-body
                font-emphasis text-action transition-colors duration-short
                ${focusRing}`}
            >
              Clear search
            </button>
          </div>
        ) : (
          <ol className="flex flex-col">
            {aiRows.map(({ row, reason }, index) => (
              <TonightRowItem
                key={row.option.id}
                row={row}
                rank={index + 1}
                aiReason={reason}
                onRejected={(name) =>
                  setRejectNotice(`Rejected ${name}, removed from the list.`)
                }
              />
            ))}
          </ol>
        )
      ) : visible.length === 0 ? (
        <p className="text-body text-muted">
          No Options match the current filter.
        </p>
      ) : (
        <ol className="flex flex-col">
          {visible.map((row) => (
            <TonightRowItem
              key={row.option.id}
              row={row}
              rank={rankOf.get(row.option.id) ?? 0}
              onRejected={(name) =>
                setRejectNotice(`Rejected ${name}, removed from the list.`)
              }
            />
          ))}
        </ol>
      )}
    </>
  );
}

const inputClass =
  "min-h-11 rounded-input border border-line bg-surface px-3 text-body " +
  `text-ink placeholder:text-muted disabled:opacity-60 ${focusRing}`;

/**
 * The AI search box above the list. Submitting — by Enter or the Search button,
 * an empty query allowed — runs an AI search; an in-field Clear (✕) control
 * (shown once an AI result is on screen, or once a search has failed) restores
 * the deterministic list and clears the query. The box is disabled while a
 * search is in flight so only one search runs at a time.
 *
 * On failure a persistent inline error sits under the box: the deterministic
 * list is left untouched, and the Household can retry or just keep using it.
 *
 * The Search button tracks the search through three states: `accent` violet at
 * rest, a spinner with a live elapsed-second timer in flight, and a `success`
 * green check with the final duration once a result lands.
 */
function SearchBox({
  query,
  onQueryChange,
  onSubmit,
  onClear,
  pending,
  error,
  showClear,
}: {
  query: string;
  onQueryChange: (next: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  pending: boolean;
  error: boolean;
  showClear: boolean;
}) {
  // Elapsed whole seconds of the in-flight search. An AI search runs ~50–90s,
  // so a live counter reassures the Household the request is still working.
  // It is wall-clock based (not a tick count) so it stays accurate if a timer
  // fires late.
  const [elapsed, setElapsed] = useState(0);
  // The frozen duration of the last *successful* search — drives the "done"
  // badge (a check + the time) the button shows once a result lands. Null
  // until a search completes successfully.
  const [doneElapsed, setDoneElapsed] = useState<number | null>(null);
  const searchStartRef = useRef(0);
  const wasPendingRef = useRef(false);
  useEffect(() => {
    if (pending) {
      wasPendingRef.current = true;
      searchStartRef.current = Date.now();
      setElapsed(0);
      const id = setInterval(() => {
        setElapsed(Math.floor((Date.now() - searchStartRef.current) / 1000));
      }, 1000);
      return () => clearInterval(id);
    }
    // `pending` just went false. If a search was in flight, freeze its
    // duration — a successful search shows it as the done badge; a failed one
    // is dropped (the inline error speaks for it instead).
    if (wasPendingRef.current) {
      wasPendingRef.current = false;
      if (!error) {
        setDoneElapsed(
          Math.floor((Date.now() - searchStartRef.current) / 1000),
        );
      }
    }
  }, [pending, error]);

  // The done badge shows only while a successful AI result is on screen —
  // `showClear && !error`, no search in flight. Clearing the search drops
  // `showClear`, so the badge falls back to the plain "Search".
  const completed = !pending && !error && showClear && doneElapsed !== null;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-1"
    >
      <div className="flex items-center gap-1.5">
        {/* The input and its inline Clear (✕) share a relative wrapper so the
            ✕ sits *inside* the box. With no third control in the row, nothing
            can overflow the right edge when the viewport narrows. */}
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            disabled={pending}
            placeholder="leave empty for recommendations"
            aria-label="Search for dinner by intent"
            // Extra right padding only when the ✕ is shown, so query text
            // never runs under it.
            className={`${inputClass} w-full ${showClear ? "pr-11" : ""}`}
          />
          {showClear && (
            <button
              type="button"
              onClick={onClear}
              disabled={pending}
              aria-label="Clear search"
              className={`absolute inset-y-0 right-0 flex w-11 items-center
                justify-center rounded-input text-muted transition-colors
                duration-short hover:text-ink disabled:opacity-60
                ${focusRing}`}
            >
              <ClearIcon />
            </button>
          )}
        </div>
        {/* Width is pinned hard — `min-w` defeats the flex item's default
            `min-width: auto`, which would otherwise let the in-flight content
            grow the button. So none of the three states — "Search", the
            in-flight spinner + timer, the done check + time — ever resizes the
            button or the flex-1 input. `accent` violet sets the AI search
            apart from the charcoal PICK; the done badge turns `success`
            green. */}
        <button
          type="submit"
          disabled={pending}
          aria-label={
            pending
              ? `Searching — ${elapsed} seconds elapsed`
              : completed
                ? `Search complete in ${doneElapsed} seconds`
                : undefined
          }
          className={`flex min-h-11 w-[7rem] min-w-[7rem] shrink-0
            items-center justify-center gap-1.5 rounded-control px-4 text-body
            font-emphasis text-accent-ink transition-colors duration-short
            disabled:opacity-60 ${
              completed ? "bg-success" : "bg-accent hover:bg-accent-hover"
            } ${focusRing}`}
        >
          {pending ? (
            <>
              <Spinner />
              {/* Fixed-width, centered slot so the spinner stays put as the
                  second count gains digits. */}
              <span className="w-10 text-center font-mono tabular-nums">
                {elapsed}s
              </span>
            </>
          ) : completed ? (
            <>
              <CheckIcon />
              <span className="w-10 text-center font-mono tabular-nums">
                {doneElapsed}s
              </span>
            </>
          ) : (
            "Search"
          )}
        </button>
      </div>
      {error && (
        <p role="status" aria-live="polite" className="text-meta text-danger">
          Search unavailable — try again
        </p>
      )}
    </form>
  );
}

/**
 * A small indeterminate spinner — a single arc rotating on a transparent ring.
 * Shown on the Search button while a search is in flight; the rotation is
 * gated on `motion-safe` (DESIGN.md Motion), with the live second count
 * carrying the progress signal for reduced-motion users.
 */
function Spinner() {
  return (
    <span
      aria-hidden
      className="h-4 w-4 shrink-0 rounded-full border-2 border-transparent
        border-t-accent-ink motion-safe:animate-spin"
    />
  );
}

/** The ✕ glyph for the in-field Clear-search control. */
function ClearIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

/** The ✓ glyph for the search button's "done" badge. */
function CheckIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.5 8.5l3 3 6.5-7.5" />
    </svg>
  );
}

const KIND_SEGMENTS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "home", label: "Home" },
  { value: "restaurant", label: "Restaurant" },
];

/** The All/Home/Restaurant segment that narrows the list by Option kind. */
function KindSegment({
  kind,
  onChange,
}: {
  kind: KindFilter;
  onChange: (next: KindFilter) => void;
}) {
  return (
    <div role="group" aria-label="Filter by kind" className="flex gap-1.5">
      {KIND_SEGMENTS.map((segment) => {
        const selected = kind === segment.value;
        return (
          <button
            key={segment.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(segment.value)}
            className={`min-h-11 min-w-11 rounded-control px-3 text-chip
              transition-colors duration-micro ${focusRing} ${
                selected
                  ? "bg-action font-emphasis text-action-ink"
                  : "bg-raised text-muted"
              }`}
          >
            {segment.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * One tri-state tag filter chip. It cycles off → include → exclude → off on
 * tap. Each state has its own fill — a neutral off chip, a filled action
 * include chip, a filled danger exclude chip — plus a text decoration
 * (underline / strikethrough) so state stays legible without relying on color
 * alone (§18). The border is present in every state so toggling never changes
 * the chip's width and the wrapped rows never reflow. The chip's accessible
 * name announces its state ("pasta, included") for assistive tech. The chips
 * are deliberately compact — the filter zone holds ~20 tags and density beats
 * a 44px tap target here.
 */
function TagFilterChip({
  tag,
  state,
  onClick,
}: {
  tag: string;
  state: ChipState;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${tag}, ${chipStateLabel(state)}`}
      className={`inline-flex items-center justify-center rounded-badge border
        px-2 py-0.5 text-meta leading-tight underline-offset-2 transition-colors
        duration-micro ${focusRing} ${
          state === "include"
            ? "border-action bg-action text-action-ink underline"
            : state === "exclude"
              ? "border-exclude bg-exclude text-action-ink line-through"
              : "border-line bg-surface text-muted"
        }`}
    >
      {tag}
    </button>
  );
}
