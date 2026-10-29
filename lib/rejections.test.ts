import { describe, expect, it } from "vitest";
import { partitionRejections, type RejectionRow } from "./rejections";
import { optionCode } from "./snapshot";

const TODAY = "2026-05-20"; // a Wednesday

/**
 * Build a Rejection row. `optionId` doubles as the Option name so a partition
 * assertion can read off ids; `rejectedOn`, `reason`, and `tags` are the parts
 * each test actually drives.
 */
function rejection(
  optionId: string,
  rejectedOn: string,
  reason: string | null = null,
  tags: string[] = [],
): RejectionRow {
  return { optionId, reason, rejectedOn, optionName: optionId, kind: "home", tags };
}

/**
 * Call `partitionRejections`, coding the Options A.. in first-seen order —
 * the Option-code map the real `buildSnapshot` derives. Tests assert on the
 * Option name (which carries the string id), so the exact codes do not
 * matter here, only that every row resolves to one.
 */
function partition(rows: RejectionRow[], today: string) {
  const distinct = [...new Set(rows.map((r) => r.optionId))];
  const codeByOptionId = new Map(distinct.map((id, i) => [id, optionCode(i)]));
  return partitionRejections(rows, today, codeByOptionId);
}

/** Read the string id back off each snapshot row's Option name. */
const ids = (rows: { name: string }[]) =>
  rows.map((r) => r.name);

describe("partitionRejections — partition", () => {
  it("puts a Rejection dated today in rejected-tonight", () => {
    const { block } = partition([rejection("a", TODAY)], TODAY);
    expect(ids(block.rejectedTonight)).toEqual(["a"]);
    expect(block.notTodayRejections).toEqual([]);
  });

  it("puts a Rejection dated before today in not-today", () => {
    const { block } = partition([rejection("a", "2026-05-19")], TODAY);
    expect(ids(block.notTodayRejections)).toEqual(["a"]);
    expect(block.rejectedTonight).toEqual([]);
  });

  it("puts a future-dated Planned rejection in not-today, with its real date", () => {
    // A Rejection dated after today is not "tonight" — it lands in the
    // date-neutral not-today group, carrying its own future date (ADR-0008).
    const { block } = partition(
      [rejection("a", "2026-05-24")], // a Sunday, after today
      TODAY,
    );
    expect(ids(block.notTodayRejections)).toEqual(["a"]);
    expect(block.rejectedTonight).toEqual([]);
    expect(block.notTodayRejections[0].date).toBe("2026-05-24 (Sunday)");
  });

  it("splits a mixed history — past, today, and future — on the today boundary", () => {
    // Only the exact-today row is "tonight"; past and future rows alike land
    // in not-today, ordered newest first.
    const { block } = partition(
      [
        rejection("future", "2026-05-30"),
        rejection("today", TODAY),
        rejection("yesterday", "2026-05-19"),
        rejection("old", "2026-01-02"),
      ],
      TODAY,
    );
    expect(ids(block.rejectedTonight)).toEqual(["today"]);
    expect(ids(block.notTodayRejections)).toEqual([
      "future",
      "yesterday",
      "old",
    ]);
  });

  it("produces two empty groups for an empty history", () => {
    const { block } = partition([], TODAY);
    expect(block.rejectedTonight).toEqual([]);
    expect(block.notTodayRejections).toEqual([]);
  });
});

describe("partitionRejections — suppression set", () => {
  it("is exactly the Option ids rejected on the anchor day", () => {
    const { suppressedForAsOf } = partition(
      [rejection("a", TODAY), rejection("b", TODAY)],
      TODAY,
    );
    expect([...suppressedForAsOf].sort()).toEqual(["a", "b"]);
  });

  it("carries nothing from earlier days", () => {
    const { suppressedForAsOf } = partition(
      [rejection("today", TODAY), rejection("earlier", "2026-05-19")],
      TODAY,
    );
    expect([...suppressedForAsOf]).toEqual(["today"]);
  });

  it("is empty when nothing was rejected today", () => {
    const { suppressedForAsOf } = partition(
      [rejection("earlier", "2026-05-19")],
      TODAY,
    );
    expect(suppressedForAsOf.size).toBe(0);
  });

  it("excludes a future-dated Planned rejection — it does not suppress today", () => {
    // A Planned rejection only suppresses its Option when its date becomes
    // the anchor day; until then the Option stays a candidate (ADR-0008).
    const { suppressedForAsOf } = partition(
      [rejection("planned", "2026-05-24")],
      TODAY,
    );
    expect(suppressedForAsOf.size).toBe(0);
  });

  it(
    "rotates with the anchor day — a Rejection dated on a future Selected " +
      "day suppresses its Option from that day's candidate set",
    () => {
      // The same Rejection that was "not-today" against today flips to
      // "rejected for the anchor day" when the anchor is its own date
      // (ADR-0009). The Rejection row is unchanged — only the anchor moved.
      const SELECTED = "2026-05-24";
      const { suppressedForAsOf, block } = partition(
        [rejection("planned", SELECTED), rejection("other", TODAY)],
        SELECTED,
      );
      expect([...suppressedForAsOf]).toEqual(["planned"]);
      // The Rejection dated today is now "not-anchor-day" — its Option stays
      // a candidate for the Selected day.
      expect(ids(block.rejectedTonight)).toEqual(["planned"]);
      expect(ids(block.notTodayRejections)).toEqual(["other"]);
    },
  );
});

describe("partitionRejections — snapshot block shape", () => {
  it("carries a reason as the Household typed it", () => {
    const { block } = partition(
      [rejection("a", TODAY, "too spicy for the kids")],
      TODAY,
    );
    expect(block.rejectedTonight[0].reason).toBe("too spicy for the kids");
  });

  it("carries a null reason as null, not an empty string", () => {
    const { block } = partition([rejection("a", TODAY)], TODAY);
    expect(block.rejectedTonight[0].reason).toBeNull();
  });

  it("carries the Option name and each Tag as typed", () => {
    const { block } = partition(
      [rejection("sushi", TODAY, null, ["fish", "japanese"])],
      TODAY,
    );
    const entry = block.rejectedTonight[0];
    expect(entry.name).toBe("sushi");
    expect(entry.tags).toEqual(["fish", "japanese"]);
  });

  it("formats each Rejection's date with its weekday", () => {
    const { block } = partition(
      [rejection("a", TODAY), rejection("b", "2026-05-15")],
      TODAY,
    );
    expect(block.rejectedTonight[0].date).toBe("2026-05-20 (Wednesday)");
    expect(block.notTodayRejections[0].date).toBe("2026-05-15 (Friday)");
  });

  it("orders each group newest first", () => {
    const { block } = partition(
      [
        rejection("mid", "2026-05-15"),
        rejection("newest", "2026-05-18"),
        rejection("oldest", "2026-05-10"),
      ],
      TODAY,
    );
    expect(ids(block.notTodayRejections)).toEqual(["newest", "mid", "oldest"]);
  });

  it("carries the Option code through so it ties to a candidate", () => {
    // `partition` codes the single Option A — the Option code the model sees
    // in place of the UUID.
    const { block } = partition([rejection("a", "2026-05-19")], TODAY);
    expect(block.notTodayRejections[0].optionId).toBe("A");
    expect(block.notTodayRejections[0].kind).toBe("home");
  });
});
