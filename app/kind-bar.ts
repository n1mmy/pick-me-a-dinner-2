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
