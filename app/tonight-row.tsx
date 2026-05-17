"use client";

import { useState, useTransition } from "react";
import { CAP } from "../lib/ranking.config";
import type { TagRecency, TonightRow } from "../lib/ranking";
import { recencyChipBg, recencyChipBgStrong } from "../lib/recency-color";
import { pickTonight } from "./log/actions";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-action";

/**
 * The 3px meal-kind bar on a Tonight/decided row's left edge (DESIGN.md "Two
 * color channels") — teal for a home-cooked Option, plum for a restaurant.
 * Pair with `pl-2` so the row content clears the bar.
 */
export function kindBarClass(kind: "home" | "restaurant"): string {
  return kind === "home"
    ? "border-l-[3px] border-l-kind-home pl-2"
    : "border-l-[3px] border-l-kind-restaurant pl-2";
}

/**
 * One Tonight row of the flat ledger (DESIGN.md "Tonight row anatomy"). The
 * name sits above a chip row — the Recency chip then the Tag chips — and the
 * PICK action sits beside it (its own line on mobile, the row's end on desktop
 * via `desktop:contents` on the action wrapper). "Pick tonight" is the one-tap
 * `pick = log` path; the picked button briefly marks "Logged ✓". To log a
 * dinner for any other date, use the Log screen.
 *
 * On an AI search result row, `aiReason` is the AI rationale — a prose "why"
 * line the deterministic list does not have; it sits in the action row beside
 * PICK on a neutral `raised` surface. The Recency and Tag chips render the
 * same on AI and deterministic rows.
 */
export function TonightRowItem({
  row,
  rank,
  aiReason,
}: {
  row: TonightRow;
  rank: number;
  aiReason?: string;
}) {
  const { option } = row;
  const [justLogged, setJustLogged] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function pick() {
    setPickError(null);
    startTransition(async () => {
      const result = await pickTonight(option.id);
      if (!result.ok) {
        // Never flash a false "Logged ✓" — show the failure on the row instead.
        setPickError(result.error);
        return;
      }
      // Hold "Logged ✓" briefly; the revalidation re-sorts the list under it.
      setJustLogged(true);
      window.setTimeout(() => setJustLogged(false), 1600);
    });
  }

  return (
    <li className={`border-b border-line py-3 ${kindBarClass(option.kind)}`}>
      <div
        className="flex flex-col gap-2 desktop:flex-row desktop:items-center
          desktop:gap-3"
      >
        <div className="desktop:min-w-0 desktop:flex-1">
          <div className="flex items-baseline gap-2">
            <span className="w-6 shrink-0 text-right font-mono text-meta tabular-nums text-muted">
              {rank}
            </span>
            <span className="font-display text-name font-name text-ink">
              {option.name}
            </span>
          </div>
          <RowChips
            recencyDays={row.recencyDays}
            neverEaten={row.neverEaten}
            tags={row.tags}
          />
        </div>
        <div className="flex items-center gap-2 desktop:contents">
          {aiReason && (
            <span className="self-start rounded-badge bg-raised px-2 py-1 text-chip text-muted">
              <MonoNumerals text={aiReason} />
            </span>
          )}
          <button
            type="button"
            onClick={pick}
            disabled={pending}
            aria-live="polite"
            className={`min-h-11 rounded-control px-4 text-body font-emphasis
              transition-colors duration-short disabled:opacity-60
              desktop:ml-auto ${focusRing} ${
                justLogged
                  ? "bg-raised text-success"
                  : "bg-action text-action-ink hover:bg-action-hover"
              }`}
          >
            {justLogged ? "Logged ✓" : "Pick tonight"}
          </button>
        </div>
      </div>
      {pickError && (
        <p className="mt-2 text-chip text-danger" aria-live="polite">
          {pickError}
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
