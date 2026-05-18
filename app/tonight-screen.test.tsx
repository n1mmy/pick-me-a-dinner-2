// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { TonightRow } from "../lib/ranking";
import type { TonightsDinnerEntry } from "../lib/tonights-dinner";

// `aiSearchAction` is the AI search server action; the screen test drives the
// component with it mocked (PRD: AI search — "with aiSearchAction mocked").
vi.mock("./tonight-actions", () => ({
  aiSearchAction: vi.fn(),
}));
// The Rejection-write actions live in `rejection-actions`; the screen calls
// `deleteRejection` for Bring back and `tonight-row` calls `rejectOption`.
// Stub both so importing them never pulls in the database client.
vi.mock("./rejection-actions", () => ({
  rejectOption: vi.fn(async () => ({ ok: true })),
  deleteRejection: vi.fn(async () => {}),
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
 * A deterministic Tonight row. `tags` are the Option's Tags, which drive the
 * Tag filter chips in the filter zone. Rows are identified in assertions by
 * their Option name (digit-free, so a whole-string text match is safe).
 */
function row(id: string, name: string, tags: string[] = []): TonightRow {
  return {
    option: { id, name, kind: "home", tags, url: null, phone: null },
    score: 10,
    tags: [],
    recencyDays: 0,
    neverEaten: false,
  };
}

const ROWS: TonightRow[] = [
  row("o1", "Apple Crumble"),
  row("o2", "Banana Bread"),
];

// Rows that carry a Tag, so the filter zone renders the Tag filter chips
// alongside the kind segment.
const TAGGED_ROWS: TonightRow[] = [
  row("o1", "Apple Crumble", ["dessert"]),
  row("o2", "Banana Bread", ["dessert"]),
];

// Two Picked Options — a non-empty `tonightsDinner` puts Tonight in decided
// mode and renders the "Tonight's dinner" block. `entryId` is the today Log
// entry id the row's "Remove" deletes.
const DINNER: TonightsDinnerEntry[] = [
  { entryId: "e1", row: row("o1", "Apple Crumble") },
  { entryId: "e2", row: row("o2", "Banana Bread") },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  // The scroll-to-top effect keeps the last dinner count here; clear it so a
  // prior test's count never leaks into the next render.
  sessionStorage.clear();
});

/**
 * Click "Search" and wait for the in-flight AI-search transition to *fully*
 * settle before returning.
 *
 * The search runs inside an async `useTransition` (`startTransition(async …)`).
 * Under React 19 the transition's `pending` flag does not flip back to `false`
 * in the same commit that renders the AI result — it settles a commit later. A
 * bare `await screen.findByText(<result>)` therefore resolves while `pending`
 * is still `true`, and the search input and Search/Clear buttons are all
 * `disabled={pending}`: a `fireEvent.click` fired in that window hits a
 * still-disabled control and is silently dropped, and an `input.disabled`
 * assertion reads the not-yet-flushed value. That race is what made this block
 * flaky.
 *
 * Waiting for the Search button's label to revert from "Searching…" to
 * "Search" pins `pending` back to `false` — and, because the AI result and the
 * label revert land in the same transition commit, also guarantees the result
 * (or the inline error) has rendered.
 */
async function submitSearchAndSettle() {
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  await screen.findByRole("button", { name: "Search" });
}

/** Re-query the search input — never reuse a captured ref across re-renders. */
function searchInput() {
  return screen.getByLabelText(
    "Search for dinner by intent",
  ) as HTMLInputElement;
}

describe("TonightScreen — AI search", () => {
  it("swaps the deterministic list for the AI result on submit", async () => {
    mockedAiSearch.mockResolvedValue({
      ok: true,
      results: [{ id: "o2", reason: "Light and quick" }],
    });

    render(<TonightScreen tonightsDinner={[]} pickerRows={ROWS} searchEnabled />);
    // The deterministic list shows its rows.
    expect(screen.getByText("Apple Crumble")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Search for dinner by intent"), {
      target: { value: "something light" },
    });
    await submitSearchAndSettle();

    // The AI result swaps in; the unranked deterministic row is gone.
    expect(await screen.findByText("Light and quick")).toBeTruthy();
    expect(screen.queryByText("Apple Crumble")).toBeNull();
    expect(mockedAiSearch).toHaveBeenCalledWith("something light");
  });

  it("restores the deterministic list when the search is cleared", async () => {
    mockedAiSearch.mockResolvedValue({
      ok: true,
      results: [{ id: "o2", reason: "Light and quick" }],
    });

    render(<TonightScreen tonightsDinner={[]} pickerRows={ROWS} searchEnabled />);
    await submitSearchAndSettle();
    await screen.findByText("Light and quick");
    // Wait for the in-flight transition to settle — the Clear control is
    // disabled while `pending`, so clicking it sooner is a silent no-op.
    await screen.findByRole("button", { name: "Search" });

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    // Both deterministic rows are back and the AI rationale is gone.
    await waitFor(() => {
      expect(screen.getByText("Apple Crumble")).toBeTruthy();
    });
    expect(screen.getByText("Banana Bread")).toBeTruthy();
    expect(screen.queryByText("Light and quick")).toBeNull();
  });

  it("shows a plain empty-state with a clear control on an empty AI result", async () => {
    mockedAiSearch.mockResolvedValue({ ok: true, results: [] });

    render(<TonightScreen tonightsDinner={[]} pickerRows={ROWS} searchEnabled />);
    await submitSearchAndSettle();

    // The empty result reads as a real answer, not a broken screen.
    expect(await screen.findByText("No Options fit that search.")).toBeTruthy();
    expect(screen.queryByText("Apple Crumble")).toBeNull();

    // The inline clear control returns the screen to the deterministic list.
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    await waitFor(() => {
      expect(screen.getByText("Apple Crumble")).toBeTruthy();
    });
    expect(screen.getByText("Banana Bread")).toBeTruthy();
    expect(screen.queryByText("No Options fit that search.")).toBeNull();
  });

  it("leaves the deterministic list intact and shows an error on failure", async () => {
    mockedAiSearch.mockResolvedValue({ ok: false });

    render(<TonightScreen tonightsDinner={[]} pickerRows={ROWS} searchEnabled />);
    await submitSearchAndSettle();

    // The persistent inline error appears; the deterministic list is untouched.
    expect(
      await screen.findByText("Search unavailable — try again"),
    ).toBeTruthy();
    expect(screen.getByText("Apple Crumble")).toBeTruthy();
    expect(screen.getByText("Banana Bread")).toBeTruthy();
  });

  it("clears the error when the query is cleared", async () => {
    mockedAiSearch.mockResolvedValue({ ok: false });

    render(<TonightScreen tonightsDinner={[]} pickerRows={ROWS} searchEnabled />);
    await submitSearchAndSettle();
    await screen.findByText("Search unavailable — try again");
    // Wait for the in-flight transition to settle — the Clear control is
    // disabled while `pending`, so clicking it sooner is a silent no-op.
    await screen.findByRole("button", { name: "Search" });

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    await waitFor(() => {
      expect(
        screen.queryByText("Search unavailable — try again"),
      ).toBeNull();
    });
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

    await submitSearchAndSettle();
    await screen.findByText("Light and quick");

    // While the AI result is shown the query is the single ranking authority:
    // both the kind segment and the Tag filter chips are gone. The kind segment
    // is hidden by a parent-state update driven by a `useEffect`, so it can
    // settle a render after the result itself — `waitFor` rides that out.
    await waitFor(() => {
      expect(
        screen.queryByRole("group", { name: "Filter by kind" }),
      ).toBeNull();
    });
    expect(screen.queryByRole("group", { name: "Filter by tag" })).toBeNull();

    // Wait for the in-flight transition to settle — the Clear control is
    // disabled while `pending`, so clicking it sooner is a silent no-op.
    await screen.findByRole("button", { name: "Search" });
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    // Clearing restores both the deterministic list and its filter controls.
    await waitFor(() => {
      expect(screen.getByText("Apple Crumble")).toBeTruthy();
    });
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
    expect(searchInput().disabled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    // While the search is in flight the box is disabled — so only one search
    // runs at a time — and the deterministic list stays visible underneath.
    await screen.findByRole("button", { name: "Searching…" });
    expect(searchInput().disabled).toBe(true);
    expect(screen.getByText("Apple Crumble")).toBeTruthy();

    // The result arrives, swaps in, and re-enables the box. Resolving inside
    // `act` flushes the transition — input and result both settle — so the
    // disabled assertion no longer races the not-yet-committed `pending` flip.
    await act(async () => {
      resolveSearch({
        ok: true,
        results: [{ id: "o2", reason: "Light and quick" }],
      });
    });
    await screen.findByText("Light and quick");
    await screen.findByRole("button", { name: "Search" });
    expect(searchInput().disabled).toBe(false);
  });

  it("clears the error when a later search succeeds", async () => {
    mockedAiSearch.mockResolvedValueOnce({ ok: false });
    mockedAiSearch.mockResolvedValueOnce({
      ok: true,
      results: [{ id: "o2", reason: "Light and quick" }],
    });

    render(<TonightScreen tonightsDinner={[]} pickerRows={ROWS} searchEnabled />);
    await submitSearchAndSettle();
    await screen.findByText("Search unavailable — try again");

    // A second, successful search swaps in the AI result and clears the error.
    await submitSearchAndSettle();
    expect(await screen.findByText("Light and quick")).toBeTruthy();
    expect(screen.queryByText("Search unavailable — try again")).toBeNull();
  });

  it("hides the search box when AI search is not enabled", () => {
    // No ANTHROPIC_API_KEY — Tonight is exactly v1: the search box is absent.
    render(<TonightScreen tonightsDinner={[]} pickerRows={ROWS} searchEnabled={false} />);

    expect(screen.queryByLabelText("Search for dinner by intent")).toBeNull();
    expect(screen.queryByRole("button", { name: "Search" })).toBeNull();

    // The deterministic list and its filter zone remain — v1 is unaffected.
    expect(screen.getByText("Apple Crumble")).toBeTruthy();
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
    // Decided mode: the "Tonight's dinner" block sits above the open
    // "Add another option" picker.
    expect(
      screen.getByRole("region", { name: "Tonight's dinner" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("region", { name: "Add another option" }),
    ).toBeTruthy();

    rerender(
      <TonightScreen
        tonightsDinner={[]}
        pickerRows={ROWS}
        searchEnabled={false}
      />,
    );

    // Picker mode: the decided block and its "Add another option" divider
    // are gone, and the ranked picker is the whole screen.
    expect(
      screen.queryByRole("region", { name: "Tonight's dinner" }),
    ).toBeNull();
    expect(
      screen.queryByRole("region", { name: "Add another option" }),
    ).toBeNull();
    expect(
      screen.getByRole("group", { name: "Filter by kind" }),
    ).toBeTruthy();
    expect(screen.getByText("Apple Crumble")).toBeTruthy();
  });
});

describe("TonightScreen — decided-mode picker", () => {
  it("keeps the ranked picker open below the decided block, under a divider", () => {
    render(
      <TonightScreen
        tonightsDinner={DINNER}
        pickerRows={ROWS}
        searchEnabled={false}
      />,
    );
    // No collapse toggle: the picker is on screen straight away, under an
    // "Add another option" divider whose hint says picking adds a second
    // dinner rather than replacing the first.
    expect(
      screen.queryByRole("button", { name: "Add another option" }),
    ).toBeNull();
    expect(
      screen.getByRole("region", { name: "Add another option" }),
    ).toBeTruthy();
    expect(
      screen.getByText(/won.t replace what.s already chosen/i),
    ).toBeTruthy();
    expect(
      screen.getByRole("group", { name: "Filter by kind" }),
    ).toBeTruthy();
  });

  it("shows the all-picked message when nothing is left to pick", () => {
    render(
      <TonightScreen
        tonightsDinner={DINNER}
        pickerRows={[]}
        searchEnabled={false}
      />,
    );
    expect(
      screen.getByText("Every Option is already on tonight’s dinner."),
    ).toBeTruthy();
    // With nothing left to rank there is no picker and no divider section.
    expect(
      screen.queryByRole("region", { name: "Add another option" }),
    ).toBeNull();
  });
});

describe("TonightScreen — scroll to top on Pick", () => {
  // jsdom implements neither; stub them so the scroll on Pick can be observed.
  function stubScroll(reduceMotion: boolean) {
    const scrollTo = vi.fn();
    vi.stubGlobal("scrollTo", scrollTo);
    vi.stubGlobal("matchMedia", () => ({ matches: reduceMotion }));
    return scrollTo;
  }

  it("scrolls to the top when a Pick grows Tonight's dinner", () => {
    const scrollTo = stubScroll(false);
    const { rerender } = render(
      <TonightScreen
        tonightsDinner={[DINNER[0]]}
        pickerRows={ROWS}
        searchEnabled={false}
      />,
    );
    // Mount alone never scrolls — only a later growth in the count does.
    expect(scrollTo).not.toHaveBeenCalled();

    // A Pick revalidates the page with another Option in Tonight's dinner.
    rerender(
      <TonightScreen
        tonightsDinner={DINNER}
        pickerRows={ROWS}
        searchEnabled={false}
      />,
    );
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("does not scroll when a Remove shrinks Tonight's dinner", () => {
    const scrollTo = stubScroll(false);
    const { rerender } = render(
      <TonightScreen
        tonightsDinner={DINNER}
        pickerRows={ROWS}
        searchEnabled={false}
      />,
    );
    rerender(
      <TonightScreen
        tonightsDinner={[DINNER[0]]}
        pickerRows={ROWS}
        searchEnabled={false}
      />,
    );
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("honors prefers-reduced-motion with an instant jump", () => {
    const scrollTo = stubScroll(true);
    const { rerender } = render(
      <TonightScreen
        tonightsDinner={[DINNER[0]]}
        pickerRows={ROWS}
        searchEnabled={false}
      />,
    );
    rerender(
      <TonightScreen
        tonightsDinner={DINNER}
        pickerRows={ROWS}
        searchEnabled={false}
      />,
    );
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
  });
});
