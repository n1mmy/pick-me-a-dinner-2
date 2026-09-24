"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { normalizeTag } from "../../lib/normalize-tag";
import { fieldFocusRing, focusRing } from "../focus-ring";

const labelClass = "text-meta font-emphasis uppercase tracking-wide text-muted";

/**
 * The autocomplete token input for attaching Tags to an Option. Typing filters
 * existing Tags and offers a "create" row for free text; Enter or a click adds
 * the Tag, Backspace on an empty field removes the last one. Every Tag is run
 * through `normalizeTag` on the way in, so the tokens shown are already the
 * canonical (trimmed, lowercased) form — this is the only place Tags are
 * created or changed (there is no separate Tags screen).
 *
 * The suggestion menu follows the same `aria-activedescendant` listbox
 * contract as `OptionCombobox`'s dropdown: ↑/↓ move a highlight tracked in
 * `activeIndex` over the combined matches + "create" row, Enter commits the
 * highlighted one (or the typed draft, when nothing is highlighted), and
 * Escape dismisses the menu without blurring the field.
 */
export function TagInput({
  value,
  onChange,
  suggestions,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
}) {
  const fieldId = useId();
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  function addTag(raw: string) {
    const tag = normalizeTag(raw);
    if (tag.length === 0) return;
    if (!value.includes(tag)) onChange([...value, tag]);
    setDraft("");
    setActiveIndex(-1);
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  const normalizedDraft = normalizeTag(draft);
  const matches =
    normalizedDraft.length === 0
      ? []
      : suggestions.filter(
          (name) => name.includes(normalizedDraft) && !value.includes(name),
        );
  const canCreate =
    normalizedDraft.length > 0 &&
    !value.includes(normalizedDraft) &&
    !suggestions.includes(normalizedDraft);

  // The combined, indexable menu: existing-Tag matches, then the "create" row
  // when the typed draft has no exact match — the same order they render in.
  const menuItems: { id: string; label: string; commit: () => void }[] = [
    ...matches.map((name) => ({
      id: name,
      label: name,
      commit: () => addTag(name),
    })),
    ...(canCreate
      ? [
          {
            id: `__create__`,
            label: `Create “${normalizedDraft}”`,
            commit: () => addTag(normalizedDraft),
          },
        ]
      : []),
  ];
  const showMenu = focused && !dismissed && menuItems.length > 0;
  const listId = `${fieldId}-list`;
  const activeId =
    showMenu && activeIndex >= 0 && activeIndex < menuItems.length
      ? `${listId}-option-${activeIndex}`
      : undefined;

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      if (!showMenu) return;
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, menuItems.length - 1));
    } else if (event.key === "ArrowUp") {
      if (!showMenu) return;
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, -1));
    } else if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      if (showMenu && activeIndex >= 0) {
        menuItems[activeIndex].commit();
      } else {
        addTag(draft);
      }
    } else if (event.key === "Escape") {
      if (showMenu) {
        event.preventDefault();
        setDismissed(true);
      }
    } else if (
      event.key === "Backspace" &&
      draft.length === 0 &&
      value.length > 0
    ) {
      removeTag(value[value.length - 1]);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={`${fieldId}-tag`} className={labelClass}>
        Tags
      </label>

      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {value.map((tag) => (
            <li key={tag}>
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className={`flex items-center gap-1 rounded-badge bg-raised px-2
                  py-1.5 text-chip text-ink ${focusRing}`}
              >
                {tag}
                <span aria-hidden="true" className="text-muted">
                  ×
                </span>
                <span className="sr-only">Remove tag</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <input
          id={`${fieldId}-tag`}
          className={`min-h-11 w-full rounded-input border border-line bg-surface
            px-3 text-body text-ink ${fieldFocusRing}`}
          value={draft}
          placeholder="Add a tag"
          autoComplete="off"
          role="combobox"
          aria-expanded={showMenu}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          onChange={(event) => {
            setDraft(event.target.value);
            setDismissed(false);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setFocused(true);
            setDismissed(false);
          }}
          onBlur={() => setFocused(false)}
        />

        {showMenu && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-10 mt-1 flex w-full flex-col rounded-input border
              border-line bg-surface py-1 shadow-sm"
          >
            {menuItems.map((item, index) => (
              <li key={item.id} role="presentation">
                <div
                  id={`${listId}-option-${index}`}
                  role="option"
                  tabIndex={-1}
                  aria-selected={index === activeIndex}
                  className={`min-h-11 w-full cursor-pointer px-3 py-2 text-left
                    text-body
                    ${item.id === "__create__" ? "text-action" : "text-ink"}
                    ${index === activeIndex ? "bg-raised" : "hover:bg-raised"}`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    item.commit();
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  {item.label}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
