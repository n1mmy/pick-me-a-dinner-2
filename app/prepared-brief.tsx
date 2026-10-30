"use client";

import { useId, useState } from "react";
import { focusRing } from "./focus-ring";
import type { PreparedNoteView } from "./tonight-screen";

/**
 * The Selected day's **Prepared note** brief (ADR-0011; DESIGN.md, "Prepared
 * brief"): its own section under Tonight's heading block, in every mode,
 * decided or not. The brief wears the AI rationale line's treatment, the one
 * look the app gives model prose; the label naming when it was written sits
 * at the brief's lower right, in italics, so it costs no line of its own.
 *
 * On a phone the brief clamps to two lines behind "Read more", so it never
 * pushes the list off a small screen, and the label rides on the toggle's
 * row — inside the clamp it would be cut off. From the 720px `desktop:` step
 * the brief shows in full, the toggle is gone, and the label floats into the
 * brief's last line. The caller remounts this per Selected day, so an
 * expanded brief collapses again on a day change.
 */
export function PreparedBrief({ note }: { note: PreparedNoteView }) {
  const [expanded, setExpanded] = useState(false);
  const briefId = useId();

  return (
    <section aria-label="Prepared note" className="flex flex-col gap-1">
      <p
        id={briefId}
        className={`whitespace-pre-line rounded-badge bg-raised px-2 py-1
          text-chip text-muted desktop:line-clamp-none
          ${expanded ? "" : "line-clamp-2"}`}
      >
        {note.brief}
        <PreparedLabel
          note={note}
          className="ml-3 hidden desktop:float-right desktop:block"
        />
      </p>
      {/* Borderless, chip-size — the Day note's add style. The 44px target
          bleeds 12px into the column padding (so its text lines up with the
          brief's) and 12px down into the section gap. */}
      <div className="-mb-3 flex items-center justify-between gap-3 desktop:hidden">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={briefId}
          onClick={() => setExpanded((open) => !open)}
          className={`-ml-3 min-h-11 rounded-control px-3 text-chip
            font-emphasis text-muted transition-colors duration-micro
            hover:bg-raised hover:text-ink ${focusRing}`}
        >
          {expanded ? "Show less" : "Read more"}
        </button>
        <PreparedLabel note={note} className="pr-2 text-right" />
      </div>
    </section>
  );
}

/**
 * "Prepared 2:14pm", time in Geist Mono. Out of date is told, not alarmed:
 * the sweep rewrites the note on its own, so the marker asks for care, not
 * action — no color step.
 */
function PreparedLabel({
  note,
  className,
}: {
  note: PreparedNoteView;
  className: string;
}) {
  return (
    <span className={`text-meta text-muted italic ${className}`}>
      {note.label.prefix}{" "}
      <span className="font-mono tabular-nums">{note.label.time}</span>
      {note.outOfDate && " · out of date, updating"}
    </span>
  );
}
