"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { normalizeTag } from "../../lib/normalize-tag";

const labelClass = "text-meta font-emphasis uppercase tracking-wide text-muted";

/**
 * The autocomplete token input for attaching Tags to an Option. Typing filters
 * existing Tags and offers a "create" row for free text; Enter or a click adds
 * the Tag, Backspace on an empty field removes the last one. Every Tag is run
 * through `normalizeTag` on the way in, so the tokens shown are already the
 * canonical (trimmed, lowercased) form — this is the only place Tags are
 * created or changed (there is no separate Tags screen).
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

  function addTag(raw: string) {
    const tag = normalizeTag(raw);
    if (tag.length === 0) return;
    if (!value.includes(tag)) onChange([...value, tag]);
    setDraft("");
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(draft);
    } else if (
      event.key === "Backspace" &&
      draft.length === 0 &&
      value.length > 0
    ) {
      removeTag(value[value.length - 1]);
    }
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
  const showMenu = focused && (matches.length > 0 || canCreate);

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
                className="flex items-center gap-1 rounded-badge bg-chip px-2 py-1.5
                  text-chip text-ink focus-visible:outline focus-visible:outline-2
                  focus-visible:outline-offset-2 focus-visible:outline-accent"
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
          className="min-h-11 w-full rounded-input border border-line bg-surface px-3
            text-body text-ink focus-visible:outline focus-visible:outline-2
            focus-visible:outline-offset-2 focus-visible:outline-accent"
          value={draft}
          placeholder="Add a tag"
          autoComplete="off"
          role="combobox"
          aria-expanded={showMenu}
          aria-controls={`${fieldId}-list`}
          aria-autocomplete="list"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />

        {showMenu && (
          <ul
            id={`${fieldId}-list`}
            role="listbox"
            className="absolute z-10 mt-1 flex w-full flex-col rounded-input border
              border-line bg-surface py-1 shadow-sm"
          >
            {matches.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  role="option"
                  aria-selected="false"
                  className="min-h-11 w-full px-3 text-left text-body text-ink
                    hover:bg-chip"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    addTag(name);
                  }}
                >
                  {name}
                </button>
              </li>
            ))}
            {canCreate && (
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected="false"
                  className="min-h-11 w-full px-3 text-left text-body text-accent
                    hover:bg-chip"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    addTag(normalizedDraft);
                  }}
                >
                  Create “{normalizedDraft}”
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
