import { describe, expect, it } from "vitest";
import { fitConditionalLogit, moments, scoreNight, type Night } from "./conditional-logit";

/** Nights where the Pick is always the candidate with the highest first feature; the second is noise. */
function nights(count: number): Night[] {
  let seed = 7;
  const random = () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
  return Array.from({ length: count }, () => {
    const features = Array.from({ length: 6 }, () => [random(), random()]);
    const best = features.reduce((b, row, i) => (row[0] > features[b][0] ? i : b), 0);
    return { features, picked: features.map((_, i) => i === best) };
  });
}

describe("fitConditionalLogit", () => {
  it("weights the feature that decides the Pick and not the noise", () => {
    const fit = fitConditionalLogit(nights(60));
    expect(fit.weights[0]).toBeGreaterThan(1);
    expect(Math.abs(fit.weights[1])).toBeLessThan(fit.weights[0] / 4);
  });

  it("ranks a held-out night by the fitted weights", () => {
    const fit = fitConditionalLogit(nights(60));
    const [night] = nights(1).slice(-1);
    const scores = scoreNight(fit, night.features);
    const top = scores.indexOf(Math.max(...scores));
    expect(night.picked[top]).toBe(true);
  });

  it("gives a constant column a standard deviation of 1", () => {
    const { sd } = moments([{ features: [[1, 2], [1, 3]], picked: [true, false] }]);
    expect(sd[0]).toBe(1);
    expect(sd[1]).toBeCloseTo(0.5);
  });

  it("splits the label across several Picks and ignores a night with none", () => {
    const fit = fitConditionalLogit([
      { features: [[1], [0], [0]], picked: [true, false, false] },
      { features: [[1], [1], [0]], picked: [true, true, false] },
      { features: [[0], [1], [0]], picked: [false, false, false] },
    ]);
    expect(fit.weights[0]).toBeGreaterThan(0);
  });
});
