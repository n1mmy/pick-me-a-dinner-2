"use client";

import { useId, useState } from "react";
import { noteComparison } from "../lib/prepared-comparison";
import { focusRing } from "./focus-ring";
import type { PreparedNoteView } from "./tonight-screen";

/**
 * The Selected day's **Prepared note** brief (ADR-0011; DESIGN.md, "Prepared
 * brief"): its own section under Tonight's heading block, in every mode. The
 * label line names when the note was written; the brief itself wears the AI
 * rationale line's treatment, the one look the app gives model prose.
 *
 * On a phone the brief clamps to two lines behind "Read more", so it never
 * pushes the list off a small screen; from the 720px `desktop:` step it shows
 * in full and the toggle is gone. The caller remounts this per Selected day,
 * so an expanded brief collapses again on a day change.
 *
 * On a decided date the block leads with where the frozen note ranked each
 * Log entry, and the brief starts hidden at every width behind "Read the note".
 */
export function PreparedBrief({
  note,
  decided,
  eaten,
}: {
  note: PreparedNoteView;
  /**
   * Whether the Selected day is decided (`SelectedDayView.decided`): its note
   * is then a frozen record of what was said beforehand, so the brief starts
   * hidden.
   */
  decided: boolean;
  /**
   * The Selected day's Picked Options, in Log order, for the comparison
   * lines. Empty when undecided — and on a decided date whose Picks are all
   * of Archived Options, which leaves the label alone.
   */
  eaten: { id: string; name: string }[];
}) {
  const [expanded, setExpanded] = useState(false);
  const briefId = useId();

  return (
    <section aria-label="Prepared note" className="flex flex-col gap-1">
      {noteComparison(note.ranking, eaten).map(({ name, rank }, index) => (
        <p key={index} className="text-meta text-ink">
          {rank === null ? (
            `The note didn't rank ${name}`
          ) : (
            <>
              The note ranked {name}{" "}
              <span className="font-mono tabular-nums">#{rank}</span>
            </>
          )}
        </p>
      ))}
      {/* Out of date is told, not alarmed: the sweep rewrites the note on
          its own, so the marker asks for care, not action — no color step. */}
      <p className="text-meta text-muted">
        {note.outOfDate ? `${note.label} · out of date, updating` : note.label}
      </p>
      {/* A frozen brief is a record of what was said, not advice to act on,
          so on a decided date it starts hidden at every width. */}
      {(expanded || !decided) && (
        <p
          id={briefId}
          className={`whitespace-pre-line rounded-badge bg-raised px-2 py-1
            text-chip text-muted desktop:line-clamp-none
            ${expanded ? "" : "line-clamp-2"}`}
        >
          {note.brief}
        </p>
      )}
      {/* Borderless, chip-size — the Day note's add style. The 44px target
          bleeds 12px into the column padding (so its text lines up with the
          brief's) and 12px down into the section gap. */}
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={briefId}
        onClick={() => setExpanded((open) => !open)}
        className={`-mb-3 -ml-3 min-h-11 self-start rounded-control px-3
          text-chip font-emphasis text-muted transition-colors duration-micro
          hover:bg-raised hover:text-ink ${decided ? "" : "desktop:hidden"}
          ${focusRing}`}
      >
        {decided
          ? expanded
            ? "Hide the note"
            : "Read the note"
          : expanded
            ? "Show less"
            : "Read more"}
      </button>
    </section>
  );
}
