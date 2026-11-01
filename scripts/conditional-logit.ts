/**
 * A conditional logit over the day's candidates: the chance that candidate i
 * is the night's Pick is softmax(w · x_i) over that night's candidates. Fitted
 * by gradient descent with an L2 penalty on standardized features; no
 * dependency. Pure, so `scripts/typesafe-fit.ts` can hold a month out and
 * the test can check it on a made-up case.
 */

/** One night: each candidate's feature vector and which were Picked. */
export type Night = { features: number[][]; picked: boolean[] };

export type Fit = {
  /** One weight per feature, on the standardized scale. */
  weights: number[];
  /** The training features' mean and standard deviation, to standardize new nights. */
  mean: number[];
  sd: number[];
};

/** Column means and standard deviations over every candidate row; a constant column gets sd 1. */
export function moments(nights: Night[]): { mean: number[]; sd: number[] } {
  const rows = nights.flatMap((night) => night.features);
  const k = rows[0]?.length ?? 0;
  const mean = Array.from({ length: k }, (_, j) => rows.reduce((s, r) => s + r[j], 0) / rows.length);
  const sd = Array.from({ length: k }, (_, j) => {
    const v = rows.reduce((s, r) => s + (r[j] - mean[j]) ** 2, 0) / rows.length;
    return v > 0 ? Math.sqrt(v) : 1;
  });
  return { mean, sd };
}

const standardize = (row: number[], mean: number[], sd: number[]) => row.map((x, j) => (x - mean[j]) / sd[j]);

/** Each candidate's softmax probability under `weights`, over one night. */
function softmax(rows: number[][], weights: number[]): number[] {
  const scores = rows.map((row) => row.reduce((s, x, j) => s + x * weights[j], 0));
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max));
  const total = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / total);
}

/**
 * Fit by full-batch gradient descent. The label on a night with several
 * Picks is split evenly across them. `l2` shrinks the weights toward zero,
 * which keeps a rare feature from fitting one night.
 */
export function fitConditionalLogit(
  nights: Night[],
  { l2 = 0.01, steps = 2000, rate = 0.1 }: { l2?: number; steps?: number; rate?: number } = {},
): Fit {
  const { mean, sd } = moments(nights);
  const k = mean.length;
  const data = nights
    .filter((night) => night.picked.some(Boolean))
    .map((night) => {
      const picks = night.picked.filter(Boolean).length;
      return {
        rows: night.features.map((row) => standardize(row, mean, sd)),
        y: night.picked.map((p) => (p ? 1 / picks : 0)),
      };
    });
  const weights = new Array<number>(k).fill(0);
  for (let step = 0; step < steps; step++) {
    const grad = new Array<number>(k).fill(0);
    for (const { rows, y } of data) {
      const p = softmax(rows, weights);
      rows.forEach((row, i) => {
        const d = p[i] - y[i];
        for (let j = 0; j < k; j++) grad[j] += d * row[j];
      });
    }
    for (let j = 0; j < k; j++) {
      weights[j] -= rate * (grad[j] / data.length + l2 * weights[j]);
    }
  }
  return { weights, mean, sd };
}

/** Each candidate's score under the fit, higher first. */
export function scoreNight(fit: Fit, features: number[][]): number[] {
  return features.map((row) => standardize(row, fit.mean, fit.sd).reduce((s, x, j) => s + x * fit.weights[j], 0));
}
