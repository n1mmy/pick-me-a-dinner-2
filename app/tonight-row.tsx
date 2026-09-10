"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { noteAge, type LastNote } from "../lib/last-note";
import { CAP } from "../lib/ranking.config";
import type { TagRecency, TonightRow } from "../lib/ranking";
import {
  affinityChipBg,
  recencyChipBg,
  recencyChipBgStrong,
} from "../lib/recency-color";
import { kindBarClass } from "./kind-bar";
import { pickTonight } from "./log/actions";
import { rejectOption } from "./rejection-actions";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-action";

/**
 * One Tonight row of the flat ledger (DESIGN.md "Tonight row anatomy"). The
 * name sits above a chip row — the Recency chip then the Tag chips — with the
 * "Pick" action pinned to the row's right edge on every width. "Pick" is the
 * one-tap `pick = log` path; the picked button briefly marks "Logged ✓". To
 * log a dinner for any other date, use the Log screen.
 *
 * Below "Pick" sits a secondary, low-emphasis "Reject" control (PRD: Rejections
 * on Tonight) — deliberately subordinate to the primary Pick button. Tapping it
 * inline-expands a reason box on the row: an autofocused text input with
 * Submit and Cancel. The reason is optional; Submit records the Rejection dated
 * today and the row drops out on revalidation, Cancel collapses the box with
 * nothing recorded. The two-step (reject → Submit) is the mis-tap guard. A
 * write that fails — a double-tap race that collides with today's existing
 * Rejection — shows the inline error rather than silently dropping the row.
 *
 * When the Option has a **Last note** the row carries it as one muted line under
 * the chips (DESIGN.md, "Last note line"): the note's age then its text, clamped
 * to a single line and tappable to unclamp. It is what happened last time this
 * Option was eaten, put where the choosing happens instead of only in Log
 * history. An Option with no earlier Note renders no line at all.
 *
 * On an AI search result row, `aiReason` is the AI rationale — a prose "why"
 * line the deterministic list does not have; it sits below the chip row on a
 * neutral `raised` surface. It may be an empty string — in `pithy` mode the
 * model deliberately returns no rationale for an obviously bad pick — and an
 * empty `aiReason` renders no line at all, so that row reads like a
 * deterministic one. The Recency and Tag chips render the same on AI and
 * deterministic rows.
 */
