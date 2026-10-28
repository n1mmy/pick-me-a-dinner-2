import { describe, expect, it } from "vitest";
import { REQUEST_TIMEOUT_MS } from "./prepared-note";
import { CLAIM_LEASE_MS } from "./prepared-notes";

describe("the claim lease", () => {
  it("outlasts the client's timeout, so a replica still generating never loses its date", () => {
    expect(CLAIM_LEASE_MS).toBeGreaterThan(REQUEST_TIMEOUT_MS);
  });
});
