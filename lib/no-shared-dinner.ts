/**
 * **No Shared Dinner** (`CONTEXT.md`) — the Option the Household Picks for a
 * night nobody ate together: out at an event, or an otherwise abnormal
 * schedule. It is logged like any Option, so the night reads as decided, but
 * it is not a dinner to recommend: Tonight lists it last whatever its Score,
 * and the AI snapshot leaves it out of the candidates so no model ranks it.
 * Its Log entries stay in the snapshot's history, where the night still
 * tells the model something.
 *
 * It is known by name, case and surrounding space aside — it is one Option in
 * one Catalog, so a schema flag would be machinery for a single row.
 */
const NAME = "no shared dinner";

/** Whether an Option named `name` is the No Shared Dinner Option. */
export function isNoSharedDinner(name: string): boolean {
  return name.trim().toLowerCase() === NAME;
}
