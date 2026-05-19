"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { OptionChoice } from "../db/queries";
import { kindBarClass } from "./kind-bar";

const inputClass =
  "min-h-11 w-full rounded-input border border-line bg-surface px-3 pr-9 " +
  "text-body text-ink placeholder:text-muted focus-visible:outline " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-action";

/** The per-kind label shown on each row, mirroring the domain's kind names. */
function kindLabel(kind: "home" | "restaurant"): string {
  return kind === "home" ? "Home meal" : "Restaurant";
}

/**
 * The type-ahead Option picker — a hand-rolled, accessible combobox shared by
 * every place an Option is chosen on the Log. It follows the `TagInput`
 * pattern: a `role="combobox"` input over a `role="listbox"` of
 * `role="option"` rows, committing a pick on `onMouseDown` + `preventDefault`
 * so the click lands before the input's blur fires.
 *
 * Opening it shows every choice (the caller passes Active Options only); typing
 * narrows the flat, alphabetical list by case-insensitive substring match. Each
 * row carries the Tonight rows' kind bar plus a Home meal / Restaurant label.
 * ↑/↓ move a highlight tracked with `aria-activedescendant`, Enter selects it,
 * Escape closes the list, and a click selects a row. After a pick the input
 * shows the Option's name; re-focusing re-opens the list; the "×" control
 * clears the pick; blurring with text that matches no Option reconciles the
 * field back to the last valid pick. There is no Option-creation affordance.
 *
 * The caller may pass a `value` (an Option id) whose Option is absent from
 * `choices` — an Archived Option a Log entry is still logged against — together
 * with `valueName` so the field can display it; that name is the reconcile
 * target until the pick is changed.
 */
export function OptionCombobox({
  id,
  choices,
  value,
  valueName,
  onChange,
  placeholder = "Search Options",
  autoFocus = false,
}: {
  /** Associates an external `<label htmlFor>` with the combobox input. */
  id: string;
  /** The selectable Options — the caller passes Active Options only. */
  choices: OptionChoice[];
  /** The currently picked Option id, or `null` when nothing is picked. */
  value: string | null;
  /** Display name for `value` when its Option is absent from `choices`. */
  valueName?: string;
  /** Called with the chosen Option id, or `null` when the "×" clears the pick. */
  onChange: (optionId: string | null) => void;
  placeholder?: string;
  /** Focus the input on mount — for a form that opens with this as its field. */
  autoFocus?: boolean;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  /** The name of the picked Option — the field's reconcile target. */
  const pickedName = useMemo(() => {
    if (value === null) return "";
    return choices.find((o) => o.id === value)?.name ?? valueName ?? "";
  }, [value, valueName, choices]);

  // `query` is what the input shows. While closed it mirrors `pickedName`;
  // opening it lets the Household type freely. `open` gates the listbox and
  // `activeIndex` is the keyboard highlight into the filtered list.
  const [query, setQuery] = useState(pickedName);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  // Track the last name the input synced from, so an external `value` change
  // (e.g. the "×" clear) flows into the closed field without an effect.
  const [syncedName, setSyncedName] = useState(pickedName);
  if (!open && syncedName !== pickedName) {
    setSyncedName(pickedName);
    setQuery(pickedName);
  }

  // Flat, alphabetical, case-insensitive substring filter. With no query every
  // choice shows; `choices` already arrives ordered by name.
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return choices;
    return choices.filter((o) => o.name.toLowerCase().includes(needle));
  }, [query, choices]);

  function selectOption(option: OptionChoice) {
    onChange(option.id);
    setQuery(option.name);
    setSyncedName(option.name);
    setOpen(false);
  }

  function clearPick() {
    onChange(null);
    setQuery("");
    setSyncedName("");
    setOpen(false);
    // Pull focus back to the input — its `onFocus` re-opens the list for a
    // fresh search rather than stranding focus on the dismissed "×" button.
    inputRef.current?.focus();
  }

  /** On blur, reconcile unmatched text back to the last valid pick. */
  function reconcile() {
    setOpen(false);
    setQuery(pickedName);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((index) =>
        matches.length === 0 ? 0 : Math.min(index + 1, matches.length - 1),
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      if (open && matches.length > 0) {
        event.preventDefault();
        selectOption(matches[activeIndex] ?? matches[0]);
      }
    } else if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        reconcile();
      }
    }
  }

  const activeId =
    open && matches.length > 0
      ? `${listId}-option-${matches[activeIndex]?.id ?? matches[0].id}`
      : undefined;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        autoFocus={autoFocus}
        type="text"
        className={inputClass}
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          // Re-focusing re-opens the list for another search: clear the
          // displayed name so the full list shows. The pick is untouched —
          // blur reconciles the field back to it if nothing new is chosen.
          setQuery("");
          setOpen(true);
          setActiveIndex(0);
        }}
        onBlur={reconcile}
      />

      {(query.length > 0 || value !== null) && (
        <button
          type="button"
          aria-label="Clear Option"
          className="absolute right-1 top-1/2 flex h-9 w-8 -translate-y-1/2
            items-center justify-center rounded-control text-muted
            hover:text-ink focus-visible:outline focus-visible:outline-2
            focus-visible:outline-offset-2 focus-visible:outline-action"
          onMouseDown={(event) => {
            event.preventDefault();
            clearPick();
          }}
        >
          <span aria-hidden="true">×</span>
        </button>
      )}

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-10 mt-1 flex max-h-64 w-full flex-col
            overflow-y-auto rounded-input border border-line bg-surface py-1
            shadow-sm"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-body text-muted">No matches</li>
          ) : (
            matches.map((option, index) => (
              <li key={option.id}>
                <button
                  type="button"
                  id={`${listId}-option-${option.id}`}
                  role="option"
                  aria-selected={option.id === value}
                  className={`flex min-h-11 w-full flex-col py-1.5 text-left
                    ${kindBarClass(option.kind)} ${
                      index === activeIndex ? "bg-raised" : "hover:bg-raised"
                    }`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    selectOption(option);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <span className="text-body text-ink">{option.name}</span>
                  <span className="text-meta text-muted">
                    {kindLabel(option.kind)}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
