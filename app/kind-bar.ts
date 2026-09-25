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
 * The much-lighter wash of the same kind hue — the background of a decided
 * "Tonight's dinner" row (DESIGN.md "Two color channels"), a step stronger
 * than the picker rows' `kindTintClass`.
 */
export function kindWashClass(kind: "home" | "restaurant"): string {
  return kind === "home" ? "bg-kind-home-wash" : "bg-kind-restaurant-wash";
}

/**
 * A kind toggle chip's fill (DESIGN.md decisions 2026-09-24): the kind's own
 * hue with `action-ink` text when selected, its faded `-wash` otherwise.
 */
export function kindChipFillClass(
  kind: "home" | "restaurant",
  selected: boolean,
): string {
  if (selected) {
    return kind === "home"
      ? "bg-kind-home text-action-ink"
      : "bg-kind-restaurant text-action-ink";
  }
  return `${kindWashClass(kind)} text-ink`;
}

/**
 * Fainter still than the wash — the picker row's background tint (the wash
 * halved toward `bg`). The ledger carries the kind-coding without the tint
 * competing with the chips' heatmap fills.
 */
export function kindTintClass(kind: "home" | "restaurant"): string {
  return kind === "home" ? "bg-kind-home-tint" : "bg-kind-restaurant-tint";
}
