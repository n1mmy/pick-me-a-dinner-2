import Link from "next/link";
import { CAP } from "../lib/ranking.config";
import type { TagRecency, TonightRow } from "../lib/ranking";

/**
 * The Tonight screen (plan §9, §16) — the home screen. It renders the active
 * Catalog ranked by Score as a **flat, uniform list**: no lead-option
 * prominence, no collapsed long tail. Surfacing every Option is the point — the
 * app supplies the ranking, the human scans the whole list and decides. This
 * screen is read-only; the "Pick tonight" write path is a later issue.
 */
export function TonightScreen({ rows }: { rows: TonightRow[] }) {
  return (
    <main className="column flex min-h-screen flex-col gap-5.5 py-5.5">
      <h1 className="text-h1 font-h1 text-ink">Tonight</h1>
      {rows.length === 0 ? (
        <p className="text-body text-muted">
          Your Catalog is empty.{" "}
          <Link
            href="/catalog"
            className="font-emphasis text-accent focus-visible:outline
              focus-visible:outline-2 focus-visible:outline-offset-2
              focus-visible:outline-accent"
          >
            Add your first meals →
          </Link>
        </p>
      ) : (
        <ol className="flex flex-col">
          {rows.map((row) => (
            <TonightRowItem key={row.option.id} row={row} />
          ))}
        </ol>
      )}
    </main>
  );
}

/**
 * One Tonight row. Hierarchy per §9: name → Explanation chip → tag chips. The
 * Home/Restaurant badge is deliberately quiet — it identifies the kind without
 * competing with the name.
 */
function TonightRowItem({ row }: { row: TonightRow }) {
  const { option } = row;
  return (
    <li className="flex flex-col gap-1.5 border-b border-line py-3">
      <div className="flex items-center gap-2">
        <span className="text-name text-ink">{option.name}</span>
        <KindBadge kind={option.kind} />
      </div>
      <span
        className="self-start rounded-full bg-chip px-3 py-1.5 text-chip
          text-muted"
      >
        {row.explanation}
      </span>
      {row.tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {row.tags.map((tag) => (
            <TagChip key={tag.tag} tag={tag} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** The quiet Home / Restaurant badge. */
function KindBadge({ kind }: { kind: "home" | "restaurant" }) {
  const isHome = kind === "home";
  return (
    <span
      className={`rounded-badge bg-chip px-1.5 py-0.5 text-meta uppercase
        tracking-wide ${isHome ? "text-home" : "text-rest"}`}
    >
      {isHome ? "Home" : "Restaurant"}
    </span>
  );
}

/**
 * A tag chip with its per-Tag recency. Recency reads as `Nd`, capped at `60d+`;
 * an Overdue Tag renders in the accent color.
 */
function TagChip({ tag }: { tag: TagRecency }) {
  const recency = tag.days >= CAP ? `${CAP}d+` : `${tag.days}d`;
  return (
    <li
      className={`rounded-full bg-chip px-2 py-1 text-chip ${
        tag.overdue ? "font-emphasis text-accent" : "text-muted"
      }`}
    >
      {tag.tag} {recency}
    </li>
  );
}
