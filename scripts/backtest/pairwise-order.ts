/**
 * An order out of pairwise answers: Bradley–Terry strengths fitted by the
 * minorization–maximization iteration, where each pair's probability is read
 * as a fractional win for each side. Pure, for `scripts/backtest/typesafe-stage2.ts`
 * and its test.
 */

/** One answered pair: `p` is the chance `a` is chosen over `b`. */
export type Pair = { a: string; b: string; p: number };

/**
 * Each item's strength, normalized to sum to 1; higher first. An item that
 * never appears in a pair is left out. Fifty iterations settle the typical
 * eight-item tournament to four decimals.
 */
export function bradleyTerry(pairs: Pair[], iterations = 50): Map<string, number> {
  const items = [...new Set(pairs.flatMap((pair) => [pair.a, pair.b]))];
  const strength = new Map(items.map((item) => [item, 1 / items.length]));
  for (let it = 0; it < iterations; it++) {
    const next = new Map<string, number>();
    for (const item of items) {
      let wins = 0;
      let denominator = 0;
      for (const pair of pairs) {
        if (pair.a !== item && pair.b !== item) continue;
        const other = pair.a === item ? pair.b : pair.a;
        wins += pair.a === item ? pair.p : 1 - pair.p;
        denominator += 1 / (strength.get(item)! + strength.get(other)!);
      }
      next.set(item, denominator > 0 ? wins / denominator : strength.get(item)!);
    }
    const total = [...next.values()].reduce((a, b) => a + b, 0);
    for (const item of items) strength.set(item, next.get(item)! / total);
  }
  return strength;
}
