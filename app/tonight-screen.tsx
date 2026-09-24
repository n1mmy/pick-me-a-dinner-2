"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import type { OptionChoice, TodayRejection } from "../db/queries";
import type { AiRankingRow } from "../lib/ai-search";
import type { LastNote } from "../lib/last-note";
import { weekdayName } from "../lib/local-day";
import type { TonightRow } from "../lib/ranking";
import {
  chipStateLabel,
  cycleChipState,
  pickerView,
  type ChipState,
  type KindFilter,
  type TagFilters,
} from "../lib/picker-view";
import type { TonightsDinnerEntry } from "../lib/tonights-dinner";
import { DayNameReset, DayStepper } from "./day-stepper";
import {
  OptionListbox,
  filterOptionChoices,
  useComboboxKeyboard,
} from "./option-combobox";
import { fieldFocusRing, focusRing } from "./focus-ring";
import { pickTonight } from "./log/actions";
import { pressFeedback } from "./press-feedback";
import { deleteRejection } from "./rejection-actions";
import { aiSearchAction } from "./tonight-search-client";
import { TonightRowItem } from "./tonight-row";
import { TonightsDinnerBlock } from "./tonights-dinner-block";

/** The no-Last-notes default — module-level so its identity stays stable. */
const NO_LAST_NOTES: Map<string, LastNote> = new Map();

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
  lastNotes = NO_LAST_NOTES,
  searchEnabled,
  allFiltered = false,
  rejectedTonight = [],
  closedTonight = [],
  selectedDay,
  todaySql,
}: {
  /** The Picked Options, in pick order — non-empty puts Tonight in decided mode. */
  tonightsDinner: TonightsDinnerEntry[];
  /**
   * The ranked picker rows, with Picked, Selected-day-rejected, and
   * Selected-day-closed Options removed.
   */
  pickerRows: TonightRow[];
  /**
   * Each Option's **Last note** keyed by Option id — the newest Note dated
   * before the Selected day. One Map serves all three row types (picker, AI
   * result, decided); an Option absent from it renders no note line. Empty by
   * default so a screen with no Log history costs nothing.
   */
  lastNotes?: Map<string, LastNote>;
  /** Whether AI search is configured — gates the search box (`aiSearchEnabled`). */
  searchEnabled: boolean;
  /**
   * True when the picker had rows but every one was filtered out for the
   * Selected day — rejected, closed, or both (PRD: Rejections; PRD: Closed
   * days). It separates that real state, with the Options back the next day,
   * from a genuinely empty Catalog. One flag covers both filter causes: the
   * two disclosures directly below already say which Options landed where,
   * so the empty-picker copy itself need not distinguish the cause.
   */
  allFiltered?: boolean;
  /**
   * The Selected day's Rejections (PRD: Rejections on Tonight) — what the
   * "Rejected for [day]" disclosure lists and lets the Household bring back.
   * Empty by default, so the disclosure costs nothing until something is
   * rejected.
   */
  rejectedTonight?: TodayRejection[];
  /**
   * The Restaurants closed on the Selected day's weekday (PRD: Closed days,
   * ADR-0010) — what the **Closed disclosure** lists, alphabetical by name. A
   * Restaurant both closed and rejected for the Selected day is excluded here
   * (it appears in `rejectedTonight` only). Empty by default, so the
   * disclosure costs nothing until a Restaurant is shut for the day.
   */
  closedTonight?: TonightRow[];
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
  // and not "all filtered out" (both of which are real states with their own
  // copy).
  const catalogEmpty = !decided && pickerRows.length === 0 && !allFiltered;

  // The All/Home/Restaurant kind filter lives here, not in the Picker: a Pick
  // or day change that flips picker ↔ decided mode remounts the Picker, and
  // the chosen kind should survive that. The segment itself renders in the
  // Picker's filter zone, beside the Tag chips.
  const [kind, setKind] = useState<KindFilter>("all");

  // AI search state lifted out of the Picker — see the component comment for
  // why. `aiResults === null` is the default deterministic view; a non-null
  // value (including an empty array — a real "no fit" answer) swaps the list
  // for the AI result.
  const [query, setQuery] = useState("");
  const [aiResults, setAiResults] = useState<AiRankingRow[] | null>(null);
  const [aiError, setAiError] = useState(false);
  // When the in-flight search started (`Date.now()`), or null when none is in
  // flight. It doubles as the pending flag — our own, not `useTransition`'s:
  // Cancel needs to drop the Household back into control the instant they
  // ask, and React gives no way to make a transition's `isPending` go false
  // before its callback actually returns. `searchDoneSeconds` is how long the last
  // successful search took, for the Search button's done badge. Both live here
  // rather than in `SearchBox` because a day change that flips picker ↔ decided
  // mode remounts the Picker, which would restart the elapsed timer at 0s and
  // drop the badge.
  const [searchStartedAt, setSearchStartedAt] = useState<number | null>(null);
  const [searchDoneSeconds, setSearchDoneSeconds] = useState<number | null>(
    null,
  );
  // `startSearchTransition` wraps only the *post-fetch* state updates so they
  // land as a low-priority update. It must not wrap the `await` itself: an
  // async transition stays pending until its callback returns, and React
  // entangles any transition scheduled meanwhile with it — so a Pick's
  // revalidated props (which Next's router applies in a transition) would be
  // held off-screen for the whole 50–90s search.
  const [, startSearchTransition] = useTransition();
  // Bumped on every new search and on Cancel/Clear, so a search response that
  // lands after the Household has moved on — cancelled or superseded by a
  // newer query — is silently dropped instead of overwriting state nobody is
  // waiting on anymore. The in-flight request itself still runs to completion
  // server-side; only the client stops waiting on it.
  //
  // A Selected-day change deliberately does *not* bump it or clear anything
  // (ADR-0009, amendment 2026-09-22): a search in flight or already on screen
  // persists across the day change, so the Household can step between days —
  // or Pick — while the 50–90s search comes back, without paying for it again.
  // The result is resolved against the new day's rows, so an Option rejected,
  // closed, or Picked on that day simply drops out of it. The reverse is an
  // accepted gap: an Option available on the new day but not on the searched
  // day was never a candidate, so it is missing from the result until the
  // search is cleared.
  const searchGenerationRef = useRef(0);

  // An ordinary async function, deliberately not an async transition — see the
  // `startSearchTransition` comment above. The fetch itself is not a state
  // update, so nothing here needs transition semantics until the result lands.
  async function runSearch() {
    const generation = ++searchGenerationRef.current;
    const startedAt = Date.now();
    setSearchStartedAt(startedAt);
    const result = await aiSearchAction(
      query,
      isToday ? undefined : selectedDay,
    );
    if (searchGenerationRef.current !== generation) return;
    startSearchTransition(() => {
      setSearchStartedAt(null);
      if (!result.ok) {
        // A failed search leaves the deterministic list exactly as it was. The
        // inline error is persistent — it is not cleared on submit, only when a
        // later search succeeds or the query is cleared.
        setAiError(true);
        return;
      }
      setAiError(false);
      setAiResults(result.results);
      setSearchDoneSeconds(Math.floor((Date.now() - startedAt) / 1000));
    });
  }

  // Lets the Household out of a 50–90s search without waiting on it — the
  // Search button becomes this while one is in flight (design review UX idea
  // #3). Only the client stops waiting; the model call already dispatched
  // keeps running server-side and its (now-ignored) result is dropped by the
  // generation check in `runSearch`.
  function cancelSearch() {
    searchGenerationRef.current++;
    setSearchStartedAt(null);
  }

  function clearSearch() {
    searchGenerationRef.current++;
    setSearchStartedAt(null);
    setSearchDoneSeconds(null);
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

  return (
    <main className="column flex min-h-screen flex-col gap-5.5 pb-24 pt-5.5 desktop:pb-12">
      {/* On a phone the H1 and the stepper take a full-width row with the
          stepper pinned right, so it holds still as the day name changes
          length instead of sliding with it — and a long name shortens the H1
          rather than pushing the forward arrow off-screen. From `desktop:` up
          there is room to sit them side by side. */}
      <div
        className="flex w-full items-center justify-between gap-2
          desktop:justify-start desktop:gap-3"
      >
        <h1 className="min-w-0 font-display text-h1 font-h1 text-ink">
          <DayNameReset heading={heading} />
        </h1>
        <DayStepper selectedDay={selectedDay} todaySql={todaySql} />
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
      ) : !decided && allFiltered ? (
        // Every Option was filtered out for the Selected day — rejected,
        // closed, or both — a real state, not a broken screen. The copy
        // stays cause-agnostic rather than claiming a Rejection the
        // Household never made: the disclosures below say which Options
        // landed where. Either way the Options return on a different day.
        <p className="text-body text-muted">
          No Options are available for {dayLabel}. They&rsquo;ll be back on a
          different day.
        </p>
      ) : decided ? (
        <>
          <TonightsDinnerBlock
            entries={tonightsDinner}
            lastNotes={lastNotes}
            dayLabel={dayLabel}
            eatenOn={selectedDay}
          />
          {pickerRows.length === 0 ? (
            <p className="border-t border-divider pt-5.5 text-body text-muted">
              {allFiltered
                ? `Every remaining Option is unavailable for ${dayLabel}.`
                : `Every Option is already on ${dayLabel}’s dinner.`}
            </p>
          ) : (
            // The ranked picker stays open below the decided block, under a
            // divider. Picking from it Picks a *second* dinner for the
            // Selected day rather than replacing the first — the heading and
            // hint say so.
            <section
              aria-label="Add another option"
              className="flex flex-col gap-2 border-t border-divider pt-5.5"
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
                lastNotes={lastNotes}
                searchEnabled={searchEnabled}
                kind={kind}
                onKindChange={setKind}
                query={query}
                onQueryChange={setQuery}
                aiResults={aiResults}
                aiError={aiError}
                searchStartedAt={searchStartedAt}
                searchDoneSeconds={searchDoneSeconds}
                onSubmitSearch={runSearch}
                onCancelSearch={cancelSearch}
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
          lastNotes={lastNotes}
          searchEnabled={searchEnabled}
          kind={kind}
          onKindChange={setKind}
          query={query}
          onQueryChange={setQuery}
          aiResults={aiResults}
          aiError={aiError}
          searchStartedAt={searchStartedAt}
          searchDoneSeconds={searchDoneSeconds}
          onSubmitSearch={runSearch}
          onCancelSearch={cancelSearch}
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
          isToday={isToday}
        />
      )}

      {/* Below the Rejected disclosure (Rejected holds the time-sensitive
          undo, so it keeps the closer position — DESIGN.md "Closed
          disclosure"). Rendered whenever a Restaurant is closed on the
          Selected day's weekday. */}
      {closedTonight.length > 0 && (
        <ClosedDisclosure
          rows={closedTonight}
          lastNotes={lastNotes}
          dayLabel={dayLabel}
          selectedDay={selectedDay}
          isToday={isToday}
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
 * The toggle button shared by the Rejected and Closed disclosures — same
 * shape, same styling; only the label differs. `aria-expanded` and the
 * click handler are the caller's, so each disclosure still owns its own
 * `open` state.
 */
function DisclosureToggle({
  open,
  onToggle,
  label,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className={`min-h-11 self-start rounded-control border border-line
        px-4 text-body font-emphasis text-action transition-colors
        duration-short hover:bg-raised ${focusRing}`}
    >
      {label}
    </button>
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
 * A failed delete (e.g. a double-tap race) reports `{ ok: false }`, shown
 * inline under that row rather than silently leaving "Bring back" a no-op.
 * Only today's Rejections appear here; managing the historical Rejection log
 * is out of scope (PRD: Out of Scope).
 */
function RejectedTonightDisclosure({
  rejections,
  dayLabel,
  isToday,
}: {
  rejections: TodayRejection[];
  /** Day-aware copy noun — "tonight" or the weekday name for any other Selected day. */
  dayLabel: string;
  isToday: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  // Keyed by rejection id, since more than one row's "Bring back" could be
  // armed at once — a plain single error slot would drop one row's failure
  // when another row's write also failed.
  const [errors, setErrors] = useState<Record<string, string>>({});

  function bringBack(rejectionId: string) {
    setErrors((prev) => {
      if (!(rejectionId in prev)) return prev;
      const next = { ...prev };
      delete next[rejectionId];
      return next;
    });
    startTransition(async () => {
      const result = await deleteRejection(rejectionId);
      if (!result.ok) {
        setErrors((prev) => ({ ...prev, [rejectionId]: result.error }));
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <DisclosureToggle
        open={open}
        onToggle={() => setOpen((isOpen) => !isOpen)}
        label={
          isToday
            ? `Rejected tonight (${rejections.length})`
            : `Rejected for ${dayLabel} (${rejections.length})`
        }
      />
      {open && (
        <ul className="expand-in flex flex-col">
          {rejections.map((rejection) => (
            <li
              key={rejection.id}
              className="flex items-start gap-3 border-b border-divider py-3"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/catalog/${rejection.optionId}`}
                  className={`font-display text-name font-name text-ink
                    underline-offset-2 hover:underline ${focusRing}`}
                >
                  {rejection.optionName}
                </Link>
                {rejection.reason && (
                  <p className="mt-0.5 text-meta text-muted">
                    {rejection.reason}
                  </p>
                )}
                {errors[rejection.id] && (
                  <p className="mt-0.5 text-meta text-danger" role="alert">
                    {errors[rejection.id]}
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
 * The "Closed tonight (N)" / "Closed on Friday (N)" disclosure (PRD: Closed
 * days, ADR-0010; DESIGN.md "Closed disclosure") — a sibling of
 * `RejectedTonightDisclosure`, rendered below it: Rejected holds the
 * time-sensitive undo, so it keeps the closer position. Collapsed by default,
 * same as its sibling, so it costs no screen space until scrolled to.
 *
 * Its rows are the **full picker row** (`TonightRowItem`, with `rank` left
 * `undefined`) — the same Pick, Reject-with-reason, chip row, and Last note as
 * the ranked list above, because a Closed day is the app's best information,
 * not a veto: the Household may know better than the data. Rows are ordered
 * alphabetically by the caller (`app/page.tsx`) — this is a list, not a
 * ranking, so no row carries a rank numeral, though the `w-6` gutter still
 * renders empty to keep names on the picker's vertical. No per-row closure
 * label: the heading already says why every row is here.
 *
 * Rejecting a row writes an ordinary Rejection dated the Selected day, exactly
 * as the ranked picker's Reject control does — revalidation then moves it into
 * the Rejected disclosure with no special handling here. A Restaurant Picked
 * from this list simply appears in the decided block unremarked.
 */
function ClosedDisclosure({
  rows,
  lastNotes,
  dayLabel,
  selectedDay,
  isToday,
}: {
  rows: TonightRow[];
  lastNotes: Map<string, LastNote>;
  /** Day-aware copy noun — "tonight" or the weekday name for any other Selected day. */
  dayLabel: string;
  selectedDay: string;
  isToday: boolean;
}) {
  const [open, setOpen] = useState(false);

  // A submitted Rejection moves its row to the Rejected disclosure on
  // revalidation; this live region — stable across that re-render, unlike
  // the row itself — announces the removal, mirroring the Picker's own
  // (DESIGN.md "Closed disclosure": "the same row-leaves-on-write feedback
  // the picker already has").
  const [rejectNotice, setRejectNotice] = useState("");

  return (
    <div className="flex flex-col gap-2">
      <DisclosureToggle
        open={open}
        onToggle={() => setOpen((isOpen) => !isOpen)}
        label={
          isToday
            ? `Closed tonight (${rows.length})`
            : `Closed on ${dayLabel} (${rows.length})`
        }
      />
      <p className="sr-only" role="status" aria-live="polite">
        {rejectNotice}
      </p>
      {open && (
        // See the picker list above for why `gap-[2px]` replaces a divider here.
        <ul className="expand-in flex flex-col gap-[2px]">
          {rows.map((row) => (
            <TonightRowItem
              key={row.option.id}
              row={row}
              lastNote={lastNotes.get(row.option.id)}
              selectedDay={isToday ? undefined : selectedDay}
              onRejected={(name) =>
                setRejectNotice(`Rejected ${name}, removed from the list.`)
              }
            />
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
 * is identical either way. The All/Home/Restaurant kind segment sits in the
 * sticky filter zone as the first control on the Tag-chip line, so every
 * filter is in one place; its state is owned by `TonightScreen` (see the
 * `kind` comment there) and threaded in as `kind` / `onKindChange`.
 *
 * AI search state — `query`, `aiResults`, `aiError`, the in-flight search's
 * start time, the last search's duration — is owned by `TonightScreen` and
 * threaded in as props, so a Pick or a day change that flips picker ↔ decided
 * (which remounts this component inside or outside the `<section>` wrapper)
 * does not wipe the result or restart the timer. The search box appears only
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
  lastNotes,
  searchEnabled,
  kind,
  onKindChange,
  query,
  onQueryChange,
  aiResults,
  aiError,
  searchStartedAt,
  searchDoneSeconds,
  onSubmitSearch,
  onCancelSearch,
  onClearSearch,
  selectedDay,
  isToday,
}: {
  rows: TonightRow[];
  /** Each Option's Last note, keyed by Option id; absent means no note line. */
  lastNotes: Map<string, LastNote>;
  searchEnabled: boolean;
  kind: KindFilter;
  onKindChange: (next: KindFilter) => void;
  query: string;
  onQueryChange: (next: string) => void;
  aiResults: AiRankingRow[] | null;
  aiError: boolean;
  /** When the in-flight AI search started (`Date.now()`); null when none is. */
  searchStartedAt: number | null;
  /** How long the last successful AI search took, in whole seconds. */
  searchDoneSeconds: number | null;
  onSubmitSearch: () => void;
  onCancelSearch: () => void;
  onClearSearch: () => void;
  /** The Selected day — threaded into Pick/Reject writes and AI search. */
  selectedDay: string;
  /** True when the Selected day is today — drives copy and lets AI search skip the parameter. */
  isToday: boolean;
}) {
  const [tagFilters, setTagFilters] = useState<TagFilters>({});
  // The hint line restates the filter in words. With only the kind segment in
  // play it just repeats what the segment beside it already shows ("Showing
  // all Options", "Showing Home meals"), so it is visible only once a Tag
  // filter is on — where it earns its place summarising include/exclude
  // chips scattered across a wrapped row. It stays in the DOM as a live
  // region either way, so a kind change is still announced.
  const tagFilterActive = Object.values(tagFilters).some(
    (state) => state !== "off",
  );

  // A submitted Rejection removes its row from the list on revalidation; this
  // live region — stable across that re-render, unlike the row itself —
  // announces the removal to assistive tech (PRD: Rejections, story 33).
  const [rejectNotice, setRejectNotice] = useState("");

  // The Picker's view model: the filtered rows in rank order, each Option's
  // true rank and typeahead candidates from the unfiltered `rows` (so a
  // filtered row keeps its true rank instead of being renumbered, and a
  // typeahead pick can never hit an already-Picked or Selected-day-rejected
  // Option), the chip row's Tags, and the hint line.
  const { visible, rankOf, choices, tags, hint } = useMemo(
    () => pickerView(rows, kind, tagFilters),
    [rows, kind, tagFilters],
  );

  // The AI search mode restated for assistive tech: a polite announcement of
  // the pending state and of the swap between the deterministic list and the
  // AI result. The initial string is not announced — a live region only voices
  // changes — so a fresh load stays silent. A failed search is announced
  // separately by the inline error on the search box.
  const searchPending = searchStartedAt !== null;
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
              onCancel={onCancelSearch}
              onClear={onClearSearch}
              startedAt={searchStartedAt}
              doneSeconds={searchDoneSeconds}
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
            {/* One filter line: the kind segment leads, the Tag chips follow.
                On a phone the chips drop to their own full-width line under
                the segment (`basis-full`) rather than wrapping in the narrow
                column beside it; from `desktop:` up they flow in the space to
                its right. */}
            <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
              <KindSegment kind={kind} onChange={onKindChange} />
              {tags.length > 0 && (
                <div
                  role="group"
                  aria-label="Filter by tag"
                  className="flex min-w-0 basis-full flex-wrap gap-1
                    desktop:flex-1 desktop:basis-0"
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
            </div>
            <p
              role="status"
              aria-live="polite"
              className={tagFilterActive ? "text-meta text-muted" : "sr-only"}
            >
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
          // gap-[2px] (off-scale, like the 3px kind bar — a rule weight, not
          // a layout step) separates rows with a sliver of `bg` instead of a
          // divider: every row already carries a kind-tinted background, so a
          // divider between two tinted rows read as a redundant, heavy seam.
          <ol className="flex flex-col gap-[2px]">
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
        // See the AI-rows list above for why `gap-[2px]` replaces a divider here.
        <ol className="flex flex-col gap-[2px]">
          {visible.map((row) => (
            <TonightRowItem
              key={row.option.id}
              row={row}
              rank={rankOf.get(row.option.id) ?? 0}
              lastNote={lastNotes.get(row.option.id)}
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
  `text-ink placeholder:text-muted disabled:opacity-60 ${fieldFocusRing}`;

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
 * list. The input itself is never disabled — an AI search runs 50–90s, and a
 * Household member typing a name to pick by hand while it thinks shouldn't
 * have to wait on it (design review UX idea #3); their pick and the AI search
 * are independent writes/reads that simply race. The Search button tracks the
 * search through three states: `accent` violet "Search" at rest, an in-flight
 * state that trades the button's own affordance for a **Cancel** one — a
 * live elapsed-second timer, clicking it gives up on the wait without
 * touching the model call already dispatched server-side — and a `success`
 * green check with the final duration once a result lands.
 *
 * The typeahead's filter, ↑/↓/Enter/Escape handling, and dropdown markup are
 * the same `filterOptionChoices`/`useComboboxKeyboard`/`OptionListbox`
 * contract `OptionCombobox` uses for the Log and Option-detail forms
 * (`emptyQueryBehaviour: "none"`, `initialActiveIndex: -1`) — this box keeps
 * only what is genuinely its own: the query state shared with AI search, the
 * submit/clear affordances, and the pending/error UI.
 */
function SearchBox({
  query,
  onQueryChange,
  onSubmit,
  onCancel,
  onClear,
  startedAt,
  doneSeconds,
  error,
  showClear,
  choices,
  selectedDay,
  isToday,
}: {
  query: string;
  onQueryChange: (next: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onClear: () => void;
  /** When the in-flight AI search started (`Date.now()`); null when none is. */
  startedAt: number | null;
  /**
   * How long the last successful AI search took, in whole seconds — the
   * "done" badge's time. Null until a search succeeds.
   */
  doneSeconds: number | null;
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
  const pending = startedAt !== null;
  // Elapsed whole seconds of the in-flight search. An AI search runs ~50–90s,
  // so a live counter reassures the Household the request is still working.
  // It is wall-clock based — measured from `startedAt`, which the parent holds
  // — so it stays accurate if a timer fires late, and picks up where it was
  // if this box remounts mid-search.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (startedAt === null) return;
    const tick = () =>
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  // Typeahead state: `open` gates the dropdown. A pick logs through its own
  // transition; a failure shows inline below the box.
  const [open, setOpen] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [, startPick] = useTransition();

  // The same substring filter every Option typeahead uses (`option-combobox`).
  // An empty query matches nothing here (`"none"`), so a blank box stays a
  // clean AI "recommend" trigger rather than dropping down the whole Catalog.
  const matches = useMemo(
    () => filterOptionChoices(choices, query, "none"),
    [query, choices],
  );

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
    });
  }

  // The same ↑/↓/Enter/Escape contract every Option typeahead uses
  // (`option-combobox`), with `initialActiveIndex: -1` so Enter with nothing
  // highlighted falls through to the form's own submit — the AI search —
  // rather than picking.
  const {
    activeIndex,
    setActiveIndex,
    resetActiveIndex,
    handleKeyDown,
    activeId,
  } = useComboboxKeyboard({
    open,
    setOpen,
    matches,
    initialActiveIndex: -1,
    onSelect: pick,
    onEscape: () => setOpen(false),
  });

  // The done badge shows only while a successful AI result is on screen —
  // `showClear && !error`, no search in flight. Clearing the search drops
  // `showClear`, so the badge falls back to the plain "Search".
  const completed = !pending && !error && showClear && doneSeconds !== null;

  // The in-field ✕ shows whenever there is something to clear — typed query
  // text, or an AI result/error already on screen — not only after a search
  // has run.
  const canClear = query.length > 0 || showClear;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        // Guards the same race the Cancel button's own `preventDefault`
        // closes below: an Enter keypress reaches the form directly (no
        // click, no button involved), so if it lands in the instant the
        // button's type is flipping from "button" back to "submit" it can
        // still fire a submit here even though the Household meant Cancel.
        if (pending) return;
        // Submitting is the AI search path; close any open dropdown first.
        setOpen(false);
        resetActiveIndex();
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
              resetActiveIndex();
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            placeholder="Find a dinner, or describe a craving"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeId(listId)}
            aria-label="Find a dinner by name, or describe a craving"
            // Extra right padding only when the ✕ is shown, so query text
            // never runs under it.
            className={`${inputClass} w-full ${canClear ? "pr-11" : ""}`}
          />
          {canClear && (
            <button
              type="button"
              onClick={onClear}
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
            <OptionListbox
              listId={listId}
              matches={matches}
              activeIndex={activeIndex}
              isSelected={(_option, index) => index === activeIndex}
              onSelect={pick}
              onHover={setActiveIndex}
              className="absolute left-0 right-0 top-full z-20 mt-1 flex
                max-h-64 flex-col overflow-y-auto rounded-input border
                border-line bg-surface py-1 shadow-sm"
              rowClassName="pr-3"
            />
          )}
        </div>
        {/* Width is pinned hard — `min-w` defeats the flex item's default
            `min-width: auto`, which would otherwise let the in-flight content
            grow the button. So none of the three states — "Search", Cancel +
            timer, the done check + time — ever resizes the button or the
            flex-1 input. `accent` violet sets the AI search apart from the
            charcoal PICK; the done badge turns `success` green. The label
            switches to `action-ink` on that green fill — `accent-ink` is
            tuned for the violet fill and is white in both themes, but
            dark-theme `success` must stay light enough to also work as body
            text elsewhere, which leaves a white label on it at 2.91:1 (fails
            AA). `action-ink` is the token for "ink that sits on a filled
            surface" and clears 4.5:1 against `success` in both themes — see
            docs/design-review-2026-09-21.md A2.

            While pending the button trades its "Search"/submit role for
            Cancel (`type="button"`, so Enter elsewhere in the form can't
            re-trigger it) — never disabled, so the Household is never stuck
            waiting on the 50–90s call (UX idea #3). */}
        <button
          type={pending ? "button" : "submit"}
          onClick={
            pending
              ? (event) => {
                  // `type="button"` alone isn't enough: this same click's
                  // `onCancel` flips `pending` to false, and React commits
                  // that re-render — swapping this button's own `type` to
                  // "submit" — before the browser finishes deciding this
                  // click's default action, so the click can still submit
                  // the form it just un-typed itself into. Explicitly
                  // cancelling the click's default action closes that race
                  // regardless of what `type` ends up as.
                  event.preventDefault();
                  onCancel();
                }
              : undefined
          }
          aria-label={
            pending
              ? `Cancel search — ${elapsed} seconds elapsed`
              : completed
                ? `Search complete in ${doneSeconds} seconds`
                : undefined
          }
          className={`flex min-h-11 w-[7rem] min-w-[7rem] shrink-0
            items-center justify-center gap-1.5 rounded-control px-4 text-body
            font-emphasis ${pressFeedback}
            ${
              completed
                ? "bg-success text-action-ink"
                : "bg-accent text-accent-ink hover:bg-accent-hover"
            } ${focusRing}`}
        >
          {pending ? (
            <>
              {/* The ✕ (not the old spinner) says this is now a Cancel
                  control; the ticking elapsed count still carries the
                  in-progress signal — including for reduced-motion, which
                  the spinner's spin animation always deferred to anyway. */}
              <ClearIcon />
              <span className="w-10 text-center font-mono tabular-nums">
                {elapsed}s
              </span>
            </>
          ) : completed ? (
            <>
              <CheckIcon />
              <span className="w-10 text-center font-mono tabular-nums">
                {doneSeconds}s
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

/** The ✕ glyph for the in-field Clear-search control, and the Search button's Cancel state. */
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

/**
 * The All/Home/Restaurant segment that narrows the list by Option kind. A
 * single `raised` track (2026-09-24) replaces the earlier three separately-
 * filled pills: one `action`-filled thumb slides under the selected label
 * instead of each option drawing its own box. The thumb is one absolutely-
 * positioned `div` sized to an even third of the track and moved by
 * `translateX(index * 100%)` — a fraction of its own width, so no size
 * measurement is needed — behind the buttons, which go transparent. The track
 * is a three-column grid rather than a `flex-1` row: an auto-width grid sizes
 * every `1fr` column to the widest label ("Restaurant"), so the buttons really
 * are even thirds and the thumb lands exactly under each one. (A `flex-1` row
 * inside an auto-width track gave each button its own content width, and the
 * one-third thumb drifted across the labels.)
 *
 * It sits in the filter zone at Tag-chip scale (2026-09-24), not in the page
 * header at the header's 36px: the kind filter is rarely changed, so it no
 * longer earns header space, and sized like the chips beside it it reads as
 * one of the filters rather than a louder control above them. Same `meta`
 * type, `leading-tight`, `py-0.5` and `rounded-badge` as a `TagFilterChip`,
 * and a `p-px` track inset (off-scale, like the 3px kind bar) so the whole
 * segment lands on the chips' height. Like the chips it is below the 44px tap
 * floor by design: a mis-tap only re-filters the list and is undone by the
 * next tap.
 */
function KindSegment({
  kind,
  onChange,
}: {
  kind: KindFilter;
  onChange: (next: KindFilter) => void;
}) {
  const selectedIndex = KIND_SEGMENTS.findIndex((s) => s.value === kind);
  return (
    <div
      role="group"
      aria-label="Filter by kind"
      className="relative grid shrink-0 grid-cols-3 rounded-badge bg-raised p-px"
    >
      <div
        aria-hidden
        className="absolute inset-y-px left-px rounded-badge bg-action
          transition-transform duration-short ease-in-out
          motion-reduce:transition-none"
        style={{
          width: `calc((100% - 2px) / ${KIND_SEGMENTS.length})`,
          transform: `translateX(${selectedIndex * 100}%)`,
        }}
      />
      {KIND_SEGMENTS.map((segment) => {
        const selected = kind === segment.value;
        return (
          <button
            key={segment.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(segment.value)}
            className={`relative z-10 rounded-badge px-2 py-0.5 text-meta
              leading-tight transition-colors duration-micro ${focusRing} ${
                selected ? "font-emphasis text-action-ink" : "text-muted"
              }`}
          >
            {/* The selected label goes bold, and bold "Restaurant" is wider —
                which widened every equal column and grew the whole track on
                each toggle. An invisible bold copy stacked in the same grid
                cell reserves the bold width in every state, so the track
                never changes size. `aria-hidden` keeps it out of the
                button's accessible name. */}
            <span className="grid">
              <span
                aria-hidden
                className="invisible col-start-1 row-start-1 font-emphasis"
              >
                {segment.label}
              </span>
              <span className="col-start-1 row-start-1">{segment.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * One tri-state tag filter chip. It cycles off → include → exclude → off on
 * tap. Each state has its own fill — a neutral `raised` off chip, a filled
 * action include chip, a filled exclude chip — plus a text decoration
 * (underline / strikethrough) so state stays legible without relying on color
 * alone (§18). Every state keeps a `border` class (transparent off-state,
 * same-hue-as-fill for include/exclude) so toggling never changes the chip's
 * width and the wrapped rows never reflow — only the off state used to render
 * a *visible* border; it is now borderless like the other two, so a row of
 * chips reads as fills, not a grid of boxes. The chip's accessible name
 * announces its state ("pasta, included") for assistive tech. The chips are
 * deliberately compact — the filter zone holds ~20 tags and density beats a
 * 44px tap target here.
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
        border-transparent px-2 py-0.5 text-meta leading-tight
        underline-offset-2 transition-colors duration-micro ${focusRing} ${
          state === "include"
            ? "bg-action text-action-ink underline"
            : state === "exclude"
              ? "bg-exclude text-action-ink line-through"
              : "bg-raised text-ink"
        }`}
    >
      {tag}
    </button>
  );
}
