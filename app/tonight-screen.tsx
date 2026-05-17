"use client";

import { useMemo, useState, useTransition } from "react";
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
import { aiSearchAction } from "./tonight-actions";
import { TonightRowItem } from "./tonight-row";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-accent";

/**
 * The Tonight screen (plan §9, §16) — the home screen. It renders the active
 * Catalog ranked by Score as a **flat, uniform list**: no lead-option
 * prominence, no collapsed long tail. Surfacing every Option is the point — the
 * app supplies the ranking, the human scans the whole list and decides.
 *
 * A sticky zone sits above the list: a search box, an All/Home/Restaurant kind
 * segment, and tri-state tag filter chips. Submitting the search box runs an
 * **AI search** (PRD: AI search) — the deterministic list swaps in place for an
 * AI-ranked result, each row carrying an AI rationale. Clearing the search, or
 * any page reload, restores the deterministic list. The deterministic ranking
 * stays the default that loads on its own; the AI result is never persisted.
 *
 * Each row carries the `pick = log` write action (§6) in `tonight-row.tsx` and
 * is pickable in either state.
 */
export function TonightScreen({ rows }: { rows: TonightRow[] }) {
  const [kind, setKind] = useState<KindFilter>("all");
  const [tagFilters, setTagFilters] = useState<TagFilters>({});

  // AI search state. `aiResults === null` is the default deterministic view;
  // a non-null value swaps the list for the AI result.
  const [query, setQuery] = useState("");
  const [aiResults, setAiResults] = useState<AiRankingRow[] | null>(null);
  const [aiError, setAiError] = useState(false);
  const [pending, startTransition] = useTransition();

  const tags = useMemo(() => distinctTags(rows), [rows]);
  // Rank reflects each Option's position in the full Score ranking, so a
  // filtered row keeps its true rank (#4, #7, ...) rather than being renumbered.
  const rankOf = useMemo(
    () => new Map(rows.map((row, index) => [row.option.id, index + 1])),
    [rows],
  );
  const visible = useMemo(
    () => filterTonightRows(rows, kind, tagFilters),
    [rows, kind, tagFilters],
  );
  const hint = filterHint(kind, tagFilters);

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
    setAiError(false);
    startTransition(async () => {
      const result = await aiSearchAction(query);
      if (!result.ok) {
        // A failed search leaves the deterministic list exactly as it was.
        setAiError(true);
        return;
      }
      setAiResults(result.results);
    });
  }

  function clearSearch() {
    setAiResults(null);
    setAiError(false);
    setQuery("");
  }

  return (
    <main className="column flex min-h-screen flex-col gap-5.5 pb-24 pt-5.5 desktop:pb-12">
      <h1 className="font-display text-h1 font-h1 text-ink">Tonight</h1>
      {rows.length === 0 ? (
        <p className="text-body text-muted">
          Your Catalog is empty.{" "}
          <Link
            href="/catalog"
            className={`font-emphasis text-accent ${focusRing}`}
          >
            Add your first meals →
          </Link>
        </p>
      ) : (
        <>
          <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-2 bg-bg px-4 py-3">
            <SearchBox
              query={query}
              onQueryChange={setQuery}
              onSubmit={runSearch}
              onClear={clearSearch}
              pending={pending}
              error={aiError}
              showClear={aiResults !== null}
            />
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
            <p
              role="status"
              aria-live="polite"
              className="text-meta text-muted"
            >
              {hint}
            </p>
          </div>
          {aiRows !== null ? (
            aiRows.length === 0 ? (
              <p className="text-body text-muted">
                No Options fit that search.
              </p>
            ) : (
              <ol className="flex flex-col">
                {aiRows.map(({ row, reason }, index) => (
                  <TonightRowItem
                    key={row.option.id}
                    row={row}
                    rank={index + 1}
                    aiReason={reason}
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
                />
              ))}
            </ol>
          )}
        </>
      )}
    </main>
  );
}

const inputClass =
  "min-h-11 rounded-input border border-line bg-surface px-3 text-body " +
  `text-ink placeholder:text-muted disabled:opacity-60 ${focusRing}`;

/**
 * The AI search box above the list. Submitting — by Enter or the Search button,
 * an empty query allowed — runs an AI search; a Clear control (shown once an AI
 * result is on screen) restores the deterministic list. The box is disabled
 * while a search is in flight so only one search runs at a time.
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
          className={`min-h-11 rounded-control bg-accent px-4 text-body
            font-emphasis text-accent-ink transition-colors duration-short
            hover:bg-accent-dark disabled:opacity-60 ${focusRing}`}
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
          Search failed — the deterministic list is unchanged.
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
    <div
      role="group"
      aria-label="Filter by kind"
      className="flex gap-1.5"
    >
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
                  ? "bg-accent font-emphasis text-accent-ink"
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
 * tap. Each state has its own fill — a neutral off chip, a filled accent
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
            ? "border-accent bg-accent text-accent-ink underline"
            : state === "exclude"
              ? "border-exclude bg-exclude text-accent-ink line-through"
              : "border-line bg-surface text-muted"
        }`}
    >
      {tag}
    </button>
  );
}
