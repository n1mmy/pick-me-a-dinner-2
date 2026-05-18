import { describe, expect, it } from "vitest";
import { pgErrorCode, pgErrorMessage } from "./pg-error";

/** A stand-in for a Postgres driver error carrying a SQLSTATE `code`. */
function pgError(code: string): { code: string } {
  return { code };
}

describe("pgErrorCode", () => {
  it("reads the SQLSTATE code off a driver error", () => {
    expect(pgErrorCode(pgError("23505"))).toBe("23505");
  });

  it("is undefined for a non-Postgres error", () => {
    expect(pgErrorCode(new Error("boom"))).toBeUndefined();
    expect(pgErrorCode(null)).toBeUndefined();
    expect(pgErrorCode("23505")).toBeUndefined();
  });
});

describe("pgErrorMessage", () => {
  it("maps a 23505 unique violation to the duplicate message", () => {
    expect(
      pgErrorMessage(pgError("23505"), {
        duplicate: "Already logged for that date",
      }),
    ).toEqual({ ok: false, error: "Already logged for that date" });
  });

  it("maps a 22P02 invalid-uuid to the missingOption message", () => {
    expect(
      pgErrorMessage(pgError("22P02"), {
        missingOption: "That option is no longer available",
      }),
    ).toEqual({ ok: false, error: "That option is no longer available" });
  });

  it("maps a 23503 foreign-key violation to the missingOption message", () => {
    expect(
      pgErrorMessage(pgError("23503"), {
        missingOption: "That option is no longer available",
      }),
    ).toEqual({ ok: false, error: "That option is no longer available" });
  });

  it("maps a 23503 to the restricted message when supplied", () => {
    expect(
      pgErrorMessage(pgError("23503"), {
        restricted: "In your log — archive instead",
      }),
    ).toEqual({ ok: false, error: "In your log — archive instead" });
  });

  it("lets restricted win over missingOption for a 23503", () => {
    expect(
      pgErrorMessage(pgError("23503"), {
        restricted: "In your log — archive instead",
        missingOption: "That option is no longer available",
      }),
    ).toEqual({ ok: false, error: "In your log — archive instead" });
  });

  it("re-throws a listed-concept-but-unmatched code (23505 with no duplicate key)", () => {
    expect(() =>
      pgErrorMessage(pgError("23505"), {
        missingOption: "That option is no longer available",
      }),
    ).toThrow();
  });

  it("re-throws an unlisted SQLSTATE code unchanged", () => {
    const error = pgError("40001");
    let thrown: unknown;
    try {
      pgErrorMessage(error, { duplicate: "Already logged for that date" });
    } catch (caught) {
      thrown = caught;
    }
    expect(thrown).toBe(error);
  });

  it("re-throws a non-Postgres error untouched", () => {
    const error = new Error("boom");
    expect(() =>
      pgErrorMessage(error, {
        duplicate: "Already logged for that date",
        missingOption: "That option is no longer available",
        restricted: "In your log — archive instead",
      }),
    ).toThrow(error);
  });
});
