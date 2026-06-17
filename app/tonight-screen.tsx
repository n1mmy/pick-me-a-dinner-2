"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import type { OptionChoice, TodayRejection } from "../db/queries";
import type { AiRankingRow } from "../lib/ai-search";
import { weekdayName } from "../lib/local-day";
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
import { DayStepper } from "./day-stepper";
import { kindBarClass } from "./kind-bar";
import { pickTonight } from "./log/actions";
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
 *
 * AI search state (`query`, `aiResults`, `aiError`, the in-flight transition)
 * lives here rather than inside the Picker. A Pick that flips picker →
 * decided wraps the Picker in a new `<section>`; React then unmounts the
 * picker-mode `<Picker>` and mounts a different one inside the section,
 * which would wipe any state owned by Picker. Holding the search state on
 * `TonightScreen` — which is the same instance across the transition — lets
 * the AI result survive the Pick (the Picked Option simply drops out of the
 * AI list on its own, because `pickerRows` no longer carries it).
 */
export function TonightScreen({
  tonightsDinner,
  pickerRows,
  searchEnabled,
  allRejected = false,
  rejectedTonight = [],
  selectedDay,
  todaySql,
}: {
  /** The Picked Options, in pick order — non-empty puts Tonight in decided mode. */
  tonightsDinner: TonightsDinnerEntry[];
  /** The ranked picker rows, with Picked and Selected-day-rejected Options removed. */
  pickerRows: TonightRow[];
  /** Whether AI search is configured — gates the search box (`aiSearchEnabled`). */
  searchEnabled: boolean;
  /**
   * True when the picker had rows but every one was rejected for the
   * Selected day (PRD: Rejections). It separates an all-rejected empty list —
   * a real state, with the Options back the next day — from a genuinely
   * empty Catalog.
   */
  allRejected?: boolean;
  /**
   * The Selected day's Rejections (PRD: Rejections on Tonight) — what the
   * "Rejected for [day]" disclosure lists and lets the Household bring back.
   * Empty by default, so the disclosure costs nothing until something is
   * rejected.
   */
  rejectedTonight?: TodayRejection[];
  /**
   * The Tonight screen's **Selected day** (ADR-0009). When equal to
   * `todaySql` the screen reads as today's Tonight; when not, the H1, copy,
   * and Pick/Reject writes all rotate to that day.
   */
  selectedDay: string;
  /** Today's SQL date in the Household's `APP_TZ`. */
  todaySql: string;
}) {
  const isToday = selectedDay === todaySql;
  // The H1 label: "Tonight" today, the weekday name on any other Selected day,
  // past or future (ADR-0009 amended). The full date stays visible in the
  // DayStepper, so a bare weekday is unambiguous. The navigation entry's
  // "Tonight" label is unchanged either way — it lives in `app-nav.tsx`.
  const heading = isToday ? "Tonight" : weekdayName(selectedDay);
  // Day-aware copy for the decided block, the "Rejected …" disclosure, and
  // the "all rejected" empty state. "tonight" for today, the weekday name
  // otherwise — the day name reads as a noun in both copy slots.
  const dayLabel = isToday ? "tonight" : weekdayName(selectedDay);
  const decided = tonightsDinner.length > 0;
  // Picker mode with nothing to rank at all — an empty Catalog, not "all Picked"
  // and not "all rejected" (both of which are real states with their own copy).
  const catalogEmpty = !decided && pickerRows.length === 0 && !allRejected;

  // The All/Home/Restaurant kind filter lives here so its segment can sit in
  // the page header beside "Tonight"; the Picker still owns the filtering.
  const [kind, setKind] = useState<KindFilter>("all");

  // AI search state lifted out of the Picker — see the component comment for
  // why. `aiResults === null` is the default deterministic view; a non-null
  // value (including an empty array — a real "no fit" answer) swaps the list
  // for the AI result. `aiActive` is derived directly so the kind segment can
  // hide while the result is on screen, without the Picker → parent
  // `useEffect` ping-pong this used to need.
  const [query, setQuery] = useState("");
  const [aiResults, setAiResults] = useState<AiRankingRow[] | null>(null);
  const [aiError, setAiError] = useState(false);
  const [searchPending, startSearchTransition] = useTransition();
  const aiActive = aiResults !== null;

  function runSearch() {
    startSearchTransition(async () => {
      const result = await aiSearchAction(
        query,
        isToday ? undefined : selectedDay,
      );
      if (!result.ok) {
        // A failed search leaves the deterministic list exactly as it was. The
        // inline error is persistent — it is not cleared on submit, only when a
        // later search succeeds or the query is cleared.
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
  // that flips back) is announced. The day-aware copy mirrors the visible H1.
  const modeStatus = decided
    ? `${capitalize(dayLabel)}'s dinner is decided.`
    : `Choosing ${dayLabel}'s dinner.`;

  // The kind segment shows only when a Picker is actually on screen and not
  // overridden by an AI result. The picker is on screen whenever there are rows
  // to rank — in picker mode, and below the divider in decided mode.
  const pickerRendered = pickerRows.length > 0;
  const showKindSegment = pickerRendered && !aiActive;

  return (
    <main className="column flex min-h-screen flex-col gap-5.5 pb-24 pt-5.5 desktop:pb-12">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-h1 font-h1 text-ink">{heading}</h1>
          <DayStepper selectedDay={selectedDay} todaySql={todaySql} />
        </div>
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
        // Every Option was rejected for the Selected day — a real state, not
        // a broken screen. A Rejection means "not this day": the Options
        // return on any other day.
        <p className="text-body text-muted">
          Every Option has been rejected for {dayLabel}. They&rsquo;ll be back
          on a different day.
        </p>
      ) : decided ? (
        <>
          <TonightsDinnerBlock
            entries={tonightsDinner}
            dayLabel={dayLabel}
            eatenOn={selectedDay}
          />
          {pickerRows.length === 0 ? (
            <p className="border-t border-line pt-5.5 text-body text-muted">
              {allRejected
                ? `Every remaining Option has been rejected for ${dayLabel}.`
                : `Every Option is already on ${dayLabel}’s dinner.`}
            </p>
          ) : (
            // The ranked picker stays open below the decided block, under a
            // divider. Picking from it Picks a *second* dinner for the
            // Selected day rather than replacing the first — the heading and
            // hint say so.
            <section
              aria-label="Add another option"
              className="flex flex-col gap-2 border-t border-line pt-5.5"
            >
              <h2 className="text-meta uppercase tracking-wide text-muted">
                Add another option
              </h2>
              <p className="text-meta text-muted">
                Picking one adds it to {dayLabel}&rsquo;s dinner — it
                won&rsquo;t replace what&rsquo;s already chosen.
              </p>
              <Picker
                rows={pickerRows}
                searchEnabled={searchEnabled}
                kind={kind}
                query={query}
                onQueryChange={setQuery}
                aiResults={aiResults}
                aiError={aiError}
                searchPending={searchPending}
                onSubmitSearch={runSearch}
                onClearSearch={clearSearch}
                selectedDay={selectedDay}
                isToday={isToday}
              />
            </section>
          )}
        </>
      ) : (
        <Picker
          rows={pickerRows}
          searchEnabled={searchEnabled}
          kind={kind}
          query={query}
          onQueryChange={setQuery}
          aiResults={aiResults}
          aiError={aiError}
          searchPending={searchPending}
          onSubmitSearch={runSearch}
          onClearSearch={clearSearch}
          selectedDay={selectedDay}
          isToday={isToday}
        />
      )}

      {/* Pinned to the bottom of the page, after the ranked rows — collapsed
          by default, so it costs no screen space until scrolled to. Rendered
          whenever something was rejected for the Selected day; it then lists
          those Rejections with a "Bring back" undo. */}
      {rejectedTonight.length > 0 && (
        <RejectedTonightDisclosure
          rejections={rejectedTonight}
          dayLabel={dayLabel}
        />
      )}
    </main>
  );
}

/** Capitalize a lowercase day label for sentence-start copy. */
function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
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
  dayLabel,
}: {
  rejections: TodayRejection[];
  /** Day-aware copy noun — "tonight" or the weekday name for any other Selected day. */
  dayLabel: string;
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
        {dayLabel === "tonight"
          ? `Rejected tonight (${rejections.length})`
          : `Rejected for ${dayLabel} (${rejections.length})`}
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
 * the resulting `kind`.
 *
 * AI search state — `query`, `aiResults`, `aiError`, the in-flight `pending`
 * flag — is owned by `TonightScreen` and threaded in as props, so a Pick that
 * flips picker → decided (which remounts this component inside a new
 * `<section>` wrapper) does not wipe the result. The search box appears only
 * when AI search is configured (`searchEnabled`). Submitting it runs an **AI
 * search** (PRD: AI search) — the deterministic list swaps in place for an
 * AI-ranked result, each row carrying an AI rationale. While an AI result is
 * shown the kind segment and Tag chips are hidden so the query is the single
 * ranking authority; clearing the search restores both.
 *
 * Each row carries the `pick = log` write action (§6) in `tonight-row.tsx`.
 */
function Picker({
  rows,
  searchEnabled,
  kind,
  query,
  onQueryChange,
  aiResults,
  aiError,
  searchPending,
  onSubmitSearch,
  onClearSearch,
  selectedDay,
  isToday,
}: {
  rows: TonightRow[];
  searchEnabled: boolean;
  kind: KindFilter;
  query: string;
  onQueryChange: (next: string) => void;
  aiResults: AiRankingRow[] | null;
  aiError: boolean;
  searchPending: boolean;
  onSubmitSearch: () => void;
  onClearSearch: () => void;
  /** The Selected day — threaded into Pick/Reject writes and AI search. */
  selectedDay: string;
  /** True when the Selected day is today — drives copy and lets AI search skip the parameter. */
  isToday: boolean;
}) {
  const [tagFilters, setTagFilters] = useState<TagFilters>({});

  // A submitted Rejection removes its row from the list on revalidation; this
  // live region — stable across that re-render, unlike the row itself —
  // announces the removal to assistive tech (PRD: Rejections, story 33).
  const [rejectNotice, setRejectNotice] = useState("");

  const tags = useMemo(() => distinctTags(rows), [rows]);
  // The search box's typeahead candidates: the ranked rows reduced to
  // OptionChoices and re-sorted by name (the rows arrive score-ordered; the
  // dropdown lists by name). It mirrors the picker exactly, so a typeahead
  // pick can never hit an already-picked or Selected-day-rejected Option.
  const choices = useMemo(
    () =>
      rows
        .map((row) => ({
          id: row.option.id,
          name: row.option.name,
          kind: row.option.kind,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [rows],
  );
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
  const searchStatus = searchPending
    ? "Searching for dinner…"
    : aiResults === null
      ? "Showing the ranked dinner list."
      : aiResults.length === 0
        ? "AI search found no Options."
        : "Showing AI search results.";

  // The AI result resolved against the rows already on screen: every validated
  // id is in the active Catalog, so it has a row to render with name and Tags.
  // A Pick (in picker mode → decided mode) drops the Picked Option from
  // `rows`, so its entry naturally falls out of `aiRows` while the rest of the
  // AI-ranked list stays put.
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

  return (
    <>
      <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-2 bg-bg px-4 py-3">
        {/* The search box appears only when AI search is configured; with
            no key Tonight is exactly v1 and the box is absent entirely. */}
        {searchEnabled && (
          <>
            <SearchBox
              query={query}
              onQueryChange={onQueryChange}
              onSubmit={onSubmitSearch}
              onClear={onClearSearch}
              pending={searchPending}
              error={aiError}
              showClear={aiResults !== null || aiError}
              choices={choices}
              selectedDay={selectedDay}
              isToday={isToday}
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
              onClick={onClearSearch}
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
                selectedDay={isToday ? undefined : selectedDay}
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
              selectedDay={isToday ? undefined : selectedDay}
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

/** The per-kind label on a dropdown row, mirroring the Log combobox's rows. */
function kindLabel(kind: "home" | "restaurant"): string {
  return kind === "home" ? "Home meal" : "Restaurant";
}

/**
 * The Tonight search box — one input doing two jobs (treatment A). Typing
 * filters the picker's Options by name into a dropdown beneath the field;
 * selecting a row logs that Option for the Selected day immediately
 * (`pick = log`, the same write the ranked rows carry) and clears the box. The
 * violet **Search** button — and Enter with nothing highlighted — instead runs
 * the slow **AI search** (PRD: AI search), swapping the list for an AI-ranked
 * result. So a click in the dropdown picks a dinner you already know; the
 * button asks the AI to choose.
 *
 * The dropdown appears only while a name actually matches, so a free-text
 * craving ("something light") shows none and reads purely as an AI query.
 * Nothing is highlighted by default — Enter falls through to the AI search;
 * ArrowDown steps into the dropdown and then Enter logs the highlight. Picks
 * commit through their own transition and a failed one (the Option deleted out
 * from under the field) surfaces inline, separate from the AI search's own
 * "unavailable" error.
 *
 * An in-field Clear (✕) control (shown whenever there is query text, an AI
 * result, or a failed search) clears the query and restores the deterministic
 * list; the box is disabled while a search is in flight so only one runs at a
 * time. The Search button tracks the search through three states: `accent`
 * violet at rest, a spinner with a live elapsed-second timer in flight, and a
 * `success` green check with the final duration once a result lands.
 */
function SearchBox({
  query,
  onQueryChange,
  onSubmit,
  onClear,
  pending,
  error,
  showClear,
  choices,
  selectedDay,
  isToday,
}: {
  query: string;
  onQueryChange: (next: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  pending: boolean;
  error: boolean;
  showClear: boolean;
  /** The picker's Options, by name — the typeahead's pick candidates. */
  choices: OptionChoice[];
  /** The Selected day a typeahead pick is logged to (ADR-0009). */
  selectedDay: string;
  /** True when the Selected day is today — then the pick omits the day. */
  isToday: boolean;
}) {
  const listId = useId();
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

  // Typeahead state: `open` gates the dropdown, `activeIndex` is the keyboard
  // highlight — −1 means nothing is highlighted, so Enter runs the AI search
  // rather than picking. A pick logs through its own transition; a failure
  // shows inline below the box.
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [pickError, setPickError] = useState<string | null>(null);
  const [, startPick] = useTransition();

  // Flat, case-insensitive substring match over the picker's Options. An empty
  // query matches nothing, so a blank box stays a clean AI "recommend" trigger
  // rather than dropping down the whole Catalog.
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return [];
    return choices.filter((option) =>
      option.name.toLowerCase().includes(needle),
    );
  }, [query, choices]);

  // The dropdown shows only when there is something to pick.
  const showList = open && matches.length > 0;

  function pick(option: OptionChoice) {
    setPickError(null);
    startPick(async () => {
      const result = await pickTonight(
        option.id,
        isToday ? undefined : selectedDay,
      );
      if (!result.ok) {
        setPickError(result.error);
        return;
      }
      // Clearing the query empties `matches`, which closes the dropdown; the
      // page's scroll-to-top effect confirms the pick.
      onQueryChange("");
      setOpen(false);
      setActiveIndex(-1);
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      if (matches.length === 0) return;
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, matches.length - 1));
    } else if (event.key === "ArrowUp") {
      if (matches.length === 0) return;
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, -1));
    } else if (event.key === "Enter") {
      // A highlighted match is picked; with nothing highlighted the keypress
      // falls through to the form's submit, which runs the AI search.
      if (showList && activeIndex >= 0) {
        event.preventDefault();
        pick(matches[activeIndex]);
      }
    } else if (event.key === "Escape") {
      if (showList) {
        event.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
      }
    }
  }

  const activeId =
    showList && activeIndex >= 0
      ? `${listId}-option-${matches[activeIndex].id}`
      : undefined;

  // The done badge shows only while a successful AI result is on screen —
  // `showClear && !error`, no search in flight. Clearing the search drops
  // `showClear`, so the badge falls back to the plain "Search".
  const completed = !pending && !error && showClear && doneElapsed !== null;

  // The in-field ✕ shows whenever there is something to clear — typed query
  // text, or an AI result/error already on screen — not only after a search
  // has run.
  const canClear = query.length > 0 || showClear;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        // Submitting is the AI search path; close any open dropdown first.
        setOpen(false);
        setActiveIndex(-1);
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
            onChange={(event) => {
              onQueryChange(event.target.value);
              setOpen(true);
              setActiveIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            disabled={pending}
            placeholder="Find a dinner, or describe a craving"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            aria-label="Find a dinner by name, or describe a craving"
            // Extra right padding only when the ✕ is shown, so query text
            // never runs under it.
            className={`${inputClass} w-full ${canClear ? "pr-11" : ""}`}
          />
          {canClear && (
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
          {/* The name-match dropdown. It sits inside the input's relative
              wrapper so it tracks the field's width, and above the list
              below (z-20). `onMouseDown` + preventDefault commits the pick
              before the input's blur can close the dropdown. */}
          {showList && (
            <ul
              id={listId}
              role="listbox"
              className="absolute left-0 right-0 top-full z-20 mt-1 flex
                max-h-64 flex-col overflow-y-auto rounded-input border
                border-line bg-surface py-1 shadow-sm"
            >
              {matches.map((option, index) => (
                <li key={option.id}>
                  <button
                    type="button"
                    id={`${listId}-option-${option.id}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    className={`flex min-h-11 w-full flex-col py-1.5 pr-3
                      text-left ${kindBarClass(option.kind)} ${
                        index === activeIndex ? "bg-raised" : "hover:bg-raised"
                      }`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      pick(option);
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    <span className="text-body text-ink">{option.name}</span>
                    <span className="text-meta text-muted">
                      {kindLabel(option.kind)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
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
      {pickError && (
        <p role="status" aria-live="polite" className="text-meta text-danger">
          {pickError}
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
