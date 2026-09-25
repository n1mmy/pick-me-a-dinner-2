// @vitest-environment jsdom
import {
  afterEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { startTransition } from "react";
import type { TonightRow } from "../lib/ranking";
import type { LastNote } from "../lib/last-note";
import type { TonightsDinnerEntry } from "../lib/tonights-dinner";
import { weekdayName } from "../lib/local-day";

// `aiSearchAction` is the client-side fetch wrapper around AI search's Route
// Handler (`app/api/ai-search/route.ts`); the screen test drives the
// component with it mocked (PRD: AI search — "with aiSearchAction mocked").
vi.mock("./tonight-search-client", () => ({
  aiSearchAction: vi.fn(),
}));
// The Rejection-write actions live in `rejection-actions`; the screen calls
// `deleteRejection` for Bring back and `tonight-row` calls `rejectOption`.
// Stub both so importing them never pulls in the database client.
vi.mock("./rejection-actions", () => ({
  rejectOption: vi.fn(async () => ({ ok: true })),
  deleteRejection: vi.fn(async () => ({ ok: true })),
}));
// `tonight-row` calls `pickTonight` and the decided block calls
// `deleteLogEntry`; stub both so importing them never pulls in the database
// client, and so the Remove flow can be asserted on the mock.
vi.mock("./log/actions", () => ({
  pickTonight: vi.fn(async () => ({ ok: true })),
  deleteLogEntry: vi.fn(async () => ({ ok: true })),
}));
// The quick-add form's own write (issue 03) — stubbed so the Add-row suite
// never pulls in the database client, and so a create can be asserted on
// the mock the same way every other write action is here.
vi.mock("./catalog/actions", () => ({
  createOption: vi.fn(async () => ({ ok: true, id: "new-id" })),
  updateOption: vi.fn(async () => ({ ok: true })),
}));
// Both day-navigation controls use Next.js router hooks (`useRouter`,
// `useSearchParams`, `usePathname`) that aren't wired up in this jsdom render.
// Each has its own (intentionally tiny) surface and no behaviour these
// screen-level tests assert on, so stub them. `DayNameReset` still renders its
// heading text, which the H1 assertions below read.
vi.mock("./day-stepper", () => ({
  DayStepper: () => null,
  DayNameReset: ({ heading }: { heading: string }) => <>{heading}</>,
}));

import type { AiSearchResult } from "../lib/ai-search";
import { aiSearchAction } from "./tonight-search-client";
import { deleteLogEntry, pickTonight } from "./log/actions";
import { createOption } from "./catalog/actions";
import { TonightScreen } from "./tonight-screen";

const mockedAiSearch = vi.mocked(aiSearchAction);
const mockedDelete = vi.mocked(deleteLogEntry);
const mockedPick = vi.mocked(pickTonight);
const mockedCreate = vi.mocked(createOption);

/**
 * A deterministic Tonight row. `tags` are the Option's Tags, which drive the
 * Tag filter chips in the filter zone. Rows are identified in assertions by
 * their Option name (digit-free, so a whole-string text match is safe).
 */
function row(id: string, name: string, tags: string[] = []): TonightRow {
  return {
    option: { id, name, kind: "home", tags, url: null, phone: null },
    score: 10,
    affinity: 1,
    readiness: 10,
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
  { entryId: "e1", row: row("o1", "Apple Crumble"), note: null },
  { entryId: "e2", row: row("o2", "Banana Bread"), note: null },
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
 * Wait for the in-flight AI-search transition to *fully* settle — the button
 * reverts from its pending "Cancel search — …" label back to "Search" or
 * "Search complete …" once the result (or the inline error) has landed.
 * Nothing here is `disabled` while pending (design review UX idea #3 — the
 * Household is never locked out of the box or the rest of the screen while a
 * search runs), so this only needs to wait on the label, not on any
 * `disabled` flag.
 */
async function waitForSearchSettled() {
  await waitFor(() => {
    expect(
      screen.queryByRole("button", { name: /^Cancel search/ }),
    ).toBeNull();
  });
}

/** Click the Search button and wait for the transition to fully settle. */
async function submitSearchAndSettle() {
  fireEvent.click(screen.getByRole("button", { name: /^Search/ }));
  await waitForSearchSettled();
}

/** Re-query the search input — never reuse a captured ref across re-renders. */
function searchInput() {
  return screen.getByLabelText(
    "Find a dinner by name, or describe a craving",
  ) as HTMLInputElement;
}

describe("TonightScreen — AI search", () => {
  it("swaps the deterministic list for the AI result on submit", async () => {
    mockedAiSearch.mockResolvedValue({
      ok: true,
      results: [{ id: "o2", reason: "Light and quick" }],
    });

    render(<TonightScreen selectedDay="2026-05-20" todaySql="2026-05-20" tonightsDinner={[]} pickerRows={ROWS} searchEnabled />);
    // The deterministic list shows its rows.
    expect(screen.getByText("Apple Crumble")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Find a dinner by name, or describe a craving"), {
      target: { value: "something light" },
    });
    await submitSearchAndSettle();

    // The AI result swaps in; the unranked deterministic row is gone.
    expect(await screen.findByText("Light and quick")).toBeTruthy();
    expect(screen.queryByText("Apple Crumble")).toBeNull();
    // The Selected day is today in this test render, so the second argument
    // is `undefined` — `aiSearchAction` then defaults to today server-side.
    expect(mockedAiSearch).toHaveBeenCalledWith("something light", undefined);
  });

  it("passes a future Selected day through to the AI search action", async () => {
    // ADR-0009: a search on a stepped Tonight passes the Selected day to
    // `aiSearchAction`, so the snapshot rotates around that day for the model.
    mockedAiSearch.mockResolvedValue({
      ok: true,
      results: [{ id: "o2", reason: "Friday fit" }],
    });

    render(
      <TonightScreen
        selectedDay="2026-05-22"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={ROWS}
        searchEnabled
      />,
    );

    fireEvent.change(screen.getByLabelText("Find a dinner by name, or describe a craving"), {
      target: { value: "something light" },
    });
    await submitSearchAndSettle();

    expect(mockedAiSearch).toHaveBeenCalledWith("something light", "2026-05-22");
  });

  it("renders an AI row with an empty reason as a deterministic-style row", async () => {
    // `pithy` mode returns an empty reason for an obviously bad pick; that row
    // must render with no rationale paragraph — just the name and chips, the
    // way a deterministic row reads.
    mockedAiSearch.mockResolvedValue({
      ok: true,
      results: [
        { id: "o1", reason: "Strong Monday pick" },
        { id: "o2", reason: "" },
      ],
    });

    const { container } = render(
      <TonightScreen selectedDay="2026-05-20" todaySql="2026-05-20" tonightsDinner={[]} pickerRows={ROWS} searchEnabled />,
    );
    await submitSearchAndSettle();

    // Both Options render as AI rows...
    expect(await screen.findByText("Apple Crumble")).toBeTruthy();
    expect(screen.getByText("Banana Bread")).toBeTruthy();
    // ...but only the pick with a reason carries a rationale paragraph — the
    // empty-reason row renders none.
    expect(screen.getByText("Strong Monday pick")).toBeTruthy();
    expect(container.querySelectorAll("p.bg-raised")).toHaveLength(1);
  });

  it("shows the in-field clear control once the query has text", () => {
    render(<TonightScreen selectedDay="2026-05-20" todaySql="2026-05-20" tonightsDinner={[]} pickerRows={ROWS} searchEnabled />);

    // No text and no search run yet — nothing to clear, so no ✕.
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();

    fireEvent.change(searchInput(), { target: { value: "something light" } });

    // Typing reveals the in-field ✕; clicking it empties the query, and the
    // ✕ goes away again.
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(searchInput().value).toBe("");
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
  });

  it("restores the deterministic list when the search is cleared", async () => {
    mockedAiSearch.mockResolvedValue({
      ok: true,
      results: [{ id: "o2", reason: "Light and quick" }],
    });

    render(<TonightScreen selectedDay="2026-05-20" todaySql="2026-05-20" tonightsDinner={[]} pickerRows={ROWS} searchEnabled />);
    await submitSearchAndSettle();
    await screen.findByText("Light and quick");

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

    // Both deterministic rows are back and the AI rationale is gone.
    await waitFor(() => {
      expect(screen.getByText("Apple Crumble")).toBeTruthy();
    });
    expect(screen.getByText("Banana Bread")).toBeTruthy();
    expect(screen.queryByText("Light and quick")).toBeNull();
  });

  it("shows a plain empty-state with a clear control on an empty AI result", async () => {
    mockedAiSearch.mockResolvedValue({ ok: true, results: [] });

    render(<TonightScreen selectedDay="2026-05-20" todaySql="2026-05-20" tonightsDinner={[]} pickerRows={ROWS} searchEnabled />);
    await submitSearchAndSettle();

    // The empty result reads as a real answer, not a broken screen.
    expect(await screen.findByText("No Options fit that search.")).toBeTruthy();
    expect(screen.queryByText("Apple Crumble")).toBeNull();

    // The empty-state's own inline clear control returns the screen to the
    // deterministic list. Scope to the empty-state block — the in-field ✕
    // shares the "Clear search" name and is also on screen here.
    const emptyState = screen.getByText("No Options fit that search.")
      .parentElement as HTMLElement;
    fireEvent.click(
      within(emptyState).getByRole("button", { name: "Clear search" }),
    );
    await waitFor(() => {
      expect(screen.getByText("Apple Crumble")).toBeTruthy();
    });
    expect(screen.getByText("Banana Bread")).toBeTruthy();
    expect(screen.queryByText("No Options fit that search.")).toBeNull();
  });

  it("leaves the deterministic list intact and shows an error on failure", async () => {
    mockedAiSearch.mockResolvedValue({ ok: false });

    render(<TonightScreen selectedDay="2026-05-20" todaySql="2026-05-20" tonightsDinner={[]} pickerRows={ROWS} searchEnabled />);
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

    render(<TonightScreen selectedDay="2026-05-20" todaySql="2026-05-20" tonightsDinner={[]} pickerRows={ROWS} searchEnabled />);
    await submitSearchAndSettle();
    await screen.findByText("Search unavailable — try again");

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

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

    render(<TonightScreen selectedDay="2026-05-20" todaySql="2026-05-20" tonightsDinner={[]} pickerRows={TAGGED_ROWS} searchEnabled />);

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

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

    // Clearing restores both the deterministic list and its filter controls.
    await waitFor(() => {
      expect(screen.getByText("Apple Crumble")).toBeTruthy();
    });
    expect(
      screen.queryByRole("group", { name: "Filter by kind" }),
    ).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Filter by tag" })).toBeTruthy();
  });

  it("never disables the search box in flight, and keeps the deterministic list visible", async () => {
    // A deferred result lets the test observe the in-flight state.
    let resolveSearch: (result: AiSearchResult) => void = () => {};
    mockedAiSearch.mockReturnValue(
      new Promise<AiSearchResult>((resolve) => {
        resolveSearch = resolve;
      }),
    );

    render(<TonightScreen selectedDay="2026-05-20" todaySql="2026-05-20" tonightsDinner={[]} pickerRows={ROWS} searchEnabled />);
    expect(searchInput().disabled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    // While the search is in flight the box stays enabled (UX idea #3 — the
    // Household is never locked out of it) and the deterministic list stays
    // visible underneath. The Search button becomes Cancel; its accessible
    // name carries the elapsed-second count, so it is matched by prefix.
    await screen.findByRole("button", { name: /^Cancel search/ });
    expect(searchInput().disabled).toBe(false);
    expect(screen.getByText("Apple Crumble")).toBeTruthy();

    // The result arrives and swaps in. Resolving inside `act` flushes the
    // transition so the result and the button's reverted label both settle.
    await act(async () => {
      resolveSearch({
        ok: true,
        results: [{ id: "o2", reason: "Light and quick" }],
      });
    });
    await screen.findByText("Light and quick");
    await waitForSearchSettled();
    expect(searchInput().disabled).toBe(false);
  });

  it("still Picks by typing while an AI search is in flight", async () => {
    // The complaint this fixes: a Household member who already knows what
    // they want for dinner shouldn't have to wait out someone else's 50–90s
    // AI search just to type a name and pick it (UX idea #3). The search's
    // own result never resolves in this test — if picking depended on it,
    // this test would hang.
    mockedAiSearch.mockReturnValue(new Promise<AiSearchResult>(() => {}));

    render(<TonightScreen selectedDay="2026-05-20" todaySql="2026-05-20" tonightsDinner={[]} pickerRows={ROWS} searchEnabled />);

    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByRole("button", { name: /^Cancel search/ });

    fireEvent.change(searchInput(), { target: { value: "Apple" } });
    fireEvent.keyDown(searchInput(), { key: "ArrowDown" });
    fireEvent.keyDown(searchInput(), { key: "Enter" });

    await waitFor(() => {
      expect(mockedPick).toHaveBeenCalledWith("o1", undefined);
    });
  });

  it("reflects a Pick's revalidated props while an AI search is still pending", async () => {
    // A row-level Pick's `pickTonight` Server Action revalidates Tonight
    // server-side; Next's router then re-renders this tree with fresh
    // `tonightsDinner`/`pickerRows` props. The AI search never resolves in
    // this test, so if a pending search suppressed that prop update from
    // landing, this test would catch it.
    //
    // The props are applied inside `startTransition` — not a bare `rerender`
    // — because that is what Next's router actually does with the RSC
    // payload, and the seam matters: a sync update always renders, but a
    // *transition* scheduled while an async transition (the search's `await`)
    // is pending gets entangled with it and cannot commit until the search
    // resolves. That was the live bug behind this test: `runSearch` used to
    // wrap the whole `await aiSearchAction(...)` in `startSearchTransition`,
    // holding an async transition open for the full 50–90s and pinning every
    // Pick's revalidated props off-screen behind it. A bare `rerender` here
    // passes either way and cannot catch a regression.
    // jsdom implements neither `scrollTo` nor `matchMedia` — the scroll-to-top
    // effect that fires when `tonightsDinner` grows reaches for both.
    vi.stubGlobal("scrollTo", vi.fn());
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    mockedAiSearch.mockReturnValue(new Promise<AiSearchResult>(() => {}));
    mockedPick.mockResolvedValue({ ok: true });

    const { rerender } = render(
      <TonightScreen selectedDay="2026-05-20" todaySql="2026-05-20" tonightsDinner={[]} pickerRows={ROWS} searchEnabled />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByRole("button", { name: /^Cancel search/ });

    fireEvent.click(screen.getAllByRole("button", { name: "Pick" })[0]);
    await waitFor(() => {
      expect(mockedPick).toHaveBeenCalledWith("o1", undefined);
    });

    // The revalidated props Next's router would hand back: o1 moved into
    // `tonightsDinner`, dropped out of `pickerRows` — applied in a transition,
    // as the router applies them.
    startTransition(() => {
      rerender(
        <TonightScreen
          selectedDay="2026-05-20"
          todaySql="2026-05-20"
          tonightsDinner={[{ entryId: "e1", row: row("o1", "Apple Crumble"), note: null }]}
          pickerRows={[row("o2", "Banana Bread")]}
          searchEnabled
        />,
      );
    });
    // Flush the scheduler so the transition has every chance to commit.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // The Household sees the Pick land — Tonight's dinner block shows it and
    // the ranked list below no longer offers it — even though the search is
    // still (per this test's never-resolving mock) mid-flight.
    expect(
      screen.getByRole("region", { name: "Tonight's dinner" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Cancel search/ })).toBeTruthy();
  });

  it("Cancel returns control immediately and drops a late-arriving result", async () => {
    let resolveSearch: (result: AiSearchResult) => void = () => {};
    mockedAiSearch.mockReturnValue(
      new Promise<AiSearchResult>((resolve) => {
        resolveSearch = resolve;
      }),
    );

    render(<TonightScreen selectedDay="2026-05-20" todaySql="2026-05-20" tonightsDinner={[]} pickerRows={ROWS} searchEnabled />);
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByRole("button", { name: /^Cancel search/ });

    // Cancel does not wait on the network call it is giving up on.
    fireEvent.click(screen.getByRole("button", { name: /^Cancel search/ }));
    expect(screen.getByRole("button", { name: "Search" })).toBeTruthy();
    expect(screen.getByText("Apple Crumble")).toBeTruthy();
    // The Cancel button flips back to a `type="submit"` Search button the
    // instant this same click sets `pending` false — without an explicit
    // `preventDefault`, that flip lets the click's own default action
    // re-submit the form it just un-typed itself into, restarting the
    // search it was meant to cancel.
    expect(mockedAiSearch).toHaveBeenCalledTimes(1);

    // The model call that was already dispatched still finishes server-side;
    // its result must not resurrect after the Household has moved on.
    await act(async () => {
      resolveSearch({
        ok: true,
        results: [{ id: "o2", reason: "Light and quick" }],
      });
    });
    expect(screen.queryByText("Light and quick")).toBeNull();
    expect(screen.getByText("Apple Crumble")).toBeTruthy();
  });

  it("clears the error when a later search succeeds", async () => {
    mockedAiSearch.mockResolvedValueOnce({ ok: false });
    mockedAiSearch.mockResolvedValueOnce({
      ok: true,
      results: [{ id: "o2", reason: "Light and quick" }],
    });

    render(<TonightScreen selectedDay="2026-05-20" todaySql="2026-05-20" tonightsDinner={[]} pickerRows={ROWS} searchEnabled />);
    await submitSearchAndSettle();
    await screen.findByText("Search unavailable — try again");

    // A second, successful search swaps in the AI result and clears the error.
    await submitSearchAndSettle();
    expect(await screen.findByText("Light and quick")).toBeTruthy();
    expect(screen.queryByText("Search unavailable — try again")).toBeNull();
  });

  it("marks the search button complete after a successful search", async () => {
    mockedAiSearch.mockResolvedValue({
      ok: true,
      results: [{ id: "o2", reason: "Light and quick" }],
    });

    render(<TonightScreen selectedDay="2026-05-20" todaySql="2026-05-20" tonightsDinner={[]} pickerRows={ROWS} searchEnabled />);
    await submitSearchAndSettle();

    // The button drops "Search" for a done badge — a check plus the elapsed
    // time — once the result lands; its accessible name reflects the state.
    expect(
      await screen.findByRole("button", { name: /^Search complete/ }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Search" })).toBeNull();
  });

  it("hides the search box when AI search is not enabled", () => {
    // No ANTHROPIC_API_KEY — Tonight is exactly v1: the search box is absent.
    render(<TonightScreen selectedDay="2026-05-20" todaySql="2026-05-20" tonightsDinner={[]} pickerRows={ROWS} searchEnabled={false} />);

    expect(screen.queryByLabelText("Find a dinner by name, or describe a craving")).toBeNull();
    expect(screen.queryByRole("button", { name: "Search" })).toBeNull();

    // The deterministic list and its filter zone remain — v1 is unaffected.
    expect(screen.getByText("Apple Crumble")).toBeTruthy();
    expect(
      screen.queryByRole("group", { name: "Filter by kind" }),
    ).toBeTruthy();
  });

  it("keeps the AI result on screen when a Pick flips picker → decided mode", async () => {
    // A Pick today empties `pickerRows` of the Picked Option and grows
    // `tonightsDinner`, which flips the screen from picker mode (Picker is a
    // direct child of `<main>`) to decided mode (Picker is wrapped in an
    // "Add another option" `<section>`). Holding the AI search state on
    // `TonightScreen` instead of `Picker` is what keeps the result alive
    // across that wrapper change — Picker remounts, but `aiResults` is on
    // the parent so the AI-ranked list survives.
    //
    // jsdom implements neither `scrollTo` nor `matchMedia` — the scroll-to-top
    // effect that fires when `tonightsDinner` grows reaches for both — so stub
    // them as no-ops here, the same way the scroll-on-Pick suite does.
    vi.stubGlobal("scrollTo", vi.fn());
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    mockedAiSearch.mockResolvedValue({
      ok: true,
      results: [
        { id: "o1", reason: "Sweet and quick" },
        { id: "o2", reason: "Light and quick" },
      ],
    });

    const { rerender } = render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={ROWS}
        searchEnabled
      />,
    );
    await submitSearchAndSettle();
    await screen.findByText("Sweet and quick");
    await screen.findByText("Light and quick");

    // A Pick on `o1`: the server revalidates, `tonightsDinner` now carries
    // the Picked Option and `pickerRows` no longer does. The screen flips
    // into decided mode under the new section wrapper.
    rerender(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[DINNER[0]]}
        pickerRows={[ROWS[1]]}
        searchEnabled
      />,
    );

    // The decided block is on screen; the picker below it still carries the
    // AI-ranked remainder of the result — the Picked Option drops out, the
    // other AI row stays put with its rationale.
    expect(
      screen.getByRole("region", { name: "Tonight's dinner" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("region", { name: "Add another option" }),
    ).toBeTruthy();
    expect(screen.getByText("Light and quick")).toBeTruthy();
    // The Picked Option's AI rationale is gone — its row dropped out of the
    // AI list because it left `pickerRows`.
    expect(screen.queryByText("Sweet and quick")).toBeNull();
  });

  it("keeps an AI result on screen across a Selected-day change", async () => {
    // ADR-0009, amendment 2026-09-22: stepping the day keeps the query and the
    // result, resolved against the new day's rows.
    mockedAiSearch.mockResolvedValue({
      ok: true,
      results: [
        { id: "o1", reason: "Sweet and quick" },
        { id: "o2", reason: "Light and quick" },
      ],
    });

    const { rerender } = render(
      <TonightScreen selectedDay="2026-05-20" todaySql="2026-05-20" tonightsDinner={[]} pickerRows={ROWS} searchEnabled />,
    );
    fireEvent.change(searchInput(), { target: { value: "something light" } });
    await submitSearchAndSettle();
    await screen.findByText("Light and quick");

    // Step to Friday, where o1 is rejected or closed and so not in the rows.
    rerender(
      <TonightScreen selectedDay="2026-05-22" todaySql="2026-05-20" tonightsDinner={[]} pickerRows={[ROWS[1]]} searchEnabled />,
    );

    expect(screen.getByText("Light and quick")).toBeTruthy();
    expect(screen.queryByText("Sweet and quick")).toBeNull();
    expect(searchInput().value).toBe("something light");
    expect(
      screen.getByRole("button", { name: /^Search complete/ }),
    ).toBeTruthy();
  });

  it("lands an in-flight AI search that was started before a Selected-day change", async () => {
    let resolveSearch: (result: AiSearchResult) => void = () => {};
    mockedAiSearch.mockReturnValue(
      new Promise<AiSearchResult>((resolve) => {
        resolveSearch = resolve;
      }),
    );

    const { rerender } = render(
      <TonightScreen selectedDay="2026-05-20" todaySql="2026-05-20" tonightsDinner={[]} pickerRows={ROWS} searchEnabled />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByRole("button", { name: /^Cancel search/ });

    rerender(
      <TonightScreen selectedDay="2026-05-22" todaySql="2026-05-20" tonightsDinner={[]} pickerRows={ROWS} searchEnabled />,
    );
    // Still in flight — the day change did not cancel it.
    expect(screen.getByRole("button", { name: /^Cancel search/ })).toBeTruthy();

    await act(async () => {
      resolveSearch({
        ok: true,
        results: [{ id: "o2", reason: "Light and quick" }],
      });
    });
    expect(await screen.findByText("Light and quick")).toBeTruthy();
  });

  it("keeps the result and done badge when a day change flips picker → decided mode", async () => {
    // The new day already has a Pick, so the Picker (and its search box)
    // remounts inside the "Add another option" section.
    vi.stubGlobal("scrollTo", vi.fn());
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    mockedAiSearch.mockResolvedValue({
      ok: true,
      results: [{ id: "o2", reason: "Light and quick" }],
    });

    const { rerender } = render(
      <TonightScreen selectedDay="2026-05-20" todaySql="2026-05-20" tonightsDinner={[]} pickerRows={ROWS} searchEnabled />,
    );
    await submitSearchAndSettle();
    await screen.findByRole("button", { name: /^Search complete/ });

    rerender(
      <TonightScreen selectedDay="2026-05-22" todaySql="2026-05-20" tonightsDinner={[DINNER[0]]} pickerRows={[ROWS[1]]} searchEnabled />,
    );

    expect(
      screen.getByRole("region", { name: "Add another option" }),
    ).toBeTruthy();
    expect(screen.getByText("Light and quick")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /^Search complete/ }),
    ).toBeTruthy();
  });

  it("keeps counting an in-flight search's time when a day change remounts the search box", () => {
    vi.stubGlobal("scrollTo", vi.fn());
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    mockedAiSearch.mockReturnValue(new Promise<AiSearchResult>(() => {}));
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    onTestFinished(() => now.mockRestore());

    const { rerender } = render(
      <TonightScreen selectedDay="2026-05-20" todaySql="2026-05-20" tonightsDinner={[]} pickerRows={ROWS} searchEnabled />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(
      screen.getByRole("button", { name: "Cancel search — 0 seconds elapsed" }),
    ).toBeTruthy();

    // Seven seconds in, step to a day that already has a Pick.
    now.mockReturnValue(1_007_000);
    rerender(
      <TonightScreen selectedDay="2026-05-22" todaySql="2026-05-20" tonightsDinner={[DINNER[0]]} pickerRows={[ROWS[1]]} searchEnabled />,
    );

    expect(
      screen.getByRole("button", { name: "Cancel search — 7 seconds elapsed" }),
    ).toBeTruthy();
  });
});

describe("TonightScreen — search typeahead", () => {
  // The search box's typeahead half shares its filter and ↑/↓/Enter/Escape
  // handling with `OptionCombobox` (`emptyQueryBehaviour: "none"`,
  // `initialActiveIndex: -1`) — these pin the one behaviour that is genuinely
  // this box's own: Enter submits the AI search unless a row is highlighted.

  it("shows no suggestions on an empty query", () => {
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={ROWS}
        searchEnabled
      />,
    );

    fireEvent.focus(searchInput());

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.queryByRole("option")).toBeNull();
  });

  it("leaves Enter unhandled (so the form's own submit runs the AI search) with nothing highlighted", () => {
    // "Apple" matches "Apple Crumble", so the dropdown has a row — but
    // nothing is highlighted (no arrow key pressed). A real browser submits
    // the enclosing form on an unhandled Enter in a single-line text input;
    // jsdom does not simulate that implicit submission, so this pins the
    // component's half of the contract directly: it must not intercept the
    // keypress (`preventDefault`) or Pick, leaving Enter free to bubble as a
    // submit exactly like the AI-search suite's `fireEvent.click` on Search.
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={ROWS}
        searchEnabled
      />,
    );

    fireEvent.change(searchInput(), { target: { value: "Apple" } });
    const notPrevented = fireEvent.keyDown(searchInput(), { key: "Enter" });

    expect(notPrevented).toBe(true);
    expect(mockedPick).not.toHaveBeenCalled();
  });

  it("Picks the highlighted Option on Enter", async () => {
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={ROWS}
        searchEnabled
      />,
    );

    fireEvent.change(searchInput(), { target: { value: "Apple" } });
    fireEvent.keyDown(searchInput(), { key: "ArrowDown" });
    fireEvent.keyDown(searchInput(), { key: "Enter" });

    await waitFor(() => {
      expect(mockedPick).toHaveBeenCalledWith("o1", undefined);
    });
    expect(mockedAiSearch).not.toHaveBeenCalled();
  });

  it("ArrowUp from the first row returns to nothing highlighted", () => {
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={ROWS}
        searchEnabled
      />,
    );

    fireEvent.change(searchInput(), { target: { value: "Apple" } });
    fireEvent.keyDown(searchInput(), { key: "ArrowDown" });
    expect(searchInput().getAttribute("aria-activedescendant")).not.toBeNull();

    fireEvent.keyDown(searchInput(), { key: "ArrowUp" });
    expect(searchInput().getAttribute("aria-activedescendant")).toBeNull();
    const notPrevented = fireEvent.keyDown(searchInput(), { key: "Enter" });
    expect(notPrevented).toBe(true);
    expect(mockedPick).not.toHaveBeenCalled();
  });
});

describe("TonightScreen — search typeahead widens to every active Option (issue 02)", () => {
  it("shows a Closed Option with a day-aware closed note", () => {
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={ROWS}
        closedTonight={[row("o9", "Aji Ichi")]}
        searchEnabled
      />,
    );
    fireEvent.change(searchInput(), { target: { value: "Aji" } });
    expect(screen.getAllByRole("option")[0].textContent).toContain(
      "closed Wednesdays",
    );
  });

  it("shows a Rejected Option with 'rejected tonight' when the Selected day is today", () => {
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={ROWS}
        rejectedRows={[row("o9", "Curry House")]}
        searchEnabled
      />,
    );
    fireEvent.change(searchInput(), { target: { value: "Curry" } });
    expect(screen.getAllByRole("option")[0].textContent).toContain(
      "rejected tonight",
    );
  });

  it("shows a Rejected Option's weekday name when the Selected day is not today", () => {
    render(
      <TonightScreen
        selectedDay="2026-05-22"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={ROWS}
        rejectedRows={[row("o9", "Curry House")]}
        searchEnabled
      />,
    );
    fireEvent.change(searchInput(), { target: { value: "Curry" } });
    expect(screen.getAllByRole("option")[0].textContent).toContain(
      `rejected ${weekdayName("2026-05-22")}`,
    );
  });

  it("shows a Picked Option as a non-selectable 'already picked' row that ↑/↓ skip", () => {
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[
          { entryId: "e9", row: row("o9", "Zed Diner"), note: null },
        ]}
        pickerRows={ROWS}
        searchEnabled
      />,
    );
    // The exact name, not a mere substring, so it is the sole candidate and
    // no trailing Add row (issue 03) interferes with this disabled-row check.
    fireEvent.change(searchInput(), { target: { value: "Zed Diner" } });
    const optionRow = screen.getAllByRole("option")[0];
    expect(optionRow.getAttribute("aria-disabled")).toBe("true");
    expect(optionRow.textContent).toContain("already picked");

    // ArrowDown must not land the highlight on the sole, disabled match.
    fireEvent.keyDown(searchInput(), { key: "ArrowDown" });
    expect(searchInput().getAttribute("aria-activedescendant")).toBeNull();
  });

  it("selecting a Closed row opens an inline confirm instead of Picking; Cancel leaves it unchanged", () => {
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={ROWS}
        closedTonight={[row("o9", "Aji Ichi")]}
        searchEnabled
      />,
    );
    fireEvent.change(searchInput(), { target: { value: "Aji" } });
    fireEvent.mouseDown(screen.getAllByRole("option")[0]);

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(mockedPick).not.toHaveBeenCalled();
    expect(screen.getByText(/is closed Wednesdays/)).toBeTruthy();
    const link = screen.getByRole("link", { name: "Aji Ichi" });
    expect(link.getAttribute("href")).toBe("/catalog/o9");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText(/is closed/)).toBeNull();
    expect(mockedPick).not.toHaveBeenCalled();
  });

  it("Pick anyway on a Closed row's confirm Picks it", async () => {
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={ROWS}
        closedTonight={[row("o9", "Aji Ichi")]}
        searchEnabled
      />,
    );
    fireEvent.change(searchInput(), { target: { value: "Aji" } });
    fireEvent.mouseDown(screen.getAllByRole("option")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Pick anyway" }));

    await waitFor(() => {
      expect(mockedPick).toHaveBeenCalledWith("o9", undefined);
    });
  });

  it("selecting a Rejected row's confirm names the Rejection and links the Option", () => {
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={ROWS}
        rejectedRows={[row("o9", "Curry House")]}
        searchEnabled
      />,
    );
    fireEvent.change(searchInput(), { target: { value: "Curry" } });
    fireEvent.mouseDown(screen.getAllByRole("option")[0]);

    expect(screen.getByText(/You rejected/)).toBeTruthy();
    const link = screen.getByRole("link", { name: "Curry House" });
    expect(link.getAttribute("href")).toBe("/catalog/o9");
  });

  it("Pick anyway on a Rejected row's confirm Picks it", async () => {
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={ROWS}
        rejectedRows={[row("o9", "Curry House")]}
        searchEnabled
      />,
    );
    fireEvent.change(searchInput(), { target: { value: "Curry" } });
    fireEvent.mouseDown(screen.getAllByRole("option")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Pick anyway" }));

    await waitFor(() => {
      expect(mockedPick).toHaveBeenCalledWith("o9", undefined);
    });
  });

  it("Picking an unsuppressed row from the widened candidates still Picks immediately", async () => {
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={ROWS}
        searchEnabled
      />,
    );
    fireEvent.change(searchInput(), { target: { value: "Apple" } });
    fireEvent.mouseDown(screen.getAllByRole("option")[0]);

    await waitFor(() => {
      expect(mockedPick).toHaveBeenCalledWith("o1", undefined);
    });
    expect(screen.queryByText(/Pick anyway/)).toBeNull();
  });

  it("clears an armed confirm when the query changes", () => {
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={ROWS}
        closedTonight={[row("o9", "Aji Ichi")]}
        searchEnabled
      />,
    );
    fireEvent.change(searchInput(), { target: { value: "Aji" } });
    fireEvent.mouseDown(screen.getAllByRole("option")[0]);
    expect(screen.getByRole("button", { name: "Pick anyway" })).toBeTruthy();

    fireEvent.change(searchInput(), { target: { value: "Aj" } });
    expect(screen.queryByRole("button", { name: "Pick anyway" })).toBeNull();
  });

  it("clears an armed confirm when the Selected day changes", () => {
    const props = {
      todaySql: "2026-05-20",
      tonightsDinner: [],
      pickerRows: ROWS,
      closedTonight: [row("o9", "Aji Ichi")],
      searchEnabled: true,
    };
    const { rerender } = render(
      <TonightScreen {...props} selectedDay="2026-05-20" />,
    );
    fireEvent.change(searchInput(), { target: { value: "Aji" } });
    fireEvent.mouseDown(screen.getAllByRole("option")[0]);
    expect(screen.getByText(/is closed Wednesdays/)).toBeTruthy();

    rerender(<TonightScreen {...props} selectedDay="2026-05-21" />);
    expect(screen.queryByText(/is closed/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Pick anyway" })).toBeNull();
  });
});

