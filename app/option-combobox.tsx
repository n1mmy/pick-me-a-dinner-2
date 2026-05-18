"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import type { OptionChoice } from "../db/queries";
import { kindBarClass } from "./kind-bar";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-action";

/** The friendly label for an Option's kind, reused on every combobox row. */
function kindLabel(kind: "home" | "restaurant"): string {
  return kind === "home" ? "Home meal" : "Restaurant";
}

/**
 * The type-ahead Option picker — a hand-rolled, accessible combobox used
 * wherever an Option is chosen on the Log, replacing the native `<select>`.
 * It follows the `TagInput` pattern: a `role="combobox"` input over a
 * `role="listbox"` of `role="option"` rows, committing a pick on `onMouseDown`
 * so the click lands before the input's blur fires.
 *
 * Opening it shows every choice (the caller passes Active Options only); typing
 * narrows the list by case-insensitive substring match. The list is flat and
 * alphabetical — the caller orders `choices` by name — and each row carries the
 * Tonight rows' kind bar plus a "Home meal" / "Restaurant" label. ↑/↓ move a
 * highlight, Enter selects it, Escape closes; click/tap selects a row. After a
 * pick the input shows the Option's name; re-focusing re-opens the list; the
 * "×" control clears the pick; blurring with unmatched text reconciles the
 * field back to the last valid pick. A "No matches" row shows when nothing
 * matches — there is no Option-creation affordance.
 */
export function OptionCombobox({
  id,
  choices,
  value,
  onChange,
  placeholder,
}: {
  /** Associates an external `<label htmlFor>` with the combobox input. */
  id: string;
  /** The selectable Options, already flat and alphabetical by name. */
  choices: OptionChoice[];
  /** The currently picked Option id, or `null` when nothing is picked. */
  value: string | null;
  /** Receives the chosen Option id, or `null` when the pick is cleared. */
  onChange: (optionId: string | null) => void;
  placeholder: string;
}) {
  const listId = useId();
  const optionDomId = (optionId: string) => `${listId}-${optionId}`;

  const inputRef = useRef<HTMLInputElement>(null);
  const selected = choices.find((choice) => choice.id === value) ?? null;

  // `draft` is the text in the input. `open` tracks whether the list shows.
  // `active` is the highlighted row index within the filtered list.
  const [draft, setDraft] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  // While the list is closed the input mirrors the picked Option's name; only
  // an open list shows the live `draft` the Household is typing.
  const inputText = open ? draft : (selected?.name ?? "");

  const query = draft.trim().toLowerCase();
  const filtered =
    open && query.length > 0
      ? choices.filter((choice) => choice.name.toLowerCase().includes(query))
      : choices;

  function openList() {
    setDraft("");
    setActive(0);
    setOpen(true);
  }

  function closeList() {
    setOpen(false);
    setActive(0);
  }

  function pick(choice: OptionChoice) {
    onChange(choice.id);
    setDraft(choice.name);
    closeList();
    inputRef.current?.blur();
  }

  function clear() {
    onChange(null);
    setDraft("");
    closeList();
    inputRef.current?.focus();
  }

  // Blur with text matching no Option reconciles the field back to the last
  // valid pick — the input simply re-renders the selected name once `open` is
  // false, so closing the list is the whole reconcile.
  function handleBlur() {
    closeList();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        closeList();
      }
      return;
    }
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        openList();
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (filtered.length > 0) {
        setActive((index) => (index + 1) % filtered.length);
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (filtered.length > 0) {
        setActive((index) => (index - 1 + filtered.length) % filtered.length);
      }
    } else if (event.key === "Enter") {
      event.preventDefault();
      const choice = filtered[active];
      if (choice) pick(choice);
    }
  }

  const activeChoice = open ? filtered[active] : undefined;

  return (
    <div className="relative">
      <div className="flex items-stretch gap-1">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          className={`min-h-11 w-full rounded-input border border-line bg-surface
            px-3 text-body text-ink placeholder:text-muted ${focusRing}`}
          value={inputText}
          placeholder={placeholder}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeChoice ? optionDomId(activeChoice.id) : undefined
          }
          onChange={(event) => {
            setDraft(event.target.value);
            setActive(0);
            if (!open) setOpen(true);
          }}
          onFocus={openList}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
        />
        {selected && (
          <button
            type="button"
            // `onMouseDown` + `preventDefault` so the clear commits before the
            // input's blur fires, the same technique the rows use to select.
            onMouseDown={(event) => {
              event.preventDefault();
              clear();
            }}
            className={`min-h-11 shrink-0 rounded-control px-3 text-body
              text-muted transition-colors duration-micro hover:text-ink
              ${focusRing}`}
          >
            <span aria-hidden="true">×</span>
            <span className="sr-only">Clear selected Option</span>
          </button>
        )}
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-10 mt-1 flex max-h-64 w-full flex-col
            overflow-y-auto rounded-input border border-line bg-surface py-1
            shadow-sm"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-body text-muted">No matches</li>
          ) : (
            filtered.map((choice, index) => (
              <li key={choice.id}>
                <button
                  type="button"
                  id={optionDomId(choice.id)}
                  role="option"
                  aria-selected={choice.id === value}
                  className={`flex min-h-11 w-full flex-col justify-center
                    py-1.5 text-left ${kindBarClass(choice.kind)} ${
                      index === active ? "bg-raised" : "hover:bg-raised"
                    }`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    pick(choice);
                  }}
                  onMouseMove={() => setActive(index)}
                >
                  <span className="text-body text-ink">{choice.name}</span>
                  <span className="text-meta text-muted">
                    {kindLabel(choice.kind)}
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
