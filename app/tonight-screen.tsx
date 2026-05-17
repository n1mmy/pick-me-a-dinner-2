"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
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
 * dinner" block of what was Picked and collapses the picker behind an "Add
 * another option" control. Picking from the re-opened picker appends the Option
 * to Tonight's dinner and auto-collapses the picker again. The heading stays
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
}) {
  const decided = tonightsDinner.length > 0;
  // Picker mode with nothing to rank at all — an empty Catalog, not "all Picked"
  // and not "all rejected" (both of which are real states with their own copy).
  const catalogEmpty = !decided && pickerRows.length === 0 && !allRejected;

  // In decided mode the picker is collapsed by default behind "Add another
  // option"; picker mode shows it outright, so this flag only governs decided
  // mode.
  const [pickerOpen, setPickerOpen] = useState(false);

  // Auto-collapse: a Pick revalidates the page, so `tonightsDinner` grows and
  // the re-opened picker should drop back to the settled view without a tap.
  // Keying off the count catches the new entry without re-collapsing on every
  // unrelated re-render.
  const dinnerCount = tonightsDinner.length;
  const lastDinnerCount = useRef(dinnerCount);
  useEffect(() => {
    if (dinnerCount !== lastDinnerCount.current) {
      lastDinnerCount.current = dinnerCount;
      setPickerOpen(false);
    }
  }, [dinnerCount]);

  // The mode restated for assistive tech. A live region voices only changes, so
  // a fresh load is silent; a Pick that flips picker → decided (or a Remove
  // that flips back) is announced.
  const modeStatus = decided
    ? "Tonight's dinner is decided."
    : "Choosing tonight's dinner.";

  return (
    <main className="column flex min-h-screen flex-col gap-5.5 pb-24 pt-5.5 desktop:pb-12">
      <h1 className="font-display text-h1 font-h1 text-ink">Tonight</h1>
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
          <button
            type="button"
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen((open) => !open)}
            className={`min-h-11 self-start rounded-control border border-line
              px-4 text-body font-emphasis text-action transition-colors
              duration-short hover:bg-raised ${focusRing}`}
          >
            {pickerOpen ? "Hide options" : "Add another option"}
          </button>
          {pickerOpen &&
            (pickerRows.length === 0 ? (
              <p className="text-body text-muted">
                {allRejected
                  ? "Every remaining Option has been rejected for tonight."
                  : "Every Option is already on tonight’s dinner."}
              </p>
            ) : (
              <Picker rows={pickerRows} searchEnabled={searchEnabled} />
            ))}
        </>
      ) : (
        <Picker rows={pickerRows} searchEnabled={searchEnabled} />
      )}
    </main>
  );
}

/**
 * The ranked picker: a sticky filter zone — optional AI search box, the
 * All/Home/Restaurant kind segment, the tri-state Tag filter chips — above the
 * flat ranked `<ol>`. It is the whole screen in picker mode and the collapsible
 * body in decided mode; its behavior is identical either way.
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
}: {
  rows: TonightRow[];
  searchEnabled: boolean;
}) {
  const [kind, setKind] = useState<KindFilter>("all");
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
            <KindSegment kind={kind} onChange={setKind} />
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
 * an empty query allowed — runs an AI search; a Clear control (shown once an AI
 * result is on screen, or once a search has failed) restores the deterministic
 * list and clears the query. The box is disabled while a search is in flight so
 * only one search runs at a time.
 *
 * On failure a persistent inline error sits under the box: the deterministic
 * list is left untouched, and the Household can retry or just keep using it.
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
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-1"
    >
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          disabled={pending}
          placeholder="Ask for dinner — something light, quick, fancy…"
          aria-label="Search for dinner by intent"
          className={`${inputClass} flex-1`}
        />
        <button
          type="submit"
          disabled={pending}
          className={`min-h-11 rounded-control bg-action px-4 text-body
            font-emphasis text-action-ink transition-colors duration-short
            hover:bg-action-hover disabled:opacity-60 ${focusRing}`}
        >
          {pending ? "Searching…" : "Search"}
        </button>
        {showClear && (
          <button
            type="button"
            onClick={onClear}
            disabled={pending}
            className={`min-h-11 rounded-control px-3 text-body text-muted
              transition-colors duration-short disabled:opacity-60 ${focusRing}`}
          >
            Clear
          </button>
        )}
      </div>
      {error && (
        <p role="status" aria-live="polite" className="text-meta text-danger">
          Search unavailable — try again
        </p>
      )}
    </form>
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