describe("TonightScreen — Add row and inline quick-add form (issue 03)", () => {
  it("shows only the Add row for a name matching no active Option", () => {
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={ROWS}
        searchEnabled
      />,
    );
    fireEvent.change(searchInput(), { target: { value: "Pizza Place" } });
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toContain("Add “Pizza Place”…");
  });

  it("shows a substring match and the Add row last", () => {
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={[...ROWS, row("o5", "Thai Orchid")]}
        searchEnabled
      />,
    );
    fireEvent.change(searchInput(), { target: { value: "Thai" } });
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0].textContent).toContain("Thai Orchid");
    expect(options[1].textContent).toContain("Add “Thai”…");
  });

  it("shows no Add row for an exact existing name, any case", () => {
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={ROWS}
        searchEnabled
      />,
    );
    fireEvent.change(searchInput(), { target: { value: "apple crumble" } });
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0].textContent).not.toContain("Add ");
  });

  // Like "leaves Enter unhandled…" above: jsdom has no implicit submit, so
  // this pins only the half that lets the form's own submit run AI search.
  it("leaves Enter unhandled with nothing highlighted, even with the Add row shown", () => {
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={ROWS}
        searchEnabled
      />,
    );
    fireEvent.change(searchInput(), { target: { value: "Pizza Place" } });
    const notPrevented = fireEvent.keyDown(searchInput(), { key: "Enter" });
    expect(notPrevented).toBe(true);
    expect(mockedCreate).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Restaurant name")).toBeNull();
  });

  it("is reachable via ArrowDown and Enter", () => {
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={ROWS}
        searchEnabled
      />,
    );
    fireEvent.change(searchInput(), { target: { value: "Pizza Place" } });
    fireEvent.keyDown(searchInput(), { key: "ArrowDown" });
    fireEvent.keyDown(searchInput(), { key: "Enter" });
    expect(screen.getByLabelText("Restaurant name")).toBeTruthy();
  });

  it("selecting the Add row opens the inline form prefilled with the name, kind Restaurant, switchable to Home meal", () => {
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={ROWS}
        searchEnabled
      />,
    );
    fireEvent.change(searchInput(), { target: { value: "Pizza Place" } });
    fireEvent.mouseDown(screen.getAllByRole("option")[0]);

    expect(screen.queryByRole("listbox")).toBeNull();
    const nameField = screen.getByLabelText("Restaurant name") as HTMLInputElement;
    expect(nameField.value).toBe("Pizza Place");
    expect(
      screen.getByRole("button", { name: "Restaurant" }).getAttribute("aria-pressed"),
    ).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Home meal" }));
    expect(screen.getByLabelText("Meal name")).toBeTruthy();
  });

  it("Cancel closes the form and keeps the query", () => {
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={ROWS}
        searchEnabled
      />,
    );
    fireEvent.change(searchInput(), { target: { value: "Pizza Place" } });
    fireEvent.mouseDown(screen.getAllByRole("option")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Restaurant name")).toBeNull();
    expect(searchInput().value).toBe("Pizza Place");
  });

  it("Add & Pick creates the Option and Picks it for the Selected day, with a day-aware label — including a past Selected day", async () => {
    render(
      <TonightScreen
        selectedDay="2026-05-18"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={ROWS}
        searchEnabled
      />,
    );
    fireEvent.change(searchInput(), { target: { value: "Pizza Place" } });
    fireEvent.mouseDown(screen.getAllByRole("option")[0]);

    const dayLabel = weekdayName("2026-05-18");
    fireEvent.click(
      screen.getByRole("button", { name: `Add & Pick for ${dayLabel}` }),
    );

    await waitFor(() => {
      expect(mockedCreate).toHaveBeenCalledWith(
        "restaurant",
        expect.objectContaining({ name: "Pizza Place" }),
      );
      expect(mockedPick).toHaveBeenCalledWith("new-id", "2026-05-18");
    });
  });

  it("Add creates the Option without Picking it", async () => {
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={ROWS}
        searchEnabled
      />,
    );
    fireEvent.change(searchInput(), { target: { value: "Pizza Place" } });
    fireEvent.mouseDown(screen.getAllByRole("option")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(mockedCreate).toHaveBeenCalled();
    });
    expect(mockedPick).not.toHaveBeenCalled();
  });

  it("a failed Pick after a successful add shows the error and offers no retry", async () => {
    mockedPick.mockResolvedValueOnce({ ok: false, error: "Pick failed" });
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={ROWS}
        searchEnabled
      />,
    );
    fireEvent.change(searchInput(), { target: { value: "Pizza Place" } });
    fireEvent.mouseDown(screen.getAllByRole("option")[0]);
    fireEvent.click(
      screen.getByRole("button", { name: "Add & Pick for tonight" }),
    );

    await waitFor(() => {
      expect(screen.getByText(/Added, but couldn’t Pick it: Pick failed/)).toBeTruthy();
    });
    expect(mockedCreate).toHaveBeenCalledTimes(1);
    expect(mockedPick).toHaveBeenCalledTimes(1);

    // Both submits stay disabled — submitting again would create a duplicate
    // Option — and Cancel becomes Close, since the Option already exists.
    // `waitFor`: React 19 keeps `isPending` true a render past the error.
    const close = await screen.findByRole("button", { name: "Close" });
    await waitFor(() => {
      expect((close as HTMLButtonElement).disabled).toBe(false);
    });
    expect(
      (screen.getByRole("button", { name: "Add & Pick for tonight" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Add" }) as HTMLButtonElement).disabled,
    ).toBe(true);

    fireEvent.click(close);
    expect(screen.queryByLabelText("Restaurant name")).toBeNull();
  });

  it("shows a warning linking to the detail page when the name matches an Archived Option", () => {
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={ROWS}
        quickAddSources={{
          allTags: [],
          placesEnabled: false,
          archivedOptions: [{ id: "a1", name: "Aji Ichi" }],
        }}
        searchEnabled
      />,
    );
    fireEvent.change(searchInput(), { target: { value: "Aji Ichi" } });
    fireEvent.mouseDown(screen.getAllByRole("option")[0]);

    expect(screen.getByText(/is archived/)).toBeTruthy();
    const link = screen.getByRole("link", { name: "Aji Ichi" });
    expect(link.getAttribute("href")).toBe("/catalog/a1");
  });
});

