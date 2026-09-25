"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { OptionChoice } from "../db/queries";
import { fieldFocusRing, focusRing } from "./focus-ring";
import { kindBarClass } from "./kind-bar";

const inputClass =
  "min-h-11 w-full rounded-input border border-line bg-surface px-3 pr-11 " +
  `text-body text-ink placeholder:text-muted ${fieldFocusRing}`;

/** The per-kind label shown on each row, mirroring the domain's kind names. */
function kindLabel(kind: "home" | "restaurant"): string {
  return kind === "home" ? "Home meal" : "Restaurant";
}

/**
 * Tonight's trailing `Add "<query>"…` row (issue 03). It names no Option yet,
 * so it has no kind — a listbox row, not an `OptionChoice`.
 */
export type AddRow = { type: "add"; id: string; name: string };

export function isAddRow(row: OptionChoice | AddRow): row is AddRow {
  return "type" in row && row.type === "add";
}

/**
 * What an empty query shows: `"all"` (the Log/detail forms) returns every
 * choice; `"none"` (Tonight's search box, which doubles as an AI search
 * field) returns nothing, so a blank field reads as a clean AI "recommend"
 * trigger rather than the whole Catalog.
 */
export type EmptyQueryBehaviour = "all" | "none";

/**
 * The flat, alphabetical, case-insensitive substring filter shared by every
 * Option typeahead. `choices` already arrives ordered by name; this sorts
 * nothing on its own.
 */
export function filterOptionChoices<T extends OptionChoice>(
  choices: T[],
  query: string,
  emptyQueryBehaviour: EmptyQueryBehaviour = "all",
): T[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) {
    return emptyQueryBehaviour === "none" ? [] : choices;
  }
  return choices.filter((o) => o.name.toLowerCase().includes(needle));
}

/**
 * The ↑/↓/Enter/Escape keyboard contract shared by every Option typeahead's
 * listbox, plus the `aria-activedescendant` id it drives.
 *
 * `initialActiveIndex` is both the floor `ArrowUp` clamps to and the
 * highlight a (re)opened field starts from: `0` (the Log/detail forms) so
 * Enter immediately picks the first match; `-1` (Tonight's search box) so
 * Enter with nothing highlighted falls through to the surrounding form's own
 * submit instead of picking. Enter only ever picks when a highlight is
 * actually active (`activeIndex >= 0`).
 *
 * `isDisabled` (optional; every caller but Tonight's search box omits it)
 * marks rows ↑/↓ must skip and Enter must not select — Tonight's typeahead
 * uses it for an already-Picked Option (issue 02), which shows in the
 * dropdown but cannot be chosen from it.
 */
export function useComboboxKeyboard<T extends { id: string }>({
  open,
  setOpen,
  matches,
  initialActiveIndex = 0,
  onSelect,
  onEscape,
  isDisabled,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  matches: T[];
  initialActiveIndex?: 0 | -1;
  onSelect: (option: T) => void;
  onEscape: () => void;
  isDisabled?: (option: T) => boolean;
}) {
  const [activeIndex, setActiveIndex] = useState<number>(initialActiveIndex);
  const disabled = isDisabled ?? (() => false);

  /**
   * The next highlight index stepping from `from` in `direction`, skipping
   * any disabled row, clamped at `initialActiveIndex` / the last match —
   * same floor/ceiling `Math.max`/`Math.min` used before disabled rows
   * existed.
   */
  function step(from: number, direction: 1 | -1): number {
    let index = from;
    while (true) {
      const next = index + direction;
      if (next < initialActiveIndex || next > matches.length - 1) {
        // No selectable row further in this direction — stay exactly where
        // the Household already was, not on whatever disabled row this walk
        // passed through en route to the boundary.
        return from;
      }
      index = next;
      // `-1` (Tonight's floor) is "nothing highlighted" — always a valid
      // stop, and there is no row there to ask `disabled` about.
      if (index < 0 || !disabled(matches[index])) return index;
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((index) =>
        matches.length === 0 ? initialActiveIndex : step(index, 1),
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((index) =>
        matches.length === 0 ? initialActiveIndex : step(index, -1),
      );
    } else if (event.key === "Enter") {
      // `matches` can shrink under a stale highlight (a revalidation while a
      // row is highlighted), so the highlighted row may no longer exist.
      const highlighted = activeIndex >= 0 ? matches[activeIndex] : undefined;
      if (open && highlighted !== undefined && !disabled(highlighted)) {
        event.preventDefault();
        onSelect(highlighted);
      }
    } else if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setActiveIndex(initialActiveIndex);
        onEscape();
      }
    }
  }

  function activeId(listId: string): string | undefined {
    if (!(open && matches.length > 0 && activeIndex >= 0)) return undefined;
    return `${listId}-option-${matches[activeIndex]?.id ?? matches[0].id}`;
  }

  return {
    activeIndex,
    setActiveIndex,
    resetActiveIndex: () => setActiveIndex(initialActiveIndex),
    handleKeyDown,
    activeId,
  };
}

