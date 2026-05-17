// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { TonightRow } from "../lib/ranking";

// `aiSearchAction` is the AI search server action; the screen test drives the
// component with it mocked (PRD: AI search — "with aiSearchAction mocked").
vi.mock("./tonight-actions", () => ({
  aiSearchAction: vi.fn(),
}));
// `tonight-row` calls `pickTonight`; stub it so importing the row never pulls
// in the database client.
vi.mock("./log/actions", () => ({
  pickTonight: vi.fn(async () => ({ ok: true })),
}));

import { aiSearchAction } from "./tonight-actions";
import { TonightScreen } from "./tonight-screen";

const mockedAiSearch = vi.mocked(aiSearchAction);

/** A deterministic Tonight row with a distinct Explanation chip. */
function row(id: string, name: string, explanation: string): TonightRow {
  return {
    option: { id, name, kind: "home", tags: [] },
    score: 10,
    explanation,
    tags: [],
  };
}

// Digit-free Explanation chips: `MonoNumerals` in `tonight-row` splits any run
// of digits into its own span, which would break a whole-string text match.
const ROWS: TonightRow[] = [
  row("o1", "Apple Crumble", "Never eaten yet"),
  row("o2", "Banana Bread", "Eaten quite recently"),
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TonightScreen — AI search", () => {
  it("swaps the deterministic list for the AI result on submit", async () => {
    mockedAiSearch.mockResolvedValue({
      ok: true,
      results: [{ id: "o2", reason: "Light and quick" }],
    });

    render(<TonightScreen rows={ROWS} />);
    // The deterministic list shows its Explanation chips.
    expect(screen.getByText("Never eaten yet")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Search for dinner by intent"), {
      target: { value: "something light" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    // The AI rationale appears in place of the Explanation chip.
    expect(await screen.findByText("Light and quick")).toBeTruthy();
    expect(screen.queryByText("Never eaten yet")).toBeNull();
    expect(mockedAiSearch).toHaveBeenCalledWith("something light");
  });

  it("restores the deterministic list when the search is cleared", async () => {
    mockedAiSearch.mockResolvedValue({
      ok: true,
      results: [{ id: "o2", reason: "Light and quick" }],
    });

    render(<TonightScreen rows={ROWS} />);
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByText("Light and quick");

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    // Both Explanation chips are back and the AI rationale is gone.
    expect(screen.getByText("Never eaten yet")).toBeTruthy();
    expect(screen.getByText("Eaten quite recently")).toBeTruthy();
    expect(screen.queryByText("Light and quick")).toBeNull();
  });

  it("leaves the deterministic list intact and shows an error on failure", async () => {
    mockedAiSearch.mockResolvedValue({ ok: false });

    render(<TonightScreen rows={ROWS} />);
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    // The persistent inline error appears; the deterministic list is untouched.
    expect(
      await screen.findByText("Search unavailable — try again"),
    ).toBeTruthy();
    expect(screen.getByText("Never eaten yet")).toBeTruthy();
    expect(screen.getByText("Eaten quite recently")).toBeTruthy();
  });

  it("clears the error when the query is cleared", async () => {
    mockedAiSearch.mockResolvedValue({ ok: false });

    render(<TonightScreen rows={ROWS} />);
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByText("Search unavailable — try again");

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(screen.queryByText("Search unavailable — try again")).toBeNull();
  });

  it("clears the error when a later search succeeds", async () => {
    mockedAiSearch.mockResolvedValueOnce({ ok: false });
    mockedAiSearch.mockResolvedValueOnce({
      ok: true,
      results: [{ id: "o2", reason: "Light and quick" }],
    });

    render(<TonightScreen rows={ROWS} />);
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByText("Search unavailable — try again");

    // A second, successful search swaps in the AI result and clears the error.
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("Light and quick")).toBeTruthy();
    expect(screen.queryByText("Search unavailable — try again")).toBeNull();
  });
});