describe("TonightScreen — Remove from Tonight's dinner", () => {
  it("gives every decided-block row a Remove control", () => {
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
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
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
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
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
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
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
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
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
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
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={DINNER}
        pickerRows={ROWS}
        searchEnabled={false}
      />,
    );
    // No collapse toggle: the picker is on screen straight away, under an
    // "Add another option" divider — unlabeled on screen, named only for
    // assistive tech.
    expect(
      screen.queryByRole("button", { name: "Add another option" }),
    ).toBeNull();
    expect(
      screen.getByRole("region", { name: "Add another option" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("group", { name: "Filter by kind" }),
    ).toBeTruthy();
  });

  it("shows the all-picked message when nothing is left to pick", () => {
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
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

describe("TonightScreen — Last note", () => {
  // Apple Crumble has a Last note; Banana Bread deliberately has none, so every
  // test here also asserts the no-note row stays bare.
  const LAST_NOTES = new Map<string, LastNote>([
    ["o1", { text: "got the katsu curry", daysAgo: 18 }],
  ]);

  it("shows the note with its age on a picker row, and nothing on a row without one", () => {
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={ROWS}
        lastNotes={LAST_NOTES}
        searchEnabled={false}
      />,
    );

    const note = screen.getByRole("button", {
      name: "Last note, 18d ago: got the katsu curry",
    });
    expect(note.textContent).toBe("18d · got the katsu curry");
    // One note line on the screen: the Option with no Last note renders none.
    expect(screen.getAllByRole("button", { name: /^Last note,/ })).toHaveLength(
      1,
    );
  });

  it("renders no note line at all when no Option has one", () => {
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={ROWS}
        searchEnabled={false}
      />,
    );
    expect(screen.queryByRole("button", { name: /^Last note,/ })).toBeNull();
  });

  it("unclamps the picker note on tap and re-clamps on a second tap", () => {
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={ROWS}
        lastNotes={LAST_NOTES}
        searchEnabled={false}
      />,
    );

    const note = screen.getByRole("button", { name: /^Last note,/ });
    // Collapsed: held to one line, with the full text on hover. jsdom does no
    // layout, so the utility is the only observable proxy for "one line" — and
    // it must be `truncate`, not `line-clamp-1`: a clamp needs
    // `display: -webkit-box`, which a <button> blockifies away, so a clamped
    // note wraps to a second line in a real browser (see `LastNoteLine`).
    expect(note.className).toContain("truncate");
    expect(note.className).not.toContain("line-clamp");
    expect(note.getAttribute("title")).toBe("got the katsu curry");
    expect(note.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(note);
    expect(note.className).not.toContain("truncate");
    expect(note.className).toContain("whitespace-normal");
    expect(note.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(note);
    expect(note.className).toContain("truncate");
    expect(note.getAttribute("aria-expanded")).toBe("false");
  });

  it("omits the Last note on an AI result row, showing only the AI rationale", async () => {
    mockedAiSearch.mockResolvedValue({
      ok: true,
      results: [{ id: "o1", reason: "Light and quick" }],
    });

    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={ROWS}
        lastNotes={LAST_NOTES}
        searchEnabled
      />,
    );
    await submitSearchAndSettle();

    // An AI row already carries the model's own rationale line; stacking the
    // Last note above it read as too busy (DESIGN.md, "Last note line").
    expect(screen.getByText("Light and quick")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Last note,/ })).toBeNull();
  });

  it("shows the note in full on a decided row, labelled and inert", () => {
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={DINNER}
        pickerRows={[]}
        lastNotes={LAST_NOTES}
        searchEnabled={false}
      />,
    );

    // Labelled "Last time", not clamped, and not a control — the decided row's
    // only note affordance is the editable one below it.
    // The label is its own span, so read the whole line it sits in.
    const line = screen.getByText(/Last time \(/).closest("p");
    expect(line?.textContent).toContain("18d");
    expect(line?.textContent).toContain("got the katsu curry");
    expect(screen.queryByRole("button", { name: /^Last note,/ })).toBeNull();
  });

  it("hides the decided row's Last note while its note editor is open", () => {
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={DINNER}
        pickerRows={[]}
        lastNotes={LAST_NOTES}
        searchEnabled={false}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Add note" })[0]);
    expect(screen.queryByText(/Last time \(/)).toBeNull();
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
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
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
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
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
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={DINNER}
        pickerRows={ROWS}
        searchEnabled={false}
      />,
    );
    rerender(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
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
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[DINNER[0]]}
        pickerRows={ROWS}
        searchEnabled={false}
      />,
    );
    rerender(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={DINNER}
        pickerRows={ROWS}
        searchEnabled={false}
      />,
    );
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
  });
});

