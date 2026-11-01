import { describe, expect, it } from "vitest";
import {
  countMatchesFacts,
  countsInLine,
  flagRow,
  leaksSnapshot,
  NO,
  type RowAnswers,
  YES,
} from "./typesafe-judge";

const sound: RowAnswers = {
  statesTiming: 0.9,
  timingMatches: 0.9,
  statesStretch: 0.9,
  stretchMatches: 0.9,
  contradicts: 0.1,
  snapshotTerms: 0.1,
  stance: { for_tonight: 0.8, against_tonight: 0.1, neither: 0.1 },
};

describe("flagRow", () => {
  it("raises nothing for a sound line in a top row", () => {
    expect(flagRow(1, sound)).toEqual({ flags: [], unsettled: [] });
  });

  it("flags a wrong count only when the line gives one", () => {
    expect(flagRow(3, { ...sound, timingMatches: 0.1 }).flags).toEqual(["wrong timing"]);
    expect(flagRow(3, { ...sound, statesTiming: 0.1, timingMatches: 0.1 }).flags).toEqual([]);
  });

  it("flags a wrong stretch only when the line gives one", () => {
    expect(flagRow(3, { ...sound, stretchMatches: 0.1 }).flags).toEqual(["wrong stretch"]);
    expect(flagRow(3, { ...sound, statesStretch: 0.1, stretchMatches: 0.1 }).flags).toEqual([]);
  });

  it("flags a contradiction and the snapshot's words", () => {
    expect(flagRow(3, { ...sound, contradicts: 0.8, snapshotTerms: 0.8 }).flags).toEqual([
      "contradicts the facts",
      "snapshot's words",
    ]);
  });

  it("reads the Day note judgment only when there is one", () => {
    expect(flagRow(3, sound).flags).toEqual([]);
    expect(flagRow(3, { ...sound, dayNoteConflict: 0.9 }).flags).toEqual(["against the Day note"]);
  });

  it("reads the stance against the rank", () => {
    const against = { for_tonight: 0.1, against_tonight: 0.8, neither: 0.1 };
    expect(flagRow(2, { ...sound, stance: against }).flags).toEqual(["top row argues against"]);
    expect(flagRow(9, { ...sound, stance: against }).flags).toEqual([]);
    expect(flagRow(12, { ...sound, stance: against }).flags).toEqual([]);
    expect(flagRow(12, sound).flags).toEqual(["tail row argues for"]);
    expect(flagRow(9, sound).flags).toEqual([]);
  });

  it("reports a judgment between the thresholds as unsettled, not as a flag", () => {
    const between = (YES + NO) / 2;
    const judged = flagRow(3, {
      ...sound,
      timingMatches: between,
      stretchMatches: between,
      contradicts: between,
      snapshotTerms: between,
      dayNoteConflict: between,
    });
    expect(judged.flags).toEqual([]);
    expect(judged.unsettled).toEqual(["timing", "stretch", "contradicts", "words", "Day note"]);
    expect(flagRow(3, { ...sound, statesTiming: between }).unsettled).toEqual(["states timing"]);
  });
});

describe("countsInLine", () => {
  it("reads days, weeks loosely, and the time words", () => {
    expect(countsInLine("Fifteen days since the last katsu, inside their usual two weeks.")).toEqual([
      15, 13, 14, 15,
    ]);
    expect(countsInLine("Had it yesterday.")).toEqual([1]);
    expect(countsInLine("About a fortnight on, the stretch they leave it.")).toEqual([13, 14, 15]);
    expect(countsInLine("4 days ago, sooner than they repeat sushi")).toEqual([4]);
    expect(countsInLine("Thirty-one days is well under the ninety-one they last left it.")).toEqual([31]);
    expect(countsInLine("One hundred twenty days is long by its own history.")).toEqual([120]);
    expect(countsInLine("Two hundred sixteen days and the distance.")).toEqual([216]);
    expect(countsInLine("One hundred and ninety-one days and a note from the past.")).toEqual([191]);
  });

  it("gives nothing for a line with no count", () => {
    expect(countsInLine("Light and fast, and the soup was the good call last time.")).toEqual([]);
  });
});

describe("countMatchesFacts", () => {
  it("is null with no count, and allows a day either way", () => {
    expect(countMatchesFacts([], [15])).toBeNull();
    expect(countMatchesFacts([15], [15, 4])).toBe(true);
    expect(countMatchesFacts([14], [15])).toBe(true);
    expect(countMatchesFacts([20], [15, 4])).toBe(false);
  });
});

describe("leaksSnapshot", () => {
  it("catches the compare script's leaks and passes plain words", () => {
    expect(leaksSnapshot("gaps of 21, 14, 6 days")).toBe(true);
    expect(leaksSnapshot("last had on 2026-10-02")).toBe(true);
    expect(leaksSnapshot("its daysSinceLast is long")).toBe(true);
    expect(leaksSnapshot("Option AB is due")).toBe(true);
    expect(leaksSnapshot("Two weeks on and the katsu was the good call last time.")).toBe(false);
  });
});
