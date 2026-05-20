"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CAP } from "../lib/ranking.config";
import type { TagRecency, TonightRow } from "../lib/ranking";
import { recencyChipBg, recencyChipBgStrong } from "../lib/recency-color";
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
  selectedDay,
  onRejected,
}: {
  row: TonightRow;
  rank: number;
  aiReason?: string;
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
    <li className={`border-b border-line py-3 ${kindBarClass(option.kind)}`}>
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
            recencyDays={row.recencyDays}
            neverEaten={row.neverEaten}
            tags={row.tags}
          />
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
 * The chip row directly under an Option name on a Tonight or decided row: the
 * Recency chip first — the Option's own per-Option recency — then one Tag chip
 * per Tag. Every chip is tinted on the red→green recency heatmap by its own
 * recency (overdue greener, recently used redder). The Recency chip carries a
 * stronger fill so the single per-Option signal reads louder than the Tag
 * chips beside it. The Recency chip always renders; Tag chips render only when
 * the Option carries Tags.
 */
export function RowChips({
  recencyDays,
  neverEaten,
  tags,
}: {
  recencyDays: number;
  neverEaten: boolean;
  tags: TagRecency[];
}) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      <RecencyChip days={recencyDays} neverEaten={neverEaten} />
      {tags.map((tag) => (
        <TagChip key={tag.tag} tag={tag} />
      ))}
    </div>
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
