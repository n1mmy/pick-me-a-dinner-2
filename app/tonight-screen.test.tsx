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

import type { AiSearchResult } from "../lib/ai-search";
import { aiSearchAction } from "./tonight-actions";
import { TonightScreen } from "./tonight-screen";

const mockedAiSearch = vi.mocked(aiSearchAction);

/**
 * A deterministic Tonight row with a distinct Explanation chip. `tags` are the
 * Option's Tags, which drive the Tag filter chips in the filter zone.
 */
function row(
  id: string,
  name: string,
  explanation: string,
  tags: string[] = [],
): TonightRow {
  return {
    option: { id, name, kind: "home", tags },
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

// Rows that carry a Tag, so the filter zone renders the Tag filter chips
// alongside the kind segment.
const TAGGED_ROWS: TonightRow[] = [
  row("o1", "Apple Crumble", "Never eaten yet", ["dessert"]),
  row("o2", "Banana Bread", "Eaten quite recently", ["dessert"]),
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

    render(<TonightScreen rows={ROWS} searchEnabled />);
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

    render(<TonightScreen rows={ROWS} searchEnabled />);
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByText("Light and quick");

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    // Both Explanation chips are back and the AI rationale is gone.
    expect(screen.getByText("Never eaten yet")).toBeTruthy();
    expect(screen.getByText("Eaten quite recently")).toBeTruthy();
    expect(screen.queryByText("Light and quick")).toBeNull();
  });

  it("shows a plain empty-state with a clear control on an empty AI result", async () => {
    mockedAiSearch.mockResolvedValue({ ok: true, results: [] });

    render(<TonightScreen rows={ROWS} searchEnabled />);
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    // The empty result reads as a real answer, not a broken screen.
    expect(await screen.findByText("No Options fit that search.")).toBeTruthy();
    expect(screen.queryByText("Never eaten yet")).toBeNull();

    // The inline clear control returns the screen to the deterministic list.
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByText("Never eaten yet")).toBeTruthy();
    expect(screen.getByText("Eaten quite recently")).toBeTruthy();
    expect(screen.queryByText("No Options fit that search.")).toBeNull();
  });

  it("leaves the deterministic list intact and shows an error on failure", async () => {
    mockedAiSearch.mockResolvedValue({ ok: false });

    render(<TonightScreen rows={ROWS} searchEnabled />);
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

    render(<TonightScreen rows={ROWS} searchEnabled />);
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByText("Search unavailable — try again");

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(screen.queryByText("Search unavailable — try again")).toBeNull();
  });

  it("hides the filter zone while an AI result is shown and restores it on clear", async () => {
    mockedAiSearch.mockResolvedValue({
      ok: true,
      results: [{ id: "o2", reason: "Light and quick" }],
    });

    render(<TonightScreen rows={TAGGED_ROWS} searchEnabled />);

    // The kind segment and Tag filter chips are part of the deterministic view.
    expect(
      screen.queryByRole("group", { name: "Filter by kind" }),
    ).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Filter by tag" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByText("Light and quick");

    // While the AI result is shown the query is the single ranking authority:
    // both the kind segment and the Tag filter chips are gone.
    expect(screen.queryByRole("group", { name: "Filter by kind" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Filter by tag" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    // Clearing restores both the deterministic list and its filter controls.
    expect(screen.getByText("Never eaten yet")).toBeTruthy();
    expect(
      screen.queryByRole("group", { name: "Filter by kind" }),
    ).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Filter by tag" })).toBeTruthy();
  });

  it("disables the search box in flight and keeps the deterministic list visible", async () => {
    // A deferred result lets the test observe the in-flight state.
    let resolveSearch: (result: AiSearchResult) => void = () => {};
    mockedAiSearch.mockReturnValue(
      new Promise<AiSearchResult>((resolve) => {
        resolveSearch = resolve;
      }),
    );

    render(<TonightScreen rows={ROWS} searchEnabled />);
    const input = screen.getByLabelText(
      "Search for dinner by intent",
    ) as HTMLInputElement;
    expect(input.disabled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    // While the search is in flight the box is disabled — so only one search
    // runs at a time — and the deterministic list stays visible underneath.
    await screen.findByRole("button", { name: "Searching…" });
    expect(input.disabled).toBe(true);
    expect(screen.getByText("Never eaten yet")).toBeTruthy();

    // The result arrives, swaps in, and re-enables the box.
    resolveSearch({
      ok: true,
      results: [{ id: "o2", reason: "Light and quick" }],
    });
    await screen.findByText("Light and quick");
    expect(input.disabled).toBe(false);
  });

  it("clears the error when a later search succeeds", async () => {
    mockedAiSearch.mockResolvedValueOnce({ ok: false });
    mockedAiSearch.mockResolvedValueOnce({
      ok: true,
      results: [{ id: "o2", reason: "Light and quick" }],
    });

    render(<TonightScreen rows={ROWS} searchEnabled />);
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByText("Search unavailable — try again");

    // A second, successful search swaps in the AI result and clears the error.
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("Light and quick")).toBeTruthy();
    expect(screen.queryByText("Search unavailable — try again")).toBeNull();
  });

  it("hides the search box when AI search is not enabled", () => {
    // No ANTHROPIC_API_KEY — Tonight is exactly v1: the search box is absent.
    render(<TonightScreen rows={ROWS} searchEnabled={false} />);

    expect(screen.queryByLabelText("Search for dinner by intent")).toBeNull();
    expect(screen.queryByRole("button", { name: "Search" })).toBeNull();

    // The deterministic list and its filter zone remain — v1 is unaffected.
    expect(screen.getByText("Never eaten yet")).toBeTruthy();
    expect(
      screen.queryByRole("group", { name: "Filter by kind" }),
    ).toBeTruthy();
  });
});
