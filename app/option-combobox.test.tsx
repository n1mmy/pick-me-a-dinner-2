// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { OptionChoice } from "../db/queries";
import {
  OptionCombobox,
  OptionListbox,
  useComboboxKeyboard,
} from "./option-combobox";

/**
 * `OptionCombobox` is the shared type-ahead Option picker. These tests render
 * it as a controlled component and drive it the way the Log forms do — a
 * `value` / `onChange` pair — asserting on rendered output and interaction
 * (prior art: `app/tonight-screen.test.tsx`).
 */

// A fixed Catalog of Active Options. They are deliberately not alphabetical
// here so the open-order assertion proves the component sorts nothing it was
// not handed already-sorted — the choices arrive ordered by name from the
// query, so the list shows them in passed order.
const CHOICES: OptionChoice[] = [
  { id: "o1", name: "Apple Crumble", kind: "home" },
  { id: "o2", name: "Banana Bread", kind: "home" },
  { id: "o3", name: "Pad Thai", kind: "restaurant" },
  { id: "o4", name: "Thai Garden", kind: "restaurant" },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** Render the combobox controlled by a local-to-the-test value box. */
function setup(initialValue: string | null = null, valueName?: string) {
  const onChange = vi.fn();
  let value = initialValue;
  const utils = render(
    <OptionCombobox
      id="opt"
      choices={CHOICES}
      value={value}
      valueName={valueName}
      onChange={onChange}
    />,
  );
  // Re-render with the latest value when `onChange` fires, mimicking a parent.
  onChange.mockImplementation((next: string | null) => {
    value = next;
    utils.rerender(
      <OptionCombobox
        id="opt"
        choices={CHOICES}
        value={value}
        valueName={valueName}
        onChange={onChange}
      />,
    );
  });
  return { onChange };
}

function input() {
  return screen.getByRole("combobox") as HTMLInputElement;
}

describe("OptionCombobox", () => {
  it("opens showing every Active Option, flat and with a kind label", () => {
    setup();
    fireEvent.focus(input());

    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "Apple CrumbleHome meal",
      "Banana BreadHome meal",
      "Pad ThaiRestaurant",
      "Thai GardenRestaurant",
    ]);
  });

  it("filters the list by case-insensitive substring match", () => {
    setup();
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "thai" } });

    // "thai" matches both "Pad Thai" and "Thai Garden".
    const names = screen.getAllByRole("option").map((o) => o.textContent);
    expect(names).toEqual(["Pad ThaiRestaurant", "Thai GardenRestaurant"]);
  });

  it("moves the highlight with ↑/↓ and selects it with Enter", () => {
    const { onChange } = setup();
    fireEvent.focus(input());

    // Highlight starts on the first row; ↓ twice lands on "Pad Thai".
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("o3");
    expect(input().value).toBe("Pad Thai");
  });

  it("closes the list on Escape", () => {
    setup();
    fireEvent.focus(input());
    expect(screen.queryByRole("listbox")).toBeTruthy();

    fireEvent.keyDown(input(), { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("selects an Option when its row is clicked", () => {
    const { onChange } = setup();
    fireEvent.focus(input());

    fireEvent.mouseDown(screen.getByText("Banana Bread"));
    expect(onChange).toHaveBeenCalledWith("o2");
    expect(input().value).toBe("Banana Bread");
  });

  it("shows the picked name and re-opens the list on re-focus", () => {
    setup();
    fireEvent.focus(input());
    fireEvent.mouseDown(screen.getByText("Apple Crumble"));
    // The pick closed the list and the field shows the Option name.
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(input().value).toBe("Apple Crumble");

    // Re-focusing re-opens the list for another search.
    fireEvent.focus(input());
    expect(screen.queryByRole("listbox")).toBeTruthy();
    expect(screen.getAllByRole("option")).toHaveLength(4);
  });

  it("clears the pick with the × control", () => {
    const { onChange } = setup("o1");
    expect(input().value).toBe("Apple Crumble");

    fireEvent.mouseDown(screen.getByRole("button", { name: "Clear Option" }));
    expect(onChange).toHaveBeenCalledWith(null);
    expect(input().value).toBe("");
  });

  it("reconciles unmatched text back to the last valid pick on blur", () => {
    setup("o1");
    expect(input().value).toBe("Apple Crumble");

    // Type a non-matching string, then blur — the field snaps back.
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "zzz nonsense" } });
    fireEvent.blur(input());

    expect(input().value).toBe("Apple Crumble");
  });

  it("renders a No matches row when nothing matches and offers no create row", () => {
    setup();
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "zzz nonsense" } });

    const list = screen.getByRole("listbox");
    expect(within(list).getByText("No matches")).toBeTruthy();
    expect(screen.queryByRole("option")).toBeNull();
    // There is no Option-creation affordance.
    expect(screen.queryByText(/create/i)).toBeNull();
  });

  it("tracks the highlight with aria-activedescendant", () => {
    setup();
    fireEvent.focus(input());
    // The first row is highlighted on open.
    const first = screen.getAllByRole("option")[0];
    expect(input().getAttribute("aria-activedescendant")).toBe(first.id);

    fireEvent.keyDown(input(), { key: "ArrowDown" });
    const second = screen.getAllByRole("option")[1];
    expect(input().getAttribute("aria-activedescendant")).toBe(second.id);
  });

  it("never lists an Archived Option — only the passed choices appear", () => {
    // The caller passes Active Options only (getOptionChoices is Active-only).
    // An Archived Option is simply absent from `choices`, so it never appears.
    setup();
    fireEvent.focus(input());
    const names = screen.getAllByRole("option").map((o) => o.textContent);
    expect(names).toHaveLength(CHOICES.length);
    expect(names.some((n) => n?.includes("Archived"))).toBe(false);
  });

  it("displays a value whose Option is absent from choices via valueName", () => {
    // An edit form seeds an Archived current value's name from the Log entry.
    setup("archived-id", "Old Archived Dish");
    expect(input().value).toBe("Old Archived Dish");
  });

  describe("emptyQueryBehaviour", () => {
    it('shows no listbox on an empty query when "none" (Tonight\'s search box)', () => {
      render(
        <OptionCombobox
          id="opt"
          choices={CHOICES}
          value={null}
          onChange={vi.fn()}
          emptyQueryBehaviour="none"
        />,
      );
      fireEvent.focus(input());

      expect(screen.queryByRole("listbox")).toBeNull();
      expect(screen.queryByRole("option")).toBeNull();
    });

    it('still shows matches once a query narrows the list when "none"', () => {
      render(
        <OptionCombobox
          id="opt"
          choices={CHOICES}
          value={null}
          onChange={vi.fn()}
          emptyQueryBehaviour="none"
        />,
      );
      fireEvent.focus(input());
      fireEvent.change(input(), { target: { value: "thai" } });

      const names = screen.getAllByRole("option").map((o) => o.textContent);
      expect(names).toEqual(["Pad ThaiRestaurant", "Thai GardenRestaurant"]);
    });

    it('never shows a "No matches" row when "none" and the query matches nothing', () => {
      render(
        <OptionCombobox
          id="opt"
          choices={CHOICES}
          value={null}
          onChange={vi.fn()}
          emptyQueryBehaviour="none"
        />,
      );
      fireEvent.focus(input());
      fireEvent.change(input(), { target: { value: "zzz nonsense" } });

      expect(screen.queryByRole("listbox")).toBeNull();
    });
  });

  describe("initialActiveIndex", () => {
    it("leaves no option active until the first arrow key when -1", () => {
      render(
        <OptionCombobox
          id="opt"
          choices={CHOICES}
          value={null}
          onChange={vi.fn()}
          initialActiveIndex={-1}
        />,
      );
      fireEvent.focus(input());

      expect(input().getAttribute("aria-activedescendant")).toBeNull();

      fireEvent.keyDown(input(), { key: "ArrowDown" });
      const first = screen.getAllByRole("option")[0];
      expect(input().getAttribute("aria-activedescendant")).toBe(first.id);
    });

    it("does not select on Enter with nothing active when -1", () => {
      const onChange = vi.fn();
      render(
        <OptionCombobox
          id="opt"
          choices={CHOICES}
          value={null}
          onChange={onChange}
          initialActiveIndex={-1}
        />,
      );
      fireEvent.focus(input());
      fireEvent.keyDown(input(), { key: "Enter" });

      expect(onChange).not.toHaveBeenCalled();
    });
  });
});