describe("TonightScreen — Closed disclosure", () => {
  it("renders below the Rejected disclosure, collapsed by default, with a day-aware heading", () => {
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={ROWS}
        searchEnabled={false}
        rejectedTonight={[
          { id: "r1", optionId: "o3", optionName: "Curry House", reason: null },
        ]}
        closedTonight={[row("o4", "Zed Diner"), row("o5", "Aji Ichi")]}
      />,
    );

    const rejectedButton = screen.getByRole("button", {
      name: /^Rejected tonight/,
    });
    const closedButton = screen.getByRole("button", {
      name: "Closed tonight (2)",
    });
    // Closed sits after Rejected in document order — Rejected keeps the
    // closer position because it holds the time-sensitive undo.
    expect(
      rejectedButton.compareDocumentPosition(closedButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // Collapsed by default — no closed-row names on screen yet.
    expect(screen.queryByText("Zed Diner")).toBeNull();
    expect(closedButton.getAttribute("aria-expanded")).toBe("false");
  });

  it("links each Rejected and Closed Option name to its detail page", () => {
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={ROWS}
        searchEnabled={false}
        rejectedTonight={[
          { id: "r1", optionId: "o3", optionName: "Curry House", reason: null },
        ]}
        closedTonight={[row("o4", "Zed Diner")]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Rejected tonight/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Closed tonight/ }));

    expect(
      screen.getByRole("link", { name: "Curry House" }).getAttribute("href"),
    ).toBe("/catalog/o3");
    expect(
      screen.getByRole("link", { name: "Zed Diner" }).getAttribute("href"),
    ).toBe("/catalog/o4");
  });

  it("expands to show alphabetically-ordered rows with full Pick/Reject controls and an empty rank gutter", () => {
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={ROWS}
        searchEnabled={false}
        closedTonight={[row("o4", "Aji Ichi"), row("o5", "Zed Diner")]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Closed tonight (2)" }),
    );

    expect(screen.getByText("Aji Ichi")).toBeTruthy();
    expect(screen.getByText("Zed Diner")).toBeTruthy();
    // Each row still carries the full picker controls: the two ranked
    // ROWS above plus the two closed rows.
    expect(screen.getAllByRole("button", { name: "Pick" })).toHaveLength(4);
    expect(screen.getAllByRole("button", { name: "Reject" })).toHaveLength(4);

    // No rank numeral on a closed row — the `w-6` gutter renders, empty.
    const li = screen.getByText("Aji Ichi").closest("li");
    const rankGutter = li?.querySelector(".w-6");
    expect(rankGutter?.textContent).toBe("");
  });

  it("names the heading after the Selected day's weekday when it is not today", () => {
    render(
      <TonightScreen
        selectedDay="2026-05-22"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={ROWS}
        searchEnabled={false}
        closedTonight={[row("o4", "Aji Ichi")]}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Closed on Friday (1)" }),
    ).toBeTruthy();
  });

  it("stays absent from the screen when nothing is closed for the Selected day", () => {
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={ROWS}
        searchEnabled={false}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /^Closed/ }),
    ).toBeNull();
  });
});

describe("TonightScreen — empty-picker copy", () => {
  it("stays honest when the list was emptied by closures alone, with no Rejection claim", () => {
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={[]}
        allFiltered
        searchEnabled={false}
        closedTonight={[row("o1", "Apple Crumble")]}
      />,
    );
    expect(
      screen.getByText(/No Options are available for tonight/),
    ).toBeTruthy();
    expect(screen.queryByText(/rejected/i)).toBeNull();
  });

  it("still distinguishes a genuinely empty Catalog from an all-filtered one", () => {
    render(
      <TonightScreen
        selectedDay="2026-05-20"
        todaySql="2026-05-20"
        tonightsDinner={[]}
        pickerRows={[]}
        searchEnabled={false}
      />,
    );
    // `allFiltered` defaults to false, so an empty `pickerRows` with nothing
    // filtered reads as an empty Catalog, not the all-filtered copy.
    expect(screen.getByText(/Your Catalog is empty\./)).toBeTruthy();
    expect(
      screen.queryByText(/No Options are available for/),
    ).toBeNull();
  });
});
