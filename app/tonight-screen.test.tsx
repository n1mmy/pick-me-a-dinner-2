// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { TonightRow } from "../lib/ranking";
import type { TonightsDinnerEntry } from "../lib/tonights-dinner";

// `aiSearchAction` is the AI search server action; the screen test drives the
// component with it mocked (PRD: AI search — "with aiSearchAction mocked").
vi.mock("./tonight-actions", () => ({
  aiSearchAction: vi.fn(),
}));
// `tonight-row` calls `pickTonight` and the decided block calls
// `deleteLogEntry`; stub both so importing them never pulls in the database
// client, and so the Remove flow can be asserted on the mock.
vi.mock("./log/actions", () => ({
  pickTonight: vi.fn(async () => ({ ok: true })),
  deleteLogEntry: vi.fn(async () => {}),
}));

import type { AiSearchResult } from "../lib/ai-search";
import { aiSearchAction } from "./tonight-actions";
import { deleteLogEntry } from "./log/actions";
import { TonightScreen } from "./tonight-screen";

const mockedAiSearch = vi.mocked(aiSearchAction);
const mockedDelete = vi.mocked(deleteLogEntry);

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
    option: { id, name, kind: "home", tags, url: null, phone: null },
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

// Two Picked Options — a non-empty `tonightsDinner` puts Tonight in decided
// mode and renders the "Tonight's dinner" block. `entryId` is the today Log
// entry id the row's "Remove" deletes.
const DINNER: TonightsDinnerEntry[] = [
  { entryId: "e1", row: row("o1", "Apple Crumble", "Never eaten yet") },
  { entryId: "e2", row: row("o2", "Banana Bread", "Eaten quite recently") },
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

    render(<TonightScreen tonightsDinner={[]} pickerRows={ROWS} searchEnabled />);
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

    render(<TonightScreen tonightsDinner={[]} pickerRows={ROWS} searchEnabled />);
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

    render(<TonightScreen tonightsDinner={[]} pickerRows={ROWS} searchEnabled />);
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

    render(<TonightScreen tonightsDinner={[]} pickerRows={ROWS} searchEnabled />);
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

    render(<TonightScreen tonightsDinner={[]} pickerRows={ROWS} searchEnabled />);
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

    render(<TonightScreen tonightsDinner={[]} pickerRows={TAGGED_ROWS} searchEnabled />);

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

    render(<TonightScreen tonightsDinner={[]} pickerRows={ROWS} searchEnabled />);
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

    render(<TonightScreen tonightsDinner={[]} pickerRows={ROWS} searchEnabled />);
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByText("Search unavailable — try again");

    // A second, successful search swaps in the AI result and clears the error.
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("Light and quick")).toBeTruthy();
    expect(screen.queryByText("Search unavailable — try again")).toBeNull();
  });

  it("hides the search box when AI search is not enabled", () => {
    // No ANTHROPIC_API_KEY — Tonight is exactly v1: the search box is absent.
    render(<TonightScreen tonightsDinner={[]} pickerRows={ROWS} searchEnabled={false} />);

    expect(screen.queryByLabelText("Search for dinner by intent")).toBeNull();
    expect(screen.queryByRole("button", { name: "Search" })).toBeNull();

    // The deterministic list and its filter zone remain — v1 is unaffected.
    expect(screen.getByText("Never eaten yet")).toBeTruthy();
    expect(
      screen.queryByRole("group", { name: "Filter by kind" }),
    ).toBeTruthy();
  });
});

describe("TonightScreen — Remove from Tonight's dinner", () => {
  it("gives every decided-block row a Remove control", () => {
    render(
      <TonightScreen
        tonightsDinner={DINNER}
        pickerRows={[]}
        searchEnabled={false}
      />,
    );
    // One Remove control per Picked Option.
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(2);
  });

  it("asks for an inline confirm before deleting today's Log entry", () => {
    render(
      <TonightScreen
        tonightsDinner={DINNER}
        pickerRows={[]}
        searchEnabled={false}
      />,
    );

    // The first tap only arms the confirm — nothing is deleted yet, and an
    // in-place Cancel control appears alongside the armed Remove.
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    expect(mockedDelete).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();

    // Confirming deletes today's Log entry for that Option by its entry id —
    // reusing `deleteLogEntry`, no new server action.
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    expect(mockedDelete).toHaveBeenCalledWith("e1");
  });

  it("backs out of the confirm on Cancel without deleting", () => {
    render(
      <TonightScreen
        tonightsDinner={DINNER}
        pickerRows={[]}
        searchEnabled={false}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // The confirm is disarmed and the Log entry was never deleted.
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    expect(mockedDelete).not.toHaveBeenCalled();
  });

  it("drops back to picker mode once the last Option is removed", () => {
    // A Remove revalidates Tonight, so the server hands the screen a smaller
    // `tonightsDinner`; emptying it returns the screen to picker mode.
    const { rerender } = render(
      <TonightScreen
        tonightsDinner={DINNER}
        pickerRows={ROWS}
        searchEnabled={false}
      />,
    );
    // Decided mode: the "Tonight's dinner" block is shown, the picker collapsed.
    expect(
      screen.getByRole("region", { name: "Tonight's dinner" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("group", { name: "Filter by kind" }),
    ).toBeNull();

    rerender(
      <TonightScreen
        tonightsDinner={[]}
        pickerRows={ROWS}
        searchEnabled={false}
      />,
    );

    // Picker mode: the decided block is gone and the ranked picker is back.
    expect(
      screen.queryByRole("region", { name: "Tonight's dinner" }),
    ).toBeNull();
    expect(
      screen.getByRole("group", { name: "Filter by kind" }),
    ).toBeTruthy();
    expect(screen.getByText("Never eaten yet")).toBeTruthy();
  });
});
