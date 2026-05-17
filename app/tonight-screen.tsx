"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
 * A sticky filter zone sits above the list: an All/Home/Restaurant kind segment
 * and tri-state tag filter chips. The kind segment and every tag filter AND
 * together (see `lib/tonight-filter`); a hint line states the active filter in
 * words. Each row carries the `pick = log` write actions (§6) in
 * `tonight-row.tsx`.
 */
export function TonightScreen({
  rows,
  today,
}: {
  rows: TonightRow[];
  today: string;
}) {
  const [kind, setKind] = useState<KindFilter>("all");
  const [tagFilters, setTagFilters] = useState<TagFilters>({});

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

  function cycleTag(tag: string) {
    setTagFilters((prev) => ({
      ...prev,
      [tag]: cycleChipState(prev[tag] ?? "off"),
    }));
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
            <KindSegment kind={kind} onChange={setKind} />
            {tags.length > 0 && (
              <div
                role="group"
                aria-label="Filter by tag"
                className="flex flex-wrap gap-1.5"
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
          {visible.length === 0 ? (
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
                  today={today}
                />
              ))}
            </ol>
          )}
        </>
      )}
    </main>
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
 * tap. State is legible without color (§18): an include chip carries a leading
 * `+`, an exclude chip a leading `−` and a strikethrough. The chip's accessible
 * name announces its state ("pasta, included") for assistive tech, and the tap
 * target is at least 44×44px.
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
  const prefix = state === "include" ? "+ " : state === "exclude" ? "− " : "";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${tag}, ${chipStateLabel(state)}`}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center
        rounded-badge px-3 text-chip transition-colors duration-micro
        ${focusRing} ${
          state === "include"
            ? "bg-raised font-emphasis text-accent"
            : state === "exclude"
              ? "bg-raised text-danger line-through"
              : "bg-raised text-muted"
        }`}
    >
      {prefix}
      {tag}
    </button>
  );
}
