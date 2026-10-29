"use client";

import { useId, useState } from "react";
import { focusRing } from "./focus-ring";
import type { PreparedNoteView } from "./tonight-screen";

/**
 * The Selected day's **Prepared note** brief (ADR-0011; DESIGN.md, "Prepared
 * brief"): its own section under Tonight's heading block, in every mode,
 * decided or not. The label line names when the note was written; the brief
 * itself wears the AI rationale line's treatment, the one look the app gives
 * model prose.
 *
 * On a phone the brief clamps to two lines behind "Read more", so it never
 * pushes the list off a small screen; from the 720px `desktop:` step it shows
 * in full and the toggle is gone. The caller remounts this per Selected day,
 * so an expanded brief collapses again on a day change.
 */
export function PreparedBrief({ note }: { note: PreparedNoteView }) {
  const [expanded, setExpanded] = useState(false);
  const briefId = useId();

  return (
    <section aria-label="Prepared note" className="flex flex-col gap-1">
      {/* Out of date is told, not alarmed: the sweep rewrites the note on
          its own, so the marker asks for care, not action — no color step. */}
      <p className="text-meta text-muted">
        {note.label.prefix}{" "}
        <span className="font-mono tabular-nums">{note.label.time}</span>
        {note.outOfDate && " · out of date, updating"}
      </p>
      <p
        id={briefId}
        className={`whitespace-pre-line rounded-badge bg-raised px-2 py-1
          text-chip text-muted desktop:line-clamp-none
          ${expanded ? "" : "line-clamp-2"}`}
      >
        {note.brief}
      </p>
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
          hover:bg-raised hover:text-ink desktop:hidden ${focusRing}`}
      >
        {expanded ? "Show less" : "Read more"}
      </button>
    </section>
  );
}