/**
 * `OptionListbox` and `useComboboxKeyboard`'s optional `getNote` / `isDisabled`
 * (issue 02, Tonight's search box) — the Log/detail forms above never pass
 * either, so those tests already prove the defaults are unaffected. This
 * harness drives the two together the way Tonight's search box does.
 */
type Choice = OptionChoice & { disabled?: boolean; note?: string };

const HARNESS_CHOICES: Choice[] = [
  { id: "h1", name: "Aji Ichi", kind: "restaurant" },
  { id: "h2", name: "Burger Night", kind: "home", disabled: true, note: "already picked" },
  { id: "h3", name: "Curry House", kind: "restaurant", note: "closed Mondays" },
];

function Harness() {
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const { activeIndex, setActiveIndex, handleKeyDown, activeId } =
    useComboboxKeyboard<Choice>({
      open,
      setOpen,
      matches: HARNESS_CHOICES,
      initialActiveIndex: 0,
      onSelect: (option) => setSelected(option.id),
      onEscape: () => setOpen(false),
      isDisabled: (option) => option.disabled === true,
    });
  return (
    <div>
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls="list"
        aria-activedescendant={activeId("list")}
        onKeyDown={handleKeyDown}
        readOnly
      />
      <output>{selected ?? "none"}</output>
      {open && (
        <OptionListbox
          listId="list"
          matches={HARNESS_CHOICES}
          activeIndex={activeIndex}
          isSelected={(_o, index) => index === activeIndex}
          onSelect={(option) => setSelected(option.id)}
          onHover={setActiveIndex}
          getNote={(option) => option.note}
          isDisabled={(option) => option.disabled === true}
          className="listbox"
        />
      )}
    </div>
  );
}