export function TonightRowItem({
  row,
  rank,
  aiReason,
  lastNote,
  selectedDay,
  onRejected,
}: {
  row: TonightRow;
  rank: number;
  aiReason?: string;
  /**
   * The Option's **Last note** — its newest Note dated before the Selected day
   * — or `undefined` when it has none, which renders no line.
   */
  lastNote?: LastNote;
  /**
   * The Tonight screen's **Selected day** (ADR-0009) — passed only when it is
   * not today. Pick and Reject writes use it to date the row to a future
   * Selected day; on today it is omitted and the actions default to today.
   */
  selectedDay?: string;
  /** Called with the Option name once a Rejection is recorded — drives the
   *  list's live-region "removed" announcement (the row itself then unmounts). */
  onRejected?: (optionName: string) => void;
}) {
  const { option } = row;
  const [justLogged, setJustLogged] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Reject affordance: `rejecting` toggles the inline reason box; `reason` is
  // the optional text. The box is keyed open server-side nowhere — it is purely
  // local until Submit writes the Rejection.
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const boxId = `reject-box-${option.id}`;

  function pick() {
    setActionError(null);
    startTransition(async () => {
      const result = await pickTonight(option.id, selectedDay);
      if (!result.ok) {
        // Never flash a false "Logged ✓" — show the failure on the row instead.
        setActionError(result.error);
        return;
      }
      // Hold "Logged ✓" briefly; the revalidation re-sorts the list under it.
      setJustLogged(true);
      window.setTimeout(() => setJustLogged(false), 1600);
    });
  }

  function submitReject() {
    setActionError(null);
    startTransition(async () => {
      const result = await rejectOption(option.id, reason, selectedDay);
      if (!result.ok) {
        // A double-tap race collided with today's Rejection — surface the
        // failure inline rather than silently leaving the row in place.
        setActionError(result.error);
        return;
      }
      // The Rejection dropped this Option from the picker; the parent's live
      // region announces the removal before this row unmounts on revalidation.
      onRejected?.(option.name);
    });
  }

  function cancelReject() {
    setRejecting(false);
    setReason("");
    setActionError(null);
  }

  return (
    <li
      className={`border-b border-line py-[10px]
        ${kindBarClass(option.kind)}`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="w-6 shrink-0 text-right font-mono text-meta tabular-nums text-muted">
              {rank}
            </span>
            <Link
              href={`/catalog/${option.id}`}
              className={`font-display text-name font-name text-ink
                underline-offset-2 hover:underline ${focusRing}`}
            >
              {option.name}
            </Link>
          </div>
          <RowChips
            affinity={row.affinity}
            recencyDays={row.recencyDays}
            neverEaten={row.neverEaten}
            tags={row.tags}
          />
          {lastNote && <LastNoteLine lastNote={lastNote} />}
          {aiReason && (
            <p className="mt-1 rounded-badge bg-raised px-2 py-1 text-chip text-muted">
              <MonoNumerals text={aiReason} />
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <button
            type="button"
            onClick={pick}
            disabled={pending}
            aria-live="polite"
            className={`min-h-11 rounded-control px-4 text-body font-emphasis
              transition-colors duration-short disabled:opacity-60
              ${focusRing} ${
                justLogged
                  ? "bg-raised text-success"
                  : "bg-action text-action-ink hover:bg-action-hover"
              }`}
          >
            {justLogged ? "Logged ✓" : "Pick"}
          </button>
          <button
            type="button"
            onClick={() => setRejecting((open) => !open)}
            disabled={pending}
            aria-expanded={rejecting}
            aria-controls={boxId}
            className={`min-h-11 rounded-control px-3 text-meta text-muted
              transition-colors duration-short hover:text-ink
              disabled:opacity-60 ${focusRing}`}
          >
            Reject
          </button>
        </div>
      </div>
      {rejecting && (
        <form
          id={boxId}
          onSubmit={(event) => {
            event.preventDefault();
            submitReject();
          }}
          className="mt-2 flex items-center gap-2"
        >
          <input
            type="text"
            autoFocus
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={pending}
            placeholder="Reason (optional)"
            aria-label={`Reason for rejecting ${option.name} (optional)`}
            className={`min-h-11 min-w-0 flex-1 rounded-input border border-line
              bg-surface px-3 text-body text-ink placeholder:text-muted
              disabled:opacity-60 ${focusRing}`}
          />
          <button
            type="submit"
            disabled={pending}
            className={`min-h-11 shrink-0 rounded-control border border-line
              px-4 text-body font-emphasis text-action transition-colors
              duration-short hover:bg-raised disabled:opacity-60 ${focusRing}`}
          >
            Submit
          </button>
          <button
            type="button"
            onClick={cancelReject}
            disabled={pending}
            className={`min-h-11 shrink-0 rounded-control px-3 text-body
              text-muted transition-colors duration-short disabled:opacity-60
              ${focusRing}`}
          >
            Cancel
          </button>
        </form>
      )}
      {actionError && (
        <p className="mt-2 text-chip text-danger" aria-live="polite">
          {actionError}
        </p>
      )}
    </li>
  );
}

/**
 * The picker row's **Last note** line: the note's age then its text
 * (`18d · got the katsu curry`), muted italic, held to one line.
 *
 * Italic is the quieting device (DESIGN.md, "Last note line"): the note is
 * reported speech from another night sitting in a row of live ranking data, and
 * the slant says "aside" without spending another size or color step. The age
 * slants with it — the whole line is one aside, and an upright numeral inside
 * an italic line reads as a correction rather than a column to scan.
 *
 * It sits a step below and a step inside the chip row (`mt-1 pl-2`) so the
 * note reads as subordinate to the row's data rather than a fourth peer line.
 * That step down is paid for out of the row's own padding — the `li` is
 * `py-[10px]`, the tight end of DESIGN.md's 10–12px row padding, rather than
 * `py-3`'s 12px — so a noted row came out *shorter* than it was before the
 * step. Deepen the indent or the gap only by finding those pixels somewhere
 * else. The literal 10px is deliberate: the spacing scale is 4/6/8/12/16/22px,
 * so 10px has no token, the same reason the kind bar spells out `3px`.
 *
 * Tapping it unclamps to the full note and tapping again re-clamps, so a long
 * note is readable without leaving the screen; a `title` gives the same text to
 * a desktop hover. The control is sized to its text rather than the usual 44px
 * `min-h-11` — a deliberate, documented exception (DESIGN.md, "Last-note tap
 * target"): the 44px floor guards controls where a mis-tap costs something, and
 * paying it on every noted row would spend the height the clamp exists to save.
 *
 * The single line is held by `truncate`, **not** `line-clamp-1`: a clamp needs
 * `display: -webkit-box`, and a `<button>` blockifies its inner display, so the
 * clamp is coerced away and a long note quietly wraps to a second line — the
 * row growth the single line exists to prevent. `truncate` (nowrap + ellipsis)
 * survives blockification; `whitespace-normal` is what releases it when
 * expanded. Its `leading-tight` matches the chip row above, so the note reads
 * as the chips' last line rather than a separate paragraph.
 */
function LastNoteLine({ lastNote }: { lastNote: LastNote }) {
  const [expanded, setExpanded] = useState(false);
  const age = noteAge(lastNote.daysAgo);
  return (
    <button
      type="button"
      onClick={() => setExpanded((open) => !open)}
      aria-expanded={expanded}
      aria-label={`Last note, ${age} ago: ${lastNote.text}`}
      title={lastNote.text}
      className={`mt-1 block w-full pl-2 text-left text-chip italic
        leading-tight text-muted transition-colors duration-short
        hover:text-ink ${focusRing}
        ${expanded ? "whitespace-normal" : "truncate"}`}
    >
      <span className="font-mono tabular-nums">{age}</span>
      {` · ${lastNote.text}`}
    </button>
  );
}

/**
 * The chip row directly under an Option name on a Tonight or decided row: the
 * Affinity chip (when one is supplied), then the Recency chip — the Option's own
 * per-Option recency — then one Tag chip per Tag. Every chip is tinted on the
 * shared green→red heatmap: the Recency and Tag chips by recency (recent greener,
 * overdue redder), the Affinity chip by frequency (frequent greener, rare
 * redder). The Affinity and Recency chips carry a stronger fill so the two loud
 * per-Option signals read above the Tag chips. The Recency chip always renders;
 * the Affinity chip renders only when `affinity` is supplied (Tonight rows have
 * one; the Option detail page's Recency-only section omits it); Tag chips render
 * only when the Option carries Tags.
 */
export function RowChips({
  affinity,
  recencyDays,
  neverEaten,
  tags,
}: {
  /** The Option's affinity (normalized eat-frequency); omit/`null` to hide the chip. */
  affinity?: number | null;
  recencyDays: number;
  neverEaten: boolean;
  tags: TagRecency[];
}) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {affinity != null && <AffinityChip affinity={affinity} />}
      <RecencyChip days={recencyDays} neverEaten={neverEaten} />
      {tags.map((tag) => (
        <TagChip key={tag.tag} tag={tag} />
      ))}
    </div>
  );
}

/**
 * The Affinity chip — the Option's affinity (its normalized eat-frequency, the
 * preference half of the Score), tinted on the shared heatmap *by frequency*: a
 * frequently-eaten Option reads green, a rarely-eaten one red, ~average (1.0)
 * tan. It sits first in the chip row; its numeral is the affinity value (1.0 =
 * catalog-average). It takes the *fainter* Tag-chip fill rather than the Recency
 * chip's stronger one, so the two heatmap chips are told apart by weight —
 * louder recency, quieter affinity — instead of reading as one smear of color.
 */
function AffinityChip({ affinity }: { affinity: number }) {
  return (
    <span
      className="rounded-badge px-2 py-0.5 text-meta leading-tight text-ink"
      style={{ backgroundColor: affinityChipBg(affinity) }}
    >
      <MonoNumerals text={affinity.toFixed(1)} />
    </span>
  );
}

/** `Nd`, or `60d+` at the `CAP`-day ceiling. */
function recencyLabel(days: number): string {
  return days >= CAP ? `${CAP}d+` : `${days}d`;
}

/**
 * The Recency chip — the Option's per-Option recency: days since it was last
 * eaten (`18d`, or `60d+` at the cap), or `new` when it has never been eaten.
 * A never-eaten Option sits at the `CAP`-day overdue end of the heatmap, so
 * the `new` chip is tinted green like a long-overdue one. The stronger fill
 * (`recencyChipBgStrong`) sets it apart from the fainter Tag chips.
 */
function RecencyChip({
  days,
  neverEaten,
}: {
  days: number;
  neverEaten: boolean;
}) {
  return (
    <span
      className="rounded-badge px-2 py-0.5 text-meta leading-tight text-ink"
      style={{ backgroundColor: recencyChipBgStrong(days) }}
    >
      {neverEaten ? "new" : <MonoNumerals text={recencyLabel(days)} />}
    </span>
  );
}

/**
 * One Tag chip — the Tag name with its per-Tag recency (numerals in Geist
 * Mono), faint-tinted on the recency heatmap. The faint fill keeps a multi-Tag
 * row from reading as a wall of color (see `recencyChipBg`).
 */
function TagChip({ tag }: { tag: TagRecency }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-badge px-2 py-0.5
        text-meta leading-tight text-ink"
      style={{ backgroundColor: recencyChipBg(tag.days) }}
    >
      {tag.tag}
      <span className="font-mono tabular-nums">{recencyLabel(tag.days)}</span>
    </span>
  );
}

/** Renders a string with every run of digits set in Geist Mono (tabular). */
function MonoNumerals({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\d+)/).map((part, index) =>
        /^\d+$/.test(part) ? (
          <span key={index} className="font-mono tabular-nums">
            {part}
          </span>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}