/**
 * The `role="listbox"` dropdown every Option typeahead shows beneath its
 * input: a scrollable list of `role="option"` rows, each carrying the
 * Tonight rows' kind bar plus a Home meal / Restaurant label. `onMouseDown` +
 * `preventDefault` commits a pick before the input's blur fires; hovering a
 * row moves the keyboard highlight to it.
 *
 * Each row is a `tabIndex={-1}` `div`, not a `button` — a listbox's ownership
 * contract is the input holds DOM focus throughout, driving the highlighted
 * option purely via `aria-activedescendant` (wired by the input in
 * `OptionCombobox`/`SearchBox`). A focusable option row would give
 * assistive tech two competing focus models at once. The `<li>` wrapper
 * carries `role="presentation"` so a listbox's only exposed children are
 * `option` rows, per the ARIA listbox content model.
 *
 * The two callers differ only in what "selected" means for `aria-selected` —
 * `OptionCombobox` has a persisted pick (`option.id === value`), Tonight's
 * search box has none and highlights by keyboard position instead — and in
 * whether an empty `matches` still renders a "No matches" row, which
 * `OptionCombobox` shows in its `"all"` (Log/detail) mode but Tonight's
 * search box never needs (it only opens once something matches). Both are
 * `className`/`showNoMatchesRow` inputs so the two boxes' markup and ARIA
 * wiring stay the one implementation.
 *
 * `getNote` and `isDisabled` (both optional; the Log/detail forms pass
 * neither) let Tonight's search box (issue 02) show why a row is off the
 * ranked list — a muted `· closed Mondays` / `· rejected tonight` / `·
 * already picked` suffix — and, for the last of those, block it from being
 * picked: `aria-disabled`, dimmed, and `onMouseDown` a no-op. ↑/↓ skipping a
 * disabled row is `useComboboxKeyboard`'s job, not this component's.
 */
export function OptionListbox<T extends OptionChoice | AddRow>({
  listId,
  matches,
  activeIndex,
  isSelected,
  showNoMatchesRow = false,
  onSelect,
  onHover,
  className,
  rowClassName = "",
  getNote,
  isDisabled,
}: {
  listId: string;
  matches: T[];
  activeIndex: number;
  isSelected: (option: T, index: number) => boolean;
  showNoMatchesRow?: boolean;
  onSelect: (option: T) => void;
  onHover: (index: number) => void;
  className: string;
  rowClassName?: string;
  /** A muted suffix note after the name (e.g. "closed Mondays"); omitted renders none. */
  getNote?: (option: T) => string | undefined;
  /** Rows this box must not let the Household select. */
  isDisabled?: (option: T) => boolean;
}) {
  return (
    <ul id={listId} role="listbox" className={className}>
      {matches.length === 0 && showNoMatchesRow ? (
        <li role="presentation" className="px-3 py-2 text-body text-muted">
          No matches
        </li>
      ) : (
        matches.map((option, index) => {
          const disabled = isDisabled?.(option) ?? false;
          const note = getNote?.(option);
          return (
            <li key={option.id} role="presentation">
              <div
                id={`${listId}-option-${option.id}`}
                role="option"
                tabIndex={-1}
                aria-selected={isSelected(option, index)}
                aria-disabled={disabled || undefined}
                className={`flex min-h-11 w-full flex-col justify-center
                  text-left ${
                    // An Add row has no kind yet: a neutral bar keeps the
                    // same inset without claiming one (DESIGN.md 2026-09-25).
                    isAddRow(option)
                      ? "border-l-[3px] border-l-line pl-2"
                      : kindBarClass(option.kind)
                  }
                  ${rowClassName} ${
                    disabled
                      ? "cursor-not-allowed opacity-60"
                      : "cursor-pointer"
                  } ${
                    index === activeIndex
                      ? "bg-raised"
                      : disabled
                        ? ""
                        : "hover:bg-raised"
                  }`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  if (disabled) return;
                  onSelect(option);
                }}
                onMouseEnter={() => onHover(index)}
              >
                {isAddRow(option) ? (
                  <span className="text-body font-emphasis text-action">
                    Add &ldquo;{option.name}&rdquo;…
                  </span>
                ) : (
                  <>
                    <span className="py-1.5 text-body text-ink">
                      {option.name}
                      {note && <span className="text-muted"> · {note}</span>}
                    </span>
                    <span className="pb-1.5 text-meta text-muted">
                      {kindLabel(option.kind)}
                    </span>
                  </>
                )}
              </div>
            </li>
          );
        })
      )}
    </ul>
  );
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
 *
 * `emptyQueryBehaviour` and `initialActiveIndex` are the only two axes Tonight's
 * search box (`app/tonight-screen.tsx`) needs to differ on — it renders this
 * same filter, keyboard contract, and dropdown (`filterOptionChoices`,
 * `useComboboxKeyboard`, `OptionListbox`) behind its own input, since its
 * query is shared with AI search rather than owned locally here.
 */
