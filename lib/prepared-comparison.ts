/** One decided-day comparison line: where the frozen note ranked an eaten Option. */
export type ComparisonLine = {
  name: string;
  /** The Option's 1-based place in the note's ranking, or null when unranked. */
  rank: number | null;
};

/**
 * The decided-day comparison (ADR-0011): for each Option a date's Log entries
 * point at, in Log order, where that date's frozen **Prepared ranking** put it
 * — "The note ranked Katsu curry #4", or "The note didn't rank Katsu curry".
 *
 * The rank is read from the ranking as stored, not as Tonight shows it: the
 * shown list drops Options since Picked, which is exactly what is being looked
 * up here.
 */
export function noteComparison(
  ranking: { id: string }[],
  eaten: { id: string; name: string }[],
): ComparisonLine[] {
  return eaten.map(({ id, name }) => {
    const index = ranking.findIndex((row) => row.id === id);
    return { name, rank: index === -1 ? null : index + 1 };
  });
}
