"use client";

import { useState, useTransition } from "react";
import { CAP } from "../lib/ranking.config";
import type { TagRecency, TonightRow } from "../lib/ranking";
import { pickTonight } from "./log/actions";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-accent";

/**
 * One Tonight row of the flat ledger (DESIGN.md "Tonight row anatomy"). Mobile
 * is two lines — rank + name + tags, then the Explanation chip + PICK; desktop
 * collapses to one dense line via `desktop:contents` on the chip/action
 * wrapper. "Pick tonight" is the one-tap `pick = log` path; the picked button
 * briefly marks "Logged ✓". To log a dinner for any other date, use the Log
 * screen.
 *
 * On an AI search result row, `aiReason` is the AI rationale and takes the
 * place of the deterministic Explanation chip — one row never shows two
 * competing "why" lines.
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
    <li className="border-b border-line py-3">
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
            <KindBadge kind={option.kind} />
          </div>
          {row.tags.length > 0 && <RowTags tags={row.tags} />}
        </div>
        <div className="flex items-center gap-2 desktop:contents">
          <span
            className="self-start rounded-badge bg-raised px-2 py-1 text-chip
              text-muted"
          >
            <MonoNumerals text={aiReason ?? row.explanation} />
          </span>
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
                  : "bg-accent text-accent-ink hover:bg-accent-dark"
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

/** The quiet Home / Restaurant kind marker. */
export function KindBadge({ kind }: { kind: "home" | "restaurant" }) {
  const isHome = kind === "home";
  return (
    <span
      className={`shrink-0 rounded-badge bg-raised px-1.5 py-0.5 text-meta
        uppercase tracking-wide ${isHome ? "text-home" : "text-rest"}`}
    >
      {isHome ? "Home" : "Restaurant"}
    </span>
  );
}

/**
 * The Option's tags directly under the name, each rendered as a bordered chip
 * matching the Tonight tag-filter chips. Each carries its per-Tag recency
 * (`Nd`, capped `60d+`) with the numerals in Geist Mono; an Overdue Tag is
 * drawn in the accent color.
 */
export function RowTags({ tags }: { tags: TagRecency[] }) {
  return (
    <ul className="mt-1 flex flex-wrap gap-1">
      {tags.map((tag) => {
        const recency = tag.days >= CAP ? `${CAP}d+` : `${tag.days}d`;
        return (
          <li
            key={tag.tag}
            className={`inline-flex items-center gap-1 rounded-badge border
              border-line bg-surface px-2 py-0.5 text-meta leading-tight ${
                tag.overdue ? "text-accent" : "text-muted"
              }`}
          >
            {tag.tag}
            <span className="font-mono tabular-nums">{recency}</span>
          </li>
        );
      })}
    </ul>
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
