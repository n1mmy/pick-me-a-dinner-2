import Link from "next/link";
import type { TonightRow } from "../lib/ranking";
import { TonightRowItem } from "./tonight-row";

/**
 * The Tonight screen (plan §9, §16) — the home screen. It renders the active
 * Catalog ranked by Score as a **flat, uniform list**: no lead-option
 * prominence, no collapsed long tail. Surfacing every Option is the point — the
 * app supplies the ranking, the human scans the whole list and decides. Each
 * row carries the `pick = log` write actions (§6) in `tonight-row.tsx`.
 */
export function TonightScreen({
  rows,
  today,
}: {
  rows: TonightRow[];
  today: string;
}) {
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
            <TonightRowItem key={row.option.id} row={row} today={today} />
          ))}
        </ol>
      )}
    </main>
  );
}
