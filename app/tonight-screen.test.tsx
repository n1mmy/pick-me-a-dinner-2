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
import { shiftSqlDate, weekdayName } from "../lib/local-day";
import {
  tonightForDay,
  type TonightDayOption,
  type TonightView,
} from "../lib/tonight-day";

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
// The Day note line's one write (PRD: Day notes) — stubbed so the screen
// never pulls in the database client, and so a save can be asserted on it.
vi.mock("./day-note-actions", () => ({
  setDayNote: vi.fn(async () => ({ ok: true })),
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
import { setDayNote } from "./day-note-actions";
import { TonightScreen } from "./tonight-screen";

const mockedAiSearch = vi.mocked(aiSearchAction);
const mockedDelete = vi.mocked(deleteLogEntry);
const mockedPick = vi.mocked(pickTonight);
const mockedCreate = vi.mocked(createOption);
const mockedSetDayNote = vi.mocked(setDayNote);

/**
 * An active Catalog Option, Home unless a test says otherwise. `tags` are the
 * Option's Tags, which drive the Tag filter chips in the filter zone. Options
 * are identified in assertions by name (digit-free, so a whole-string text
 * match is safe).
 */
function option(
  id: string,
  name: string,
  tags: string[] = [],
  more: Partial<Pick<TonightDayOption, "kind" | "closedDays">> = {},
): TonightDayOption {
  return {
    id,
    name,
    kind: "home",
    tags,
    url: null,
    phone: null,
    closedDays: [],
    ...more,
  };
}

const OPTIONS: TonightDayOption[] = [
  option("o1", "Apple Crumble"),
  option("o2", "Banana Bread"),
];

const CHERRY = option("o3", "Cherry Pie");

// Options that carry a Tag, so the filter zone renders the Tag filter chips
// alongside the kind segment.
const TAGGED_OPTIONS: TonightDayOption[] = [
  option("o1", "Apple Crumble", ["dessert"]),
  option("o2", "Banana Bread", ["dessert"]),
];

/** 2026-05-20, a Wednesday — the default Selected day and today. */
const TODAY = "2026-05-20";

/**
 * The screen's input, built as the page builds it: through `tonightForDay`
 * from the Catalog and the Selected day's Log and Rejections.
 *
 * - `picks`: Option ids Picked on the day, in order — Log entries `e1`, `e2`, …
 * - `rejections`: Rejections dated the day, newest first — ids `r1`, `r2`, …
 * - `notes`: noted Log entries `daysAgo` days before the day, for Last notes.
 */
function tonight({
  options = [],
  picks = [],
  rejections = [],
  notes = [],
  day = TODAY,
  today = TODAY,
  dayNote = null,
}: {
  options?: TonightDayOption[];
  picks?: string[];
  rejections?: { optionId: string; reason?: string }[];
  notes?: { optionId: string; daysAgo: number; note: string }[];
  day?: string;
  today?: string;
  dayNote?: string | null;
} = {}): TonightView {
  const dayEntries = picks.map((optionId, index) => ({
    id: `e${index + 1}`,
    optionId,
    createdAt: new Date(Date.UTC(2026, 0, 1, 18, index)),
    note: null,
  }));
  return tonightForDay({
    options,
    logEntries: [
      ...notes.map(({ optionId, daysAgo, note }) => ({
        optionId,
        eatenOn: shiftSqlDate(day, -daysAgo),
        createdAt: new Date(Date.UTC(2026, 0, 1)),
        note,
      })),
      ...dayEntries.map(({ optionId, createdAt }) => ({
        optionId,
        eatenOn: day,
        createdAt,
        note: null,
      })),
    ],
    dayEntries,
    rejections: rejections.map(({ optionId, reason }, index) => ({
      id: `r${index + 1}`,
      optionId,
      reason: reason ?? null,
    })),
    selectedDay: day,
    today,
    dayNote,
  });
}

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

    render(<TonightScreen view={tonight({ options: OPTIONS })} searchEnabled />);
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
        view={tonight({ day: "2026-05-22", options: OPTIONS })}
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
      <TonightScreen view={tonight({ options: OPTIONS })} searchEnabled />,
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
    render(<TonightScreen view={tonight({ options: OPTIONS })} searchEnabled />);

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

    render(<TonightScreen view={tonight({ options: OPTIONS })} searchEnabled />);
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

    render(<TonightScreen view={tonight({ options: OPTIONS })} searchEnabled />);
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

    render(<TonightScreen view={tonight({ options: OPTIONS })} searchEnabled />);
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

    render(<TonightScreen view={tonight({ options: OPTIONS })} searchEnabled />);
    await submitSearchAndSettle();
    await screen.findByText("Search unavailable — try again");

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

    await waitFor(() => {
      expect(
        screen.queryByText("Search unavailable — try again"),
      ).toBeNull();
    });
  });

  it("keeps the filter zone while an AI result is shown", async () => {
    mockedAiSearch.mockResolvedValue({
      ok: true,
      results: [{ id: "o2", reason: "Light and quick" }],
    });

    render(<TonightScreen
        view={tonight({ options: TAGGED_OPTIONS })}
        searchEnabled
      />);
    await submitSearchAndSettle();
    await screen.findByText("Light and quick");

    expect(screen.getByRole("group", { name: "Filter by kind" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Filter by tag" })).toBeTruthy();
  });

  it("never disables the search box in flight, and keeps the deterministic list visible", async () => {
    // A deferred result lets the test observe the in-flight state.
    let resolveSearch: (result: AiSearchResult) => void = () => {};
    mockedAiSearch.mockReturnValue(
      new Promise<AiSearchResult>((resolve) => {
        resolveSearch = resolve;
      }),
    );

    render(<TonightScreen view={tonight({ options: OPTIONS })} searchEnabled />);
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

    render(<TonightScreen view={tonight({ options: OPTIONS })} searchEnabled />);

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
    // Tonight's dinner and picker. The AI search never resolves in
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
      <TonightScreen view={tonight({ options: OPTIONS })} searchEnabled />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByRole("button", { name: /^Cancel search/ });

    fireEvent.click(screen.getAllByRole("button", { name: "Pick" })[0]);
    await waitFor(() => {
      expect(mockedPick).toHaveBeenCalledWith("o1", undefined);
    });

    // The revalidated props Next's router would hand back: o1 moved into
    // Tonight's dinner, dropped out of the picker — applied in a transition,
    // as the router applies them.
    startTransition(() => {
      rerender(
        <TonightScreen
          view={tonight({ options: OPTIONS, picks: ["o1"] })}
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

    render(<TonightScreen view={tonight({ options: OPTIONS })} searchEnabled />);
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

    render(<TonightScreen view={tonight({ options: OPTIONS })} searchEnabled />);
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

    render(<TonightScreen view={tonight({ options: OPTIONS })} searchEnabled />);
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
    render(<TonightScreen
        view={tonight({ options: OPTIONS })}
        searchEnabled={false}
      />);

    expect(screen.queryByLabelText("Find a dinner by name, or describe a craving")).toBeNull();
    expect(screen.queryByRole("button", { name: "Search" })).toBeNull();

    // The deterministic list and its filter zone remain — v1 is unaffected.
    expect(screen.getByText("Apple Crumble")).toBeTruthy();
    expect(
      screen.queryByRole("group", { name: "Filter by kind" }),
    ).toBeTruthy();
  });

  it("keeps the AI result on screen when a Pick flips picker → decided mode", async () => {
    // A Pick today drops the Picked Option from the picker and grows
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
        view={tonight({ options: OPTIONS })}
        searchEnabled
      />,
    );
    await submitSearchAndSettle();
    await screen.findByText("Sweet and quick");
    await screen.findByText("Light and quick");

    // A Pick on `o1`: the server revalidates, `tonightsDinner` now carries
    // the Picked Option and the picker no longer does. The screen flips
    // into decided mode under the new section wrapper.
    rerender(
      <TonightScreen
        view={tonight({ options: OPTIONS, picks: ["o1"] })}
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
    // AI list because it left the picker.
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
      <TonightScreen view={tonight({ options: OPTIONS })} searchEnabled />,
    );
    fireEvent.change(searchInput(), { target: { value: "something light" } });
    await submitSearchAndSettle();
    await screen.findByText("Light and quick");

    // Step to Friday, where o1 is rejected or closed and so not in the rows.
    rerender(
      <TonightScreen
        view={tonight({ day: "2026-05-22", options: [OPTIONS[1]] })}
        searchEnabled
      />,
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
      <TonightScreen view={tonight({ options: OPTIONS })} searchEnabled />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByRole("button", { name: /^Cancel search/ });

    rerender(
      <TonightScreen
        view={tonight({ day: "2026-05-22", options: OPTIONS })}
        searchEnabled
      />,
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
      <TonightScreen view={tonight({ options: OPTIONS })} searchEnabled />,
    );
    await submitSearchAndSettle();
    await screen.findByRole("button", { name: /^Search complete/ });

    rerender(
      <TonightScreen
        view={tonight({ day: "2026-05-22", picks: ["o1"], options: OPTIONS })}
        searchEnabled
      />,
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
      <TonightScreen view={tonight({ options: OPTIONS })} searchEnabled />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(
      screen.getByRole("button", { name: "Cancel search — 0 seconds elapsed" }),
    ).toBeTruthy();

    // Seven seconds in, step to a day that already has a Pick.
    now.mockReturnValue(1_007_000);
    rerender(
      <TonightScreen
        view={tonight({ day: "2026-05-22", picks: ["o1"], options: OPTIONS })}
        searchEnabled
      />,
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
        view={tonight({ options: OPTIONS })}
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
        view={tonight({ options: OPTIONS })}
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
        view={tonight({ options: OPTIONS })}
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
        view={tonight({ options: OPTIONS })}
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
  // Closed on Wednesdays — the default Selected day.
  const AJI_ICHI = option("o9", "Aji Ichi", [], {
    kind: "restaurant",
    closedDays: [3],
  });
  const CURRY_HOUSE = option("o9", "Curry House");

  it("shows a Closed Option with a day-aware closed note", () => {
    render(
      <TonightScreen
        view={tonight({ options: [...OPTIONS, AJI_ICHI] })}
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
        view={tonight({
          options: [...OPTIONS, CURRY_HOUSE],
          rejections: [{ optionId: "o9" }],
        })}
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
        view={tonight({
          day: "2026-05-22",
          options: [...OPTIONS, CURRY_HOUSE],
          rejections: [{ optionId: "o9" }],
        })}
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
        view={tonight({
          options: [...OPTIONS, option("o9", "Zed Diner")],
          picks: ["o9"],
        })}
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
        view={tonight({ options: [...OPTIONS, AJI_ICHI] })}
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
        view={tonight({ options: [...OPTIONS, AJI_ICHI] })}
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
        view={tonight({
          options: [...OPTIONS, CURRY_HOUSE],
          rejections: [{ optionId: "o9" }],
        })}
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
        view={tonight({
          options: [...OPTIONS, CURRY_HOUSE],
          rejections: [{ optionId: "o9" }],
        })}
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
        view={tonight({ options: OPTIONS })}
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
        view={tonight({ options: [...OPTIONS, AJI_ICHI] })}
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
    const options = [...OPTIONS, AJI_ICHI];
    const { rerender } = render(
      <TonightScreen view={tonight({ options })} searchEnabled />,
    );
    fireEvent.change(searchInput(), { target: { value: "Aji" } });
    fireEvent.mouseDown(screen.getAllByRole("option")[0]);
    expect(screen.getByText(/is closed Wednesdays/)).toBeTruthy();

    // Thursday: Aji Ichi is open, so the confirm has nothing to stand on.
    rerender(
      <TonightScreen
        view={tonight({ day: "2026-05-21", options })}
        searchEnabled
      />,
    );
    expect(screen.queryByText(/is closed/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Pick anyway" })).toBeNull();
  });
});

describe("TonightScreen — Add row and inline quick-add form (issue 03)", () => {
  it("shows only the Add row for a name matching no active Option", () => {
    render(
      <TonightScreen
        view={tonight({ options: OPTIONS })}
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
        view={tonight({ options: [...OPTIONS, option("o5", "Thai Orchid")] })}
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
        view={tonight({ options: OPTIONS })}
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
        view={tonight({ options: OPTIONS })}
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
        view={tonight({ options: OPTIONS })}
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
        view={tonight({ options: OPTIONS })}
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
        view={tonight({ options: OPTIONS })}
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
        view={tonight({ day: "2026-05-18", options: OPTIONS })}
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
        view={tonight({ options: OPTIONS })}
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

  it.each([
    ["Add & Pick for tonight"],
    ["Add"],
  ])("%s clears the query and closes the form once saved", async (button) => {
    render(
      <TonightScreen
        view={tonight({ options: OPTIONS })}
        searchEnabled
      />,
    );
    fireEvent.change(searchInput(), { target: { value: "Pizza Place" } });
    fireEvent.mouseDown(screen.getAllByRole("option")[0]);
    fireEvent.click(screen.getByRole("button", { name: button }));

    // The form holds "Saved ✓" for 700ms before handing off.
    await waitFor(
      () => {
        expect(screen.queryByLabelText("Restaurant name")).toBeNull();
      },
      { timeout: 2000 },
    );
    expect(searchInput().value).toBe("");
  });

  it("a failed Pick after a successful add shows the error and offers no retry", async () => {
    mockedPick.mockResolvedValueOnce({ ok: false, error: "Pick failed" });
    render(
      <TonightScreen
        view={tonight({ options: OPTIONS })}
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
          view={tonight({ options: OPTIONS })}
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
        view={tonight({ options: OPTIONS, picks: ["o1", "o2"] })}
        searchEnabled={false}
      />,
    );
    // One Remove control per Picked Option.
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(2);
  });

  it("asks for an inline confirm before deleting today's Log entry", () => {
    render(
      <TonightScreen
        view={tonight({ options: OPTIONS, picks: ["o1", "o2"] })}
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
        view={tonight({ options: OPTIONS, picks: ["o1", "o2"] })}
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
        view={tonight({ picks: ["o1", "o2"], options: [...OPTIONS, CHERRY] })}
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
        view={tonight({ options: OPTIONS })}
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
        view={tonight({ picks: ["o1", "o2"], options: [...OPTIONS, CHERRY] })}
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
        view={tonight({ options: OPTIONS, picks: ["o1", "o2"] })}
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

describe("TonightScreen — Reject box", () => {
  it("sets aria-controls only while the reason box is rendered", () => {
    render(
      <TonightScreen view={tonight({ options: OPTIONS })} searchEnabled={false} />,
    );
    const reject = screen.getAllByRole("button", { name: "Reject" })[0];
    expect(reject.hasAttribute("aria-controls")).toBe(false);

    fireEvent.click(reject);
    const boxId = reject.getAttribute("aria-controls");
    expect(boxId).toMatch(/^reject-box-/);
    expect(document.getElementById(boxId ?? "")?.tagName).toBe("FORM");
  });

  it("hands focus back to Reject when the box closes by Escape or Cancel", () => {
    render(
      <TonightScreen view={tonight({ options: OPTIONS })} searchEnabled={false} />,
    );
    const reject = screen.getAllByRole("button", { name: "Reject" })[0];

    fireEvent.click(reject);
    const field = document.querySelector<HTMLInputElement>(
      `#${reject.getAttribute("aria-controls")} input`,
    );
    field?.focus();
    fireEvent.keyDown(field!, { key: "Escape" });
    expect(reject.hasAttribute("aria-controls")).toBe(false);
    expect(document.activeElement).toBe(reject);

    fireEvent.click(reject);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(reject.hasAttribute("aria-controls")).toBe(false);
    expect(document.activeElement).toBe(reject);
  });
});

describe("TonightScreen — Last note", () => {
  // Apple Crumble has a Last note; Banana Bread deliberately has none, so every
  // test here also asserts the no-note row stays bare.
  const LAST_NOTES = [
    { optionId: "o1", daysAgo: 18, note: "got the katsu curry" },
  ];

  it("shows the note with its age on a picker row, and nothing on a row without one", () => {
    render(
      <TonightScreen
        view={tonight({ options: OPTIONS, notes: LAST_NOTES })}
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
        view={tonight({ options: OPTIONS })}
        searchEnabled={false}
      />,
    );
    expect(screen.queryByRole("button", { name: /^Last note,/ })).toBeNull();
  });

  it("unclamps the picker note on tap and re-clamps on a second tap", () => {
    render(
      <TonightScreen
        view={tonight({ options: OPTIONS, notes: LAST_NOTES })}
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

  it("keeps the Last note on an AI result row, above the AI rationale", async () => {
    mockedAiSearch.mockResolvedValue({
      ok: true,
      results: [
        { id: "o1", reason: "Light and quick" },
        { id: "o2", reason: "Sweet enough" },
      ],
    });

    render(
      <TonightScreen
        view={tonight({ options: OPTIONS, notes: LAST_NOTES })}
        searchEnabled
      />,
    );
    await submitSearchAndSettle();

    // As on every other view, so a row holds its height when the Household
    // switches between views (DESIGN.md, "Last note line").
    const appleRow = screen.getByText("Apple Crumble").closest("li") as HTMLElement;
    const note = within(appleRow).getByRole("button", {
      name: "Last note, 18d ago: got the katsu curry",
    });
    const reason = within(appleRow).getByText("Light and quick");
    expect(
      note.compareDocumentPosition(reason) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Last note,/ })).toHaveLength(1);
  });

  it("shows the note in full on a decided row, labelled and inert", () => {
    render(
      <TonightScreen
        view={tonight({ options: OPTIONS, picks: ["o1", "o2"], notes: LAST_NOTES })}
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
        view={tonight({ options: OPTIONS, picks: ["o1", "o2"], notes: LAST_NOTES })}
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
        view={tonight({ options: OPTIONS, picks: ["o1"] })}
        searchEnabled={false}
      />,
    );
    // Mount alone never scrolls — only a later growth in the count does.
    expect(scrollTo).not.toHaveBeenCalled();

    // A Pick revalidates the page with another Option in Tonight's dinner.
    rerender(
      <TonightScreen
        view={tonight({ picks: ["o1", "o2"], options: [...OPTIONS, CHERRY] })}
        searchEnabled={false}
      />,
    );
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("does not scroll when a Remove shrinks Tonight's dinner", () => {
    const scrollTo = stubScroll(false);
    const { rerender } = render(
      <TonightScreen
        view={tonight({ picks: ["o1", "o2"], options: [...OPTIONS, CHERRY] })}
        searchEnabled={false}
      />,
    );
    rerender(
      <TonightScreen
        view={tonight({ options: OPTIONS, picks: ["o1"] })}
        searchEnabled={false}
      />,
    );
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("honors prefers-reduced-motion with an instant jump", () => {
    const scrollTo = stubScroll(true);
    const { rerender } = render(
      <TonightScreen
        view={tonight({ options: OPTIONS, picks: ["o1"] })}
        searchEnabled={false}
      />,
    );
    rerender(
      <TonightScreen
        view={tonight({ picks: ["o1", "o2"], options: [...OPTIONS, CHERRY] })}
        searchEnabled={false}
      />,
    );
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
  });
});

describe("TonightScreen — Closed disclosure", () => {
  /** A Restaurant closed on Wednesdays — the default Selected day. */
  const closedWednesdays = (id: string, name: string) =>
    option(id, name, [], { kind: "restaurant", closedDays: [3] });

  it("renders below the Rejected disclosure, collapsed by default, with a day-aware heading", () => {
    render(
      <TonightScreen
        view={tonight({
          options: [
            ...OPTIONS,
            option("o3", "Curry House"),
            closedWednesdays("o4", "Zed Diner"),
            closedWednesdays("o5", "Aji Ichi"),
          ],
          rejections: [{ optionId: "o3" }],
        })}
        searchEnabled={false}
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
        view={tonight({
          options: [
            ...OPTIONS,
            option("o3", "Curry House"),
            closedWednesdays("o4", "Zed Diner"),
          ],
          rejections: [{ optionId: "o3" }],
        })}
        searchEnabled={false}
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
        view={tonight({
          // Zed first, so the disclosure's alphabetical order is its own.
          options: [
            ...OPTIONS,
            closedWednesdays("o5", "Zed Diner"),
            closedWednesdays("o4", "Aji Ichi"),
          ],
        })}
        searchEnabled={false}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Closed tonight (2)" }),
    );

    expect(screen.getByText("Aji Ichi")).toBeTruthy();
    expect(screen.getByText("Zed Diner")).toBeTruthy();
    // Each row still carries the full picker controls: the two ranked
    // Options above plus the two closed rows.
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
        view={tonight({
          day: "2026-05-22",
          options: [
            ...OPTIONS,
            option("o4", "Aji Ichi", [], { kind: "restaurant", closedDays: [5] }),
          ],
        })}
        searchEnabled={false}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Closed on Friday (1)" }),
    ).toBeTruthy();
  });

  it("stays absent from the screen when nothing is closed for the Selected day", () => {
    render(
      <TonightScreen
        view={tonight({ options: OPTIONS })}
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
        view={tonight({
          options: [option("o1", "Apple Crumble", [], { closedDays: [3] })],
        })}
        searchEnabled={false}
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
        view={tonight()}
        searchEnabled={false}
      />,
    );
    // No Options at all, so nothing was filtered: an empty Catalog, not the
    // all-filtered copy.
    expect(screen.getByText(/Your Catalog is empty\./)).toBeTruthy();
    expect(
      screen.queryByText(/No Options are available for/),
    ).toBeNull();
  });
});

describe("TonightScreen — Day note", () => {
  // Every Tonight mode: picker, decided, and every Option unavailable.
  const MODES: [string, Parameters<typeof tonight>[0]][] = [
    ["picker mode", { options: OPTIONS }],
    ["decided mode", { options: [...OPTIONS, CHERRY], picks: ["o1", "o2"] }],
    [
      "the all-filtered state",
      { options: OPTIONS, rejections: [{ optionId: "o1" }, { optionId: "o2" }] },
    ],
  ];

  it.each(MODES)("shows the Selected day's Day note in %s", (_, mode) => {
    render(
      <TonightScreen
        view={tonight({ ...mode, dayNote: "Jen won't be around" })}
        searchEnabled={false}
      />,
    );
    expect(screen.getByText("Jen won't be around")).toBeTruthy();
  });

  it.each([
    ["today", "2026-10-10", "+ Note for tonight"],
    ["another day", "2026-10-16", "+ Note for Friday"],
  ])(
    "offers a day-aware add button when %s has no Day note",
    (_, selectedDay, label) => {
      render(
        <TonightScreen
          view={tonight({ day: selectedDay, today: "2026-10-10", options: OPTIONS })}
          searchEnabled={false}
        />,
      );
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    },
  );

  it("edits the Day note in place and saves it for the Selected day", async () => {
    render(
      <TonightScreen
        view={tonight({ day: "2026-10-16", today: "2026-10-10", options: OPTIONS, dayNote: "Jen won't be around" })}
        searchEnabled={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Jen won't be around" }));
    const field = screen.getByLabelText("Note for Friday") as HTMLInputElement;
    expect(field.value).toBe("Jen won't be around");
    fireEvent.change(field, { target: { value: "Guests over" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockedSetDayNote).toHaveBeenCalledWith("2026-10-16", "Guests over");
    });
    // A successful save closes the editor; revalidation brings the new note.
    await waitFor(() => {
      expect(screen.queryByLabelText("Note for Friday")).toBeNull();
    });
  });

  it("adds a Day note for tonight from the absent-state button", async () => {
    render(
      <TonightScreen
        view={tonight({ day: "2026-10-10", today: "2026-10-10", options: OPTIONS })}
        searchEnabled={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "+ Note for tonight" }));
    fireEvent.change(screen.getByLabelText("Note for tonight"), {
      target: { value: "Late back from the airport" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockedSetDayNote).toHaveBeenCalledWith(
        "2026-10-10",
        "Late back from the airport",
      );
    });
  });

  it.each([
    ["Ctrl+Enter", { ctrlKey: true }],
    ["Cmd+Enter", { metaKey: true }],
  ])("saves the Day note on %s, like every other text field", async (_, mods) => {
    render(
      <TonightScreen
        view={tonight({ day: "2026-10-16", today: "2026-10-10", options: OPTIONS })}
        searchEnabled={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "+ Note for Friday" }));
    const field = screen.getByLabelText("Note for Friday");
    fireEvent.change(field, { target: { value: "Guests over" } });
    fireEvent.keyDown(field, { key: "Enter", ...mods });

    await waitFor(() => {
      expect(mockedSetDayNote).toHaveBeenCalledWith("2026-10-16", "Guests over");
    });
  });

  it("cancels an edit on Escape without saving", () => {
    render(
      <TonightScreen
        view={tonight({ day: "2026-10-16", today: "2026-10-10", options: OPTIONS, dayNote: "Jen won't be around" })}
        searchEnabled={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Jen won't be around" }));
    const field = screen.getByLabelText("Note for Friday");
    fireEvent.change(field, { target: { value: "Guests over" } });
    fireEvent.keyDown(field, { key: "Escape" });

    expect(screen.queryByLabelText("Note for Friday")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Jen won't be around" }),
    ).toBeTruthy();
    expect(mockedSetDayNote).not.toHaveBeenCalled();
  });
});


describe("TonightScreen — Prepared note", () => {
  // Three Options so the note can reorder them and leave one unnamed.
  const THREE: TonightDayOption[] = [
    option("o1", "Apple Crumble", ["dessert"]),
    option("o2", "Banana Bread", ["dessert"]),
    option("o3", "Cherry Pie", ["pie"]),
  ];
  const NOTE = {
    brief: "A quiet Thursday. Banana Bread fits the evening.",
    ranking: [
      { id: "o2", reason: "Quick, and nobody has had it this week." },
      { id: "o1", reason: "A fallback." },
    ],
    label: { prefix: "Prepared", time: "2:14pm" },
    outOfDate: false,
  };

  /** Option names in the order the list shows them. */
  function listedNames(): string[] {
    return within(screen.getAllByRole("list").at(-1) as HTMLElement)
      .getAllByRole("listitem")
      .map((item) => item.querySelector(".font-display")?.textContent ?? "");
  }

  it("shows the Prepared ranking on load, with its rationales, selected in the switcher", () => {
    render(
      <TonightScreen
        view={tonight({ day: "2026-10-22", today: "2026-10-22", options: THREE })}
        searchEnabled
        preparedNote={NOTE}
      />,
    );

    expect(listedNames()).toEqual(["Banana Bread", "Apple Crumble", "Cherry Pie"]);
    expect(screen.getByText("Quick, and nobody has had it this week.")).toBeTruthy();
    expect(segments().selected).toBe("Prepared");
  });

  it("keeps each row's Last note on the Prepared ranking, above its rationale", () => {
    render(
      <TonightScreen
        view={tonight({
          day: "2026-10-22",
          today: "2026-10-22",
          options: THREE,
          notes: [{ optionId: "o2", daysAgo: 9, note: "too dry last time" }],
        })}
        searchEnabled
        preparedNote={NOTE}
      />,
    );

    // The Prepared ranking is the default view, so dropping the Last note
    // there would hide every prior night's note on load.
    const bananaRow = screen.getByText("Banana Bread").closest("li") as HTMLElement;
    const note = within(bananaRow).getByRole("button", {
      name: "Last note, 9d ago: too dry last time",
    });
    const reason = within(bananaRow).getByText(
      "Quick, and nobody has had it this week.",
    );
    expect(
      note.compareDocumentPosition(reason) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Last note,/ })).toHaveLength(1);
  });

  /** The List view switcher's segment named `name`. */
  function segment(name: string): HTMLElement {
    return within(screen.getByRole("group", { name: "List view" })).getByRole(
      "button",
      { name },
    );
  }

  /** The List view switcher's segment names, and which one is selected. */
  function segments(): { names: string[]; selected: string | undefined } {
    const buttons = within(
      screen.getByRole("group", { name: "List view" }),
    ).getAllByRole("button");
    return {
      names: buttons.map((button) => button.textContent ?? ""),
      selected: buttons.find(
        (button) => button.getAttribute("aria-pressed") === "true",
      )?.textContent ?? undefined,
    };
  }

  it("switches to the Score ranking and back to the Prepared ranking", () => {
    render(
      <TonightScreen
        view={tonight({ day: "2026-10-22", today: "2026-10-22", options: THREE })}
        searchEnabled
        preparedNote={NOTE}
      />,
    );
    expect(segments()).toEqual({ names: ["Score", "Prepared"], selected: "Prepared" });

    fireEvent.click(segment("Score"));

    expect(segments().selected).toBe("Score");
    expect(listedNames()).toEqual(["Apple Crumble", "Banana Bread", "Cherry Pie"]);
    expect(screen.queryByText("Quick, and nobody has had it this week.")).toBeNull();

    fireEvent.click(segment("Prepared"));

    expect(segments().selected).toBe("Prepared");
    expect(listedNames()).toEqual(["Banana Bread", "Apple Crumble", "Cherry Pie"]);
    expect(screen.getByText("Quick, and nobody has had it this week.")).toBeTruthy();
  });

  it("adds a landed search to the switcher, and keeps it there while the Household looks elsewhere", async () => {
    mockedAiSearch.mockResolvedValue({
      ok: true,
      results: [{ id: "o3", reason: "Pie night" }],
    });
    render(
      <TonightScreen
        view={tonight({ day: "2026-10-22", today: "2026-10-22", options: THREE })}
        searchEnabled
        preparedNote={NOTE}
      />,
    );

    await submitSearchAndSettle();
    await screen.findByText("Pie night");
    expect(segments()).toEqual({
      names: ["Score", "Prepared", "AI search"],
      selected: "AI search",
    });

    fireEvent.click(segment("Score"));
    expect(listedNames()).toEqual(["Apple Crumble", "Banana Bread", "Cherry Pie"]);
    fireEvent.click(segment("Prepared"));
    expect(listedNames()).toEqual(["Banana Bread", "Apple Crumble", "Cherry Pie"]);

    fireEvent.click(segment("AI search"));
    expect(listedNames()).toEqual(["Cherry Pie"]);
    expect(screen.getByText("Pie night")).toBeTruthy();
    expect(mockedAiSearch).toHaveBeenCalledTimes(1);
  });

  it("offers Score and AI search on a day with no Prepared note", async () => {
    mockedAiSearch.mockResolvedValue({
      ok: true,
      results: [{ id: "o3", reason: "Pie night" }],
    });
    render(
      <TonightScreen
        view={tonight({ day: "2026-10-22", today: "2026-10-22", options: THREE })}
        searchEnabled
        preparedNote={null}
      />,
    );

    await submitSearchAndSettle();
    await screen.findByText("Pie night");

    expect(segments()).toEqual({ names: ["Score", "AI search"], selected: "AI search" });
  });

  it("leaves the list on the Household's view while a search runs, even one switched to meanwhile", async () => {
    let resolveSearch: (result: AiSearchResult) => void = () => {};
    mockedAiSearch.mockReturnValue(
      new Promise<AiSearchResult>((resolve) => {
        resolveSearch = resolve;
      }),
    );
    render(
      <TonightScreen
        view={tonight({ day: "2026-10-22", today: "2026-10-22", options: THREE })}
        searchEnabled
        preparedNote={NOTE}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByRole("button", { name: /^Cancel search/ });
    expect(segments()).toEqual({ names: ["Score", "Prepared"], selected: "Prepared" });
    fireEvent.click(segment("Score"));
    expect(listedNames()).toEqual(["Apple Crumble", "Banana Bread", "Cherry Pie"]);

    await act(async () => {
      resolveSearch({ ok: true, results: [{ id: "o3", reason: "Pie night" }] });
    });
    await waitForSearchSettled();
    expect(segments().selected).toBe("AI search");

    // The view the search replaced is the one switched to in flight.
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    await waitFor(() => {
      expect(segments().selected).toBe("Score");
    });
  });

  it("filters a landed AI result with the chips already on, each row keeping its number", async () => {
    mockedAiSearch.mockResolvedValue({
      ok: true,
      results: [
        { id: "o2", reason: "Bread first" },
        { id: "o3", reason: "Pie night" },
        { id: "o1", reason: "Crumble to finish" },
      ],
    });
    render(
      <TonightScreen
        view={tonight({ day: "2026-10-22", today: "2026-10-22", options: THREE })}
        searchEnabled
        preparedNote={NOTE}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "dessert, not filtered" }));

    await submitSearchAndSettle();
    await screen.findByText("Bread first");

    expect(segments().selected).toBe("AI search");
    expect(listedNames()).toEqual(["Banana Bread", "Apple Crumble"]);
    expect(rankShown("Apple Crumble")).toBe("3");
    // The chips are every active Option's Tags, not just the result's.
    expect(screen.getByRole("button", { name: "pie, not filtered" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "dessert, included" }));
    fireEvent.click(screen.getByRole("button", { name: "dessert, excluded" }));
    expect(listedNames()).toEqual(["Banana Bread", "Cherry Pie", "Apple Crumble"]);
  });

  it("says no Options match when the chips filter out a whole AI result", async () => {
    mockedAiSearch.mockResolvedValue({
      ok: true,
      results: [{ id: "o3", reason: "Pie night" }],
    });
    render(
      <TonightScreen
        view={tonight({ day: "2026-10-22", today: "2026-10-22", options: THREE })}
        searchEnabled
        preparedNote={NOTE}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "dessert, not filtered" }));

    await submitSearchAndSettle();

    expect(await screen.findByText("No Options match the current filter.")).toBeTruthy();
    expect(screen.queryByText("No Options fit that search.")).toBeNull();
  });

  it("switches nothing when a search fails", async () => {
    mockedAiSearch.mockResolvedValue({ ok: false });
    render(
      <TonightScreen
        view={tonight({ day: "2026-10-22", today: "2026-10-22", options: THREE })}
        searchEnabled
        preparedNote={NOTE}
      />,
    );
    fireEvent.click(segment("Score"));

    await submitSearchAndSettle();
    await screen.findByText("Search unavailable — try again");

    expect(segments()).toEqual({ names: ["Score", "Prepared"], selected: "Score" });
  });

  it("shows no switcher when the Score ranking is the only view", () => {
    render(
      <TonightScreen
        view={tonight({ day: "2026-10-22", today: "2026-10-22", options: THREE })}
        searchEnabled
        preparedNote={null}
      />,
    );

    expect(screen.queryByRole("group", { name: "List view" })).toBeNull();
    expect(listedNames()).toEqual(["Apple Crumble", "Banana Bread", "Cherry Pie"]);
  });

  it("keeps focus on the segment just chosen, so the Household can switch straight back", () => {
    render(
      <TonightScreen
        view={tonight({ day: "2026-10-22", today: "2026-10-22", options: THREE })}
        searchEnabled
        preparedNote={NOTE}
      />,
    );
    segment("Score").focus();

    fireEvent.click(segment("Score"));

    expect(document.activeElement).toBe(segment("Score"));
  });

  it("numbers a Claude result's rows by their place on screen", async () => {
    mockedAiSearch.mockResolvedValue({
      ok: true,
      results: [{ id: "o3", reason: "Pie night" }],
    });
    render(
      <TonightScreen
        view={tonight({ day: "2026-10-22", today: "2026-10-22", options: THREE })}
        searchEnabled
        preparedNote={NOTE}
      />,
    );

    await submitSearchAndSettle();
    await screen.findByText("Pie night");

    expect(listedNames()).toEqual(["Cherry Pie"]);
    expect(
      screen.getByText("Cherry Pie").closest("li")?.querySelector(".w-6")?.textContent,
    ).toBe("1");
  });

  it.each([
    ["the Prepared ranking", "Prepared", ["Banana Bread", "Apple Crumble", "Cherry Pie"]],
    ["the Score ranking", "Score", ["Apple Crumble", "Banana Bread", "Cherry Pie"]],
  ])("returns to %s when a search started from it is cleared", async (_view, from, names) => {
    mockedAiSearch.mockResolvedValue({
      ok: true,
      results: [{ id: "o3", reason: "Pie night" }],
    });
    render(
      <TonightScreen
        view={tonight({ day: "2026-10-22", today: "2026-10-22", options: THREE })}
        searchEnabled
        preparedNote={NOTE}
      />,
    );
    fireEvent.click(segment(from));
    await submitSearchAndSettle();
    await screen.findByText("Pie night");

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

    await waitFor(() => {
      expect(segments()).toEqual({ names: ["Score", "Prepared"], selected: from });
    });
    expect(listedNames()).toEqual(names);
  });

  it("returns to the view the search started from when an empty result is cleared", async () => {
    mockedAiSearch.mockResolvedValue({ ok: true, results: [] });
    render(
      <TonightScreen
        view={tonight({ day: "2026-10-22", today: "2026-10-22", options: THREE })}
        searchEnabled
        preparedNote={NOTE}
      />,
    );
    fireEvent.click(segment("Score"));
    await submitSearchAndSettle();
    const emptyState = (await screen.findByText("No Options fit that search."))
      .parentElement as HTMLElement;

    fireEvent.click(within(emptyState).getByRole("button", { name: "Clear search" }));

    await waitFor(() => {
      expect(segments().selected).toBe("Score");
    });
  });

  it("stays on the view on show when a kept search is cleared from elsewhere", async () => {
    mockedAiSearch.mockResolvedValue({
      ok: true,
      results: [{ id: "o3", reason: "Pie night" }],
    });
    render(
      <TonightScreen
        view={tonight({ day: "2026-10-22", today: "2026-10-22", options: THREE })}
        searchEnabled
        preparedNote={NOTE}
      />,
    );
    await submitSearchAndSettle();
    await screen.findByText("Pie night");
    fireEvent.click(segment("Score"));

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

    await waitFor(() => {
      expect(segments()).toEqual({ names: ["Score", "Prepared"], selected: "Score" });
    });
  });

  it("carries the chosen view across a Selected-day change", () => {
    const FRIDAY_NOTE = { ...NOTE, ranking: [{ id: "o3", reason: "Pie on a Friday." }] };
    const onDay = (day: string) => tonight({ day, today: "2026-10-22", options: THREE });
    const { rerender } = render(
      <TonightScreen view={onDay("2026-10-22")} searchEnabled preparedNote={NOTE} />,
    );
    fireEvent.click(segment("Score"));

    rerender(
      <TonightScreen view={onDay("2026-10-23")} searchEnabled preparedNote={FRIDAY_NOTE} />,
    );

    expect(segments().selected).toBe("Score");
    expect(listedNames()).toEqual(["Apple Crumble", "Banana Bread", "Cherry Pie"]);

    fireEvent.click(segment("Prepared"));
    expect(listedNames()).toEqual(["Cherry Pie", "Apple Crumble", "Banana Bread"]);
    expect(screen.getByText("Pie on a Friday.")).toBeTruthy();
  });

  it("falls back to the day's default when a day change takes the chosen view away, and returns to it after", () => {
    const onDay = (day: string) => tonight({ day, today: "2026-10-22", options: THREE });
    const { rerender } = render(
      <TonightScreen view={onDay("2026-10-22")} searchEnabled preparedNote={NOTE} />,
    );
    expect(segments().selected).toBe("Prepared");

    // A day with no note has only the Score ranking.
    rerender(<TonightScreen view={onDay("2026-10-23")} searchEnabled preparedNote={null} />);
    expect(screen.queryByRole("group", { name: "List view" })).toBeNull();
    expect(listedNames()).toEqual(["Apple Crumble", "Banana Bread", "Cherry Pie"]);

    rerender(<TonightScreen view={onDay("2026-10-22")} searchEnabled preparedNote={NOTE} />);
    expect(segments().selected).toBe("Prepared");
  });

  it("drops a ranked Option no longer on offer and appends the candidates the note didn't name", () => {
    // The note ranked Durian Tart, since Closed; it never named Cherry Pie.
    render(
      <TonightScreen
        view={tonight({
          day: "2026-10-22",
          today: "2026-10-22",
          options: [
            ...THREE,
            // Closed on Thursdays — the Selected day.
            option("o4", "Durian Tart", [], { closedDays: [4] }),
          ],
        })}
        searchEnabled
        preparedNote={{
          ...NOTE,
          ranking: [
            { id: "o4", reason: "Closed now." },
            ...NOTE.ranking,
          ],
        }}
      />,
    );

    expect(listedNames()).toEqual(["Banana Bread", "Apple Crumble", "Cherry Pie"]);
    expect(screen.queryByText("Closed now.")).toBeNull();
  });

  /** The numeral in `name`'s rank gutter — empty on an unnumbered row. */
  function rankShown(name: string): string | null | undefined {
    return screen.getByText(name).closest("li")?.querySelector(".w-6")?.textContent;
  }

  it("keeps the note's number on a Prepared row after an earlier-ranked one is Rejected", () => {
    // The note ranked Banana Bread #1 and Apple Crumble #2; Banana Bread has
    // since been Rejected, so Apple Crumble leads the list but is still #2.
    render(
      <TonightScreen
        view={tonight({
          day: "2026-10-22",
          today: "2026-10-22",
          options: THREE,
          rejections: [{ optionId: "o2" }],
        })}
        searchEnabled
        preparedNote={NOTE}
      />,
    );

    expect(listedNames()).toEqual(["Apple Crumble", "Cherry Pie"]);
    expect(rankShown("Apple Crumble")).toBe("2");
  });

  it("leaves a candidate the note didn't name unnumbered and without a rationale", () => {
    render(
      <TonightScreen
        view={tonight({ day: "2026-10-22", today: "2026-10-22", options: THREE })}
        searchEnabled
        preparedNote={NOTE}
      />,
    );

    expect(rankShown("Banana Bread")).toBe("1");
    expect(rankShown("Cherry Pie")).toBe("");
    // The rationale line is the row's raised surface: Banana's carries the
    // note's reason, Cherry has none at all.
    const cherry = screen.getByText("Cherry Pie").closest("li") as HTMLElement;
    expect(cherry.querySelector("p.bg-raised")).toBeNull();
    const banana = screen.getByText("Banana Bread").closest("li") as HTMLElement;
    expect(banana.querySelector("p.bg-raised")?.textContent).toBe(NOTE.ranking[0].reason);
  });

  it("keeps the filter chips over the Prepared ranking; a filtered row keeps the note's rank", () => {
    render(
      <TonightScreen
        view={tonight({ day: "2026-10-22", today: "2026-10-22", options: THREE })}
        searchEnabled
        preparedNote={{
          ...NOTE,
          ranking: [...NOTE.ranking, { id: "o3", reason: "Pie, if anyone wants it." }],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "dessert, not filtered" }));

    expect(listedNames()).toEqual(["Banana Bread", "Apple Crumble"]);
    fireEvent.click(screen.getByRole("button", { name: "dessert, included" }));
    fireEvent.click(screen.getByRole("button", { name: "dessert, excluded" }));
    expect(listedNames()).toEqual(["Banana Bread", "Apple Crumble", "Cherry Pie"]);
    fireEvent.click(screen.getByRole("button", { name: "pie, not filtered" }));
    const [cherry] = within(screen.getAllByRole("list").at(-1) as HTMLElement)
      .getAllByRole("listitem");
    expect(within(cherry).getByText("Cherry Pie")).toBeTruthy();
    expect(within(cherry).getByText("3")).toBeTruthy();
  });

  it.each([
    ["picker", { options: THREE }],
    [
      "all-filtered",
      {
        options: THREE,
        rejections: [{ optionId: "o1" }, { optionId: "o2" }, { optionId: "o3" }],
      },
    ],
  ])("shows the brief and its label in %s mode", (_mode, input) => {
    render(
      <TonightScreen
        view={tonight({ day: "2026-10-22", today: "2026-10-22", ...input })}
        searchEnabled
        preparedNote={NOTE}
      />,
    );

    expect(screen.getByText(NOTE.brief)).toBeTruthy();
    expect(briefLabel()).toBe("Prepared 2:14pm");
  });

  it("sets the label's time in Geist Mono, apart from its words", () => {
    render(
      <TonightScreen
        view={tonight({ day: "2026-10-22", today: "2026-10-22", options: THREE })}
        searchEnabled
        preparedNote={{ ...NOTE, label: { prefix: "Prepared Mon", time: "9:40pm" } }}
      />,
    );

    expect(briefLabel()).toBe("Prepared Mon 9:40pm");
    for (const time of screen.getAllByText("9:40pm")) {
      expect(time.className).toMatch(/font-mono/);
      expect(time.className).toMatch(/tabular-nums/);
    }
  });

  it("sets the label in italics at the brief's lower right, not on a line of its own", () => {
    render(
      <TonightScreen
        view={tonight({ day: "2026-10-22", today: "2026-10-22", options: THREE })}
        searchEnabled
        preparedNote={NOTE}
      />,
    );

    // jsdom has no layout: this pins the placement classes, and the result
    // is checked by eye on the dev server. From 720px the label floats into
    // the brief's last line; under it, it rides the "Read more" row, since
    // the two-line clamp would cut it off inside the brief.
    const region = screen.getByRole("region", { name: "Prepared note" });
    expect(region.querySelectorAll("p")).toHaveLength(1);
    const [inBrief, onToggleRow] = labelCopies();
    expect(inBrief.closest("p")).toBe(screen.getByText(NOTE.brief));
    expect(inBrief.className).toMatch(/\bhidden\b.*desktop:float-right/);
    expect(onToggleRow.parentElement?.className).toMatch(/desktop:hidden/);
    expect(onToggleRow.parentElement?.className).toMatch(/justify-between/);
    for (const copy of [inBrief, onToggleRow]) expect(copy.className).toMatch(/\bitalic\b/);
  });

  /** Both copies of the label: floated in the brief, and on the toggle row. */
  function labelCopies(): HTMLElement[] {
    const region = screen.getByRole("region", { name: "Prepared note" });
    const copies = Array.from(region.querySelectorAll<HTMLElement>(":scope span.italic"));
    expect(copies).toHaveLength(2);
    return copies;
  }

  /** The label's text, once both copies are known to agree. */
  function briefLabel(): string {
    const [first, second] = labelCopies().map((copy) => copy.textContent ?? "");
    expect(second).toBe(first);
    return first;
  }

  it.each([
    ["Pick", ["o1", "o2"]],
    ["Pick of an Option since Archived", ["gone"]],
  ])("keeps the brief on a date decided by a %s, as on an undecided one", (_kind, picks) => {
    render(
      <TonightScreen
        view={tonight({ day: "2026-10-22", today: "2026-10-22", picks, options: [...OPTIONS, CHERRY] })}
        searchEnabled
        preparedNote={NOTE}
      />,
    );

    expect(screen.getByText("Tonight's dinner is decided.")).toBeTruthy();
    expect(screen.getByText(NOTE.brief)).toBeTruthy();
    expect(briefLabel()).toBe("Prepared 2:14pm");
    expect(screen.queryByText(/The note (ranked|didn't rank)/)).toBeNull();
    expect(screen.getByRole("button", { name: "Read more" }).parentElement?.className).toMatch(/desktop:hidden/);
  });

  it("sets the brief under the picked dinners on a decided date, above the picker", () => {
    render(
      <TonightScreen
        view={tonight({ day: "2026-10-22", today: "2026-10-22", picks: ["o1"], options: [...OPTIONS, CHERRY] })}
        searchEnabled
        preparedNote={NOTE}
      />,
    );

    const brief = screen.getByRole("region", { name: "Prepared note" });
    const dinner = screen.getByRole("region", { name: "Tonight's dinner" });
    const picker = screen.getByRole("region", { name: "Add another option" });
    expect(dinner.compareDocumentPosition(brief) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(brief.compareDocumentPosition(picker) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("sets the brief right under the heading on an undecided date, above the list", () => {
    render(
      <TonightScreen
        view={tonight({ day: "2026-10-22", today: "2026-10-22", options: THREE })}
        searchEnabled
        preparedNote={NOTE}
      />,
    );

    const brief = screen.getByRole("region", { name: "Prepared note" });
    const list = screen.getAllByRole("list").at(-1) as HTMLElement;
    expect(brief.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("marks an out-of-date note on its label, and only then", () => {
    const { rerender } = render(
      <TonightScreen
        view={tonight({ day: "2026-10-22", today: "2026-10-22", options: THREE })}
        searchEnabled
        preparedNote={NOTE}
      />,
    );
    expect(screen.queryByText(/out of date/)).toBeNull();

    rerender(
      <TonightScreen
        view={tonight({ day: "2026-10-22", today: "2026-10-22", options: THREE })}
        searchEnabled
        preparedNote={{ ...NOTE, outOfDate: true }}
      />,
    );

    expect(briefLabel()).toBe("Prepared 2:14pm · out of date");
  });

  it("expands the clamped brief on Read more, and collapses it again on a day change", () => {
    // jsdom has no layout, so this drives the toggle; the clamp itself (two
    // lines under 720px, full above) is checked by eye on the dev server.
    const onDay = (day: string) =>
      tonight({ day, today: "2026-10-22", options: THREE });
    const { rerender } = render(
      <TonightScreen view={onDay("2026-10-22")} searchEnabled preparedNote={NOTE} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Read more" }));
    expect(
      screen.getByRole("button", { name: "Show less" }).getAttribute("aria-expanded"),
    ).toBe("true");

    rerender(
      <TonightScreen view={onDay("2026-10-23")} searchEnabled preparedNote={NOTE} />,
    );

    expect(
      screen.getByRole("button", { name: "Read more" }).getAttribute("aria-expanded"),
    ).toBe("false");
  });

  /** The polite status region's text that names the list on show. */
  function listStatus(): string | undefined {
    return screen
      .getAllByRole("status")
      .map((status) => status.textContent ?? "")
      .find((text) => /^Showing (the|AI)/.test(text));
  }

  it("announces every view switch, and the view a cleared search returns to", async () => {
    mockedAiSearch.mockResolvedValue({
      ok: true,
      results: [{ id: "o3", reason: "Pie night" }],
    });
    render(
      <TonightScreen
        view={tonight({ day: "2026-10-22", today: "2026-10-22", options: THREE })}
        searchEnabled
        preparedNote={NOTE}
      />,
    );
    await submitSearchAndSettle();
    await screen.findByText("Pie night");
    expect(listStatus()).toBe("Showing AI search results.");

    fireEvent.click(segment("Score"));
    expect(listStatus()).toBe("Showing the ranked dinner list.");
    fireEvent.click(segment("Prepared"));
    expect(listStatus()).toBe("Showing the prepared ranking.");
    fireEvent.click(segment("AI search"));
    expect(listStatus()).toBe("Showing AI search results.");

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

    await waitFor(() => {
      expect(listStatus()).toBe("Showing the prepared ranking.");
    });
  });

  it("announces a view switch even when Claude AI search is off", () => {
    render(
      <TonightScreen
        view={tonight({ day: "2026-10-22", today: "2026-10-22", options: THREE })}
        searchEnabled={false}
        preparedNote={NOTE}
      />,
    );

    fireEvent.click(segment("Score"));

    expect(listStatus()).toBe("Showing the ranked dinner list.");
  });

  it("keeps the list's status region mounted across a step onto a note day, so the swap is voiced", () => {
    const onDay = (day: string) => tonight({ day, today: "2026-10-22", options: THREE });
    const { rerender } = render(
      <TonightScreen view={onDay("2026-10-22")} searchEnabled={false} preparedNote={null} />,
    );
    const before = screen.getAllByRole("status");

    rerender(
      <TonightScreen view={onDay("2026-10-23")} searchEnabled={false} preparedNote={NOTE} />,
    );

    const region = screen
      .getAllByRole("status")
      .find((status) => status.textContent === "Showing the prepared ranking.");
    // A region mounted already holding its text is not announced.
    expect(before).toContain(region);
  });

  it("leaves the list's status region empty when no list is shown", () => {
    render(
      <TonightScreen
        view={tonight({
          day: "2026-10-22",
          today: "2026-10-22",
          options: THREE,
          rejections: [{ optionId: "o1" }, { optionId: "o2" }, { optionId: "o3" }],
        })}
        searchEnabled={false}
        preparedNote={NOTE}
      />,
    );

    expect(listStatus()).toBeUndefined();
  });

  it("renders Tonight as before with no note (none written, or the feature off)", () => {
    render(
      <TonightScreen
        view={tonight({ day: "2026-10-22", today: "2026-10-22", options: THREE })}
        searchEnabled={false}
        preparedNote={null}
      />,
    );

    expect(screen.queryByRole("region", { name: "Prepared note" })).toBeNull();
    expect(screen.queryByText("Prepared ranking")).toBeNull();
    expect(listedNames()).toEqual(["Apple Crumble", "Banana Bread", "Cherry Pie"]);
    // The list's status region is always mounted; a fresh load stays silent.
    expect(listStatus()).toBe("Showing the ranked dinner list.");
  });
});