export function OptionCombobox({
  id,
  choices,
  value,
  valueName,
  onChange,
  placeholder = "Search Options",
  autoFocus = false,
  emptyQueryBehaviour = "all",
  initialActiveIndex = 0,
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
  /** What an empty query shows. Defaults to `"all"` — today's form behaviour. */
  emptyQueryBehaviour?: EmptyQueryBehaviour;
  /** The keyboard highlight a (re)opened field starts from. Defaults to `0`. */
  initialActiveIndex?: 0 | -1;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  /** The name of the picked Option — the field's reconcile target. */
  const pickedName = useMemo(() => {
    if (value === null) return "";
    return choices.find((o) => o.id === value)?.name ?? valueName ?? "";
  }, [value, valueName, choices]);

  // `query` is what the input shows. While closed it mirrors `pickedName`;
  // opening it lets the Household type freely. `open` gates the listbox.
  const [query, setQuery] = useState(pickedName);
  const [open, setOpen] = useState(false);
  // Track the last name the input synced from, so an external `value` change
  // (e.g. the "×" clear) flows into the closed field without an effect.
  const [syncedName, setSyncedName] = useState(pickedName);
  if (!open && syncedName !== pickedName) {
    setSyncedName(pickedName);
    setQuery(pickedName);
  }

  const matches = useMemo(
    () => filterOptionChoices(choices, query, emptyQueryBehaviour),
    [query, choices, emptyQueryBehaviour],
  );

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

  const { activeIndex, setActiveIndex, resetActiveIndex, handleKeyDown, activeId } =
    useComboboxKeyboard({
      open,
      setOpen,
      matches,
      initialActiveIndex,
      onSelect: selectOption,
      onEscape: reconcile,
    });

  // The list shows whenever open, unless an empty query is defined to show
  // nothing — mirroring Tonight's "quiet unless something matches" box, which
  // never surfaces a "No matches" row even for a non-matching typed query.
  const showList =
    open && (emptyQueryBehaviour === "all" || matches.length > 0);

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
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId(listId)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          resetActiveIndex();
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          // Re-focusing re-opens the list for another search: clear the
          // displayed name so the full list shows. The pick is untouched —
          // blur reconciles the field back to it if nothing new is chosen.
          setQuery("");
          setOpen(true);
          resetActiveIndex();
        }}
        onBlur={reconcile}
      />

      {(query.length > 0 || value !== null) && (
        <button
          type="button"
          aria-label="Clear Option"
          className={`absolute inset-y-0 right-0 flex w-11 items-center
            justify-center rounded-control text-muted hover:text-ink
            ${focusRing}`}
          onMouseDown={(event) => {
            event.preventDefault();
            clearPick();
          }}
        >
          <span aria-hidden="true">×</span>
        </button>
      )}

      {showList && (
        <OptionListbox
          listId={listId}
          matches={matches}
          activeIndex={activeIndex}
          isSelected={(option) => option.id === value}
          showNoMatchesRow
          onSelect={selectOption}
          onHover={setActiveIndex}
          className="absolute z-10 mt-1 flex max-h-64 w-full flex-col
            overflow-y-auto rounded-input border border-line bg-surface py-1
            shadow-sm"
        />
      )}
    </div>
  );
}