describe("OptionListbox / useComboboxKeyboard — getNote and isDisabled", () => {
  it("shows the muted note and marks a disabled row aria-disabled", () => {
    render(<Harness />);
    const rows = screen.getAllByRole("option");
    expect(rows[1].getAttribute("aria-disabled")).toBe("true");
    expect(rows[1].textContent).toContain("already picked");
    expect(rows[2].textContent).toContain("closed Mondays");
    expect(rows[0].getAttribute("aria-disabled")).toBeNull();
  });

  it("a mousedown on a disabled row does not select it", () => {
    render(<Harness />);
    fireEvent.mouseDown(screen.getAllByRole("option")[1]);
    // The selected output is unchanged — the disabled row's mousedown was a no-op.
    expect(screen.getByText("none")).toBeTruthy();
  });

  it("↓ skips the disabled row, and Enter on the landed row selects it", () => {
    render(<Harness />);
    const combobox = screen.getByRole("combobox");
    // Starts highlighted on row 0 (Aji Ichi); ↓ must skip disabled row 1 and
    // land on row 2 (Curry House).
    fireEvent.keyDown(combobox, { key: "ArrowDown" });
    const curryHouse = screen.getAllByRole("option")[2];
    expect(combobox.getAttribute("aria-activedescendant")).toBe(curryHouse.id);

    fireEvent.keyDown(combobox, { key: "Enter" });
    expect(screen.getByText("h3")).toBeTruthy();
  });
});
