// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { OptionChoice } from "../db/queries";
import { OptionCombobox } from "./option-combobox";

/**
 * The combobox choices, flat and alphabetical the way the queries layer hands
 * them over. A mix of Home meal and Restaurant kinds so the per-row kind
 * indicator can be asserted on.
 */
const CHOICES: OptionChoice[] = [
  { id: "o1", name: "Apple Crumble", kind: "home" },
  { id: "o2", name: "Banana Bread", kind: "home" },
  { id: "o3", name: "Thai Garden", kind: "restaurant" },
];

afterEach(cleanup);

/** Render the combobox with a spy `onChange`, returning both for assertions. */
function setup(value: string | null = null) {
  const onChange = vi.fn();
  const utils = render(
    <OptionCombobox
      id="option-picker"
      choices={CHOICES}
      value={value}
      onChange={onChange}
      placeholder="Search for an Option"
    />,
  );
  return { onChange, ...utils };
}

/** The combobox input — re-queried, never captured across re-renders. */
function combobox() {
  return screen.getByRole("combobox") as HTMLInputElement;
}

describe("OptionCombobox", () => {
  it("opens showing every Active Option, each row indicating its kind", () => {
    setup();
    // Closed on mount — no listbox yet.
    expect(screen.queryByRole("listbox")).toBeNull();

    fireEvent.focus(combobox());

    const options = screen.getAllByRole("option");
    expect(options.map((o) => within(o).getByText(/Crumble|Bread|Garden/).textContent)).toEqual([
      "Apple Crumble",
      "Banana Bread",
      "Thai Garden",
    ]);
    // Each row carries a "Home meal" / "Restaurant" kind label.
    expect(within(options[0]).getByText("Home meal")).toBeTruthy();
    expect(within(options[2]).getByText("Restaurant")).toBeTruthy();
  });

  it("filters the list by case-insensitive substring match", () => {
    setup();
    fireEvent.focus(combobox());

    // An interior substring narrows the list — "rd" hits only "Thai Garden".
    fireEvent.change(combobox(), { target: { value: "rd" } });
    expect(
      screen
        .getAllByRole("option")
        .map((o) => within(o).getByText(/Bread|Garden|Crumble/).textContent),
    ).toEqual(["Thai Garden"]);

    // Matching is case-insensitive — uppercase "BANANA" still finds the row.
    fireEvent.change(combobox(), { target: { value: "BANANA" } });
    expect(
      screen
        .getAllByRole("option")
        .map((o) => within(o).getByText(/Bread|Garden|Crumble/).textContent),
    ).toEqual(["Banana Bread"]);
  });

  it("moves the highlight with ↑/↓ and selects it with Enter", () => {
    const { onChange } = setup();
    fireEvent.focus(combobox());

    // First row is highlighted on open; ArrowDown moves to the second.
    fireEvent.keyDown(combobox(), { key: "ArrowDown" });
    fireEvent.keyDown(combobox(), { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("o2");
  });

  it("closes the list on Escape", () => {
    setup();
    fireEvent.focus(combobox());
    expect(screen.getByRole("listbox")).toBeTruthy();

    fireEvent.keyDown(combobox(), { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("selects an Option when its row is clicked", () => {
    const { onChange } = setup();
    fireEvent.focus(combobox());

    fireEvent.mouseDown(screen.getByText("Thai Garden"));
    expect(onChange).toHaveBeenCalledWith("o3");
  });

  it("shows the picked Option name and re-opens the list on re-focus", () => {
    setup("o3");
    // The picked Option's name fills the input.
    expect(combobox().value).toBe("Thai Garden");

    // Re-focusing re-opens the full list for another search.
    fireEvent.focus(combobox());
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("clears the pick with the × control", () => {
    const { onChange } = setup("o3");
    fireEvent.mouseDown(
      screen.getByRole("button", { name: "Clear selected Option" }),
    );
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("reconciles to the last valid pick when blurred with unmatched text", () => {
    setup("o1");
    fireEvent.focus(combobox());
    fireEvent.change(combobox(), { target: { value: "zzz no match" } });
    expect(screen.getByText("No matches")).toBeTruthy();

    // Blurring with unmatched text snaps the field back to the picked name.
    fireEvent.blur(combobox());
    expect(combobox().value).toBe("Apple Crumble");
  });

  it("renders a 'No matches' row and no create affordance when nothing matches", () => {
    setup();
    fireEvent.focus(combobox());
    fireEvent.change(combobox(), { target: { value: "nonexistent" } });

    expect(screen.getByText("No matches")).toBeTruthy();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    // There is no "Create …" row — the picker only chooses existing Options.
    expect(screen.queryByText(/create/i)).toBeNull();
  });

  it("is an accessible combobox with combobox/listbox/option roles", () => {
    setup();
    const input = combobox();
    expect(input.getAttribute("aria-expanded")).toBe("false");

    fireEvent.focus(input);
    expect(input.getAttribute("aria-expanded")).toBe("true");
    // The highlighted row is tracked with aria-activedescendant.
    const activeId = input.getAttribute("aria-activedescendant");
    expect(activeId).toBeTruthy();
    expect(document.getElementById(activeId as string)?.getAttribute("role")).toBe(
      "option",
    );
    expect(screen.getByRole("listbox")).toBeTruthy();
  });

  it("never lists an Archived Option — the caller passes Active Options only", () => {
    // `getOptionChoices()` returns Active Options only, so an Archived Option
    // is simply absent from `choices`; the combobox shows exactly what it gets.
    render(
      <OptionCombobox
        id="option-picker"
        choices={[CHOICES[0]]}
        value={null}
        onChange={vi.fn()}
        placeholder="Search for an Option"
      />,
    );
    fireEvent.focus(combobox());
    const names = screen
      .getAllByRole("option")
      .map((o) => within(o).getByText(/Crumble|Bread|Garden/).textContent);
    expect(names).toEqual(["Apple Crumble"]);
  });
});
