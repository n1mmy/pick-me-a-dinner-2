"use client";

import {
  type FormEvent,
  type HTMLInputTypeAttribute,
  type InputHTMLAttributes,
  type ReactNode,
  useId,
  useState,
  useTransition,
} from "react";
import type { OptionWithTags } from "../../db/queries";
import { WEEKDAY_NAMES } from "../../lib/local-day";
import { escapeToCancel } from "../escape-to-cancel";
import {
  createOption,
  updateOption,
  type OptionFormValues,
  type OptionKind,
} from "./actions";
import type { PlaceAutofill } from "./places-box";
import { PlacesSearchBox } from "./places-search-box";
import { TagInput } from "./tag-input";

const labelClass = "text-meta font-emphasis uppercase tracking-wide text-muted";
const inputClass =
  "min-h-11 rounded-input border border-line bg-surface px-3 text-body text-ink " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-action";
const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-action";
/** `S M T W T F S`, Sunday first — matching the `0` = Sunday convention. */
const SHORT_WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

/** Whether two Closed-day sets hold the same weekdays, order aside. */
function sameDays(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((day) => b.includes(day));
}

/**
 * The inline add/edit form for one Option — identical on phone and desktop. An
 * `initial` Option means edit; its absence means add. The Restaurant form
 * exposes the restaurant-only fields for manual entry, and — when `placesEnabled`
 * — a "Search Google" box whose selection autofills those fields (every one
 * stays editable afterward). `allTags` is the Tag vocabulary the token input
 * suggests from.
 *
 * The visible list is short and flat by design: Name, the website/menu link
 * (the field worth a glance most often), Closed days (a live ranking rule,
 * not trivia), Notes, and Tags. Address / Phone / Maps link / Latitude /
 * Longitude / Google place ID — facts the Household already knows or that
 * only a Places match writes — collapse into a single "Location" disclosure
 * instead of padding out the main list. Save holds "Saved ✓" briefly
 * (mirroring `PickButton`) before `onSaved` fires, so a save is never silent.
 */
export function OptionForm({
  kind,
  initial,
  allTags,
  placesEnabled,
  onCancel,
  onSaved,
}: {
  kind: OptionKind;
  initial?: OptionWithTags;
  allTags: string[];
  placesEnabled: boolean;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const fieldId = useId();
  const [name, setName] = useState(initial?.name ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  // A Places autofill leaves an already-filled URL untouched; this flags that
  // so the URL field can disclose it was kept rather than overwritten.
  const [urlKept, setUrlKept] = useState(false);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [mapsUrl, setMapsUrl] = useState(initial?.mapsUrl ?? "");
  const [lat, setLat] = useState(initial?.lat != null ? String(initial.lat) : "");
  const [lng, setLng] = useState(initial?.lng != null ? String(initial.lng) : "");
  const [googlePlaceId, setGooglePlaceId] = useState(
    initial?.googlePlaceId ?? "",
  );
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [closedDays, setClosedDays] = useState<number[]>(
    initial?.closedDays ?? [],
  );
  // A Places autofill sets this so the toggles can disclose they came from
  // Google's hours, not hand entry; a manual toggle afterward clears it, the
  // same shape as `urlKept` guarding the URL field's note.
  const [closedDaysSynced, setClosedDaysSynced] = useState(false);
  // Whether the sync above actually changed the toggles (vs. Google agreeing
  // with what was already there) — the note wording differs because a
  // replace can silently undo a hand correction, which is worth calling out.
  const [closedDaysReplaced, setClosedDaysReplaced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Holds "Saved ✓" on the submit button for a beat before `onSaved` fires —
  // otherwise a save that collapses or navigates the form away is completely
  // silent (no toast, nothing to see happen).
  const [justSaved, setJustSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const isRestaurant = kind === "restaurant";
  // The only validation error that is actually about the Name field; every
  // other server error (e.g. "That option is no longer available" — the
  // Option was deleted out from under an in-progress edit) is form-level and
  // must not mark the Name field invalid.
  const nameError = error === "Enter a name" ? error : null;
  const formError = error && !nameError ? error : null;
  // The Location disclosure opens by default only when there is already
  // something in it to see (an existing Restaurant with any of these
  // fields on file); a fresh add starts collapsed since it's empty until a
  // Places search — or hand entry — fills it.
  const [hasLocationData] = useState(
    () =>
      isRestaurant &&
      (Boolean(initial?.address) ||
        Boolean(initial?.phone) ||
        Boolean(initial?.mapsUrl) ||
        initial?.lat != null ||
        Boolean(initial?.googlePlaceId)),
  );

  /**
   * Apply a Google place's detail to the fields — all stay editable after. An
   * already-filled URL is kept, not overwritten: a hand-picked menu link is
   * usually better than the Place's generic website, so a match flags
   * `urlKept` instead of clobbering it. Closed days follow Google's regular
   * hours when it has any, *replacing* whatever the toggles held — including
   * a prior hand correction — since a re-sync is a deliberate "trust Google
   * again" action; with no hours on file the toggles are left as they are.
   * `closedDaysReplaced` records whether that overwrite actually changed
   * anything, so the disclosure note can say so.
   */
  function applyAutofill(autofill: PlaceAutofill) {
    setName(autofill.name);
    setAddress(autofill.address);
    setPhone(autofill.phone);
    setLat(autofill.lat);
    setLng(autofill.lng);
    if (url) {
      setUrlKept(true);
    } else {
      setUrl(autofill.url);
      setUrlKept(false);
    }
    setMapsUrl(autofill.mapsUrl);
    setGooglePlaceId(autofill.googlePlaceId);
    if (autofill.closedDays !== null) {
      setClosedDaysReplaced(!sameDays(closedDays, autofill.closedDays));
      setClosedDays(autofill.closedDays);
      setClosedDaysSynced(true);
    } else {
      // Google has no hours for *this* match — the toggles keep whatever
      // they held, but that's no longer something Google just told us, so
      // the "Set from Google's hours" note must not keep claiming it is.
      setClosedDaysSynced(false);
    }
  }

  /** A manual toggle always wins over — and clears the disclosure for — a
   *  prior Google sync, the same reasoning as the URL field's `urlKept`. */
  function handleClosedDaysChange(next: number[]) {
    setClosedDays(next);
    setClosedDaysSynced(false);
    setClosedDaysReplaced(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const values: OptionFormValues = {
      name,
      url,
      notes,
      address,
      phone,
      mapsUrl,
      lat,
      lng,
      googlePlaceId,
      tags,
      closedDays,
    };
    startTransition(async () => {
      const result = initial
        ? await updateOption(initial.id, kind, values)
        : await createOption(kind, values);
      if (result.ok) {
        // Hold "Saved ✓" briefly before handing off — the same beat
        // `PickButton` gives "Logged ✓" — so the save is visible even though
        // `onSaved` immediately collapses or navigates away from this form.
        setJustSaved(true);
        window.setTimeout(onSaved, 700);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    // `pb-[80px]` (not an on-scale step — an explicit px value, per
    // DESIGN.md's spacing-scale note on why arbitrary Tailwind defaults are
    // unsafe here) reserves the space the `fixed` Save/Cancel bar no longer
    // holds in flow (~69px: the 44px buttons, its own 24px vertical padding,
    // its 1px top border) — otherwise the bar would overlap the form's own
    // last field once it's out of flow.
    <form
      onSubmit={handleSubmit}
      onKeyDown={escapeToCancel(onCancel, pending || justSaved)}
      className="flex flex-col gap-3 pb-[80px]"
    >
      {isRestaurant && placesEnabled && (
        <PlacesSearchBox
          onAutofill={applyAutofill}
          label={initial ? "Re-sync from Google" : "Start from Google"}
          initialQuery={initial?.name ?? ""}
        />
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor={`${fieldId}-name`} className={labelClass}>
          {isRestaurant ? "Restaurant name" : "Meal name"}
        </label>
        <input
          id={`${fieldId}-name`}
          className={inputClass}
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={nameError !== null}
          aria-describedby={nameError ? `${fieldId}-error` : undefined}
        />
        {nameError && (
          <p
            id={`${fieldId}-error`}
            className="text-chip text-danger"
            role="alert"
          >
            {nameError}
          </p>
        )}
      </div>

      <TextField
        id={`${fieldId}-url`}
        label={isRestaurant ? "Website or menu link" : "Recipe link"}
        value={url}
        onChange={(value) => {
          setUrl(value);
          setUrlKept(false);
        }}
        type="url"
        inputMode="url"
        note={
          urlKept
            ? "Kept your existing link — not updated from the Google match."
            : undefined
        }
      />

      {isRestaurant && (
        <ClosedDayToggles
          id={`${fieldId}-closed-days`}
          value={closedDays}
          onChange={handleClosedDaysChange}
          note={
            closedDaysSynced
              ? closedDaysReplaced
                ? "Replaced with Google's hours — edit if it's wrong."
                : "Set from Google's hours — edit if it's wrong."
              : undefined
          }
        />
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor={`${fieldId}-notes`} className={labelClass}>
          Notes
        </label>
        <textarea
          id={`${fieldId}-notes`}
          className={`${inputClass} py-2`}
          rows={2}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          onKeyDown={(event) => {
            if (pending) return;
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
      </div>

      <TagInput value={tags} onChange={setTags} suggestions={allTags} />

      {isRestaurant && (
        <details
          className="flex flex-col gap-3 rounded-input border border-line p-3"
          {...(hasLocationData ? { open: true } : {})}
        >
          <summary
            className={`${labelClass} cursor-pointer select-none ${focusRing}`}
          >
            Location
          </summary>
          <TextField
            id={`${fieldId}-address`}
            label="Address"
            value={address}
            onChange={setAddress}
            autoComplete="street-address"
          />
          <TextField
            id={`${fieldId}-phone`}
            label="Phone"
            value={phone}
            onChange={setPhone}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
          />
          <TextField
            id={`${fieldId}-maps`}
            label="Maps link"
            value={mapsUrl}
            onChange={setMapsUrl}
            type="url"
            inputMode="url"
          />
          <TextField
            id={`${fieldId}-lat`}
            label="Latitude"
            value={lat}
            onChange={setLat}
            inputMode="decimal"
          />
          <TextField
            id={`${fieldId}-lng`}
            label="Longitude"
            value={lng}
            onChange={setLng}
            inputMode="decimal"
          />
          <TextField
            id={`${fieldId}-place-id`}
            label="Google place ID"
            value={googlePlaceId}
            onChange={setGooglePlaceId}
          />
        </details>
      )}

      {formError && (
        <p className="text-chip text-danger" role="alert">
          {formError}
        </p>
      )}

      {/* A fixed footer bar, not a `sticky` one — `sticky` only ever bleeds
          to the edges of `.column`'s own padding, and on desktop `.column`
          is a 900px box centered with leftover margin on either side (see
          `.column` in globals.css), so the bar read as inset rather than
          full-width. `fixed` escapes that entirely: `inset-x-0` on mobile,
          `desktop:left-[var(--rail-width)]` (matching `AppNav`'s own left
          rail) with `right: 0` carried over from `inset-x-0` on desktop —
          truly edge-to-edge either way. The bottom offset clears the mobile
          tab bar (its own height plus the safe-area inset); desktop has no
          bottom bar, so it sits flush with the viewport edge. Taking the bar
          out of flow means the form needs its own trailing clearance so the
          fixed bar never covers the last field — see the `pb-[80px]` on
          `<form>`. The inner `.column` re-applies the page's own centering
          and padding so Save/Cancel land under the same fields above them,
          instead of hugging the far-left edge of the now much wider bar. */}
      <div
        className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))]
          z-10 border-t border-divider bg-surface desktop:bottom-0
          desktop:left-[var(--rail-width)]"
      >
        <div className="column flex items-center gap-2 py-3">
          <button
            type="submit"
            disabled={pending || justSaved}
            className={`min-h-11 rounded-control px-4 text-body font-emphasis
              transition-colors duration-micro disabled:opacity-60 ${focusRing} ${
                justSaved
                  ? "bg-raised text-success"
                  : "bg-action text-action-ink hover:bg-action-hover"
              }`}
          >
            {justSaved ? "Saved ✓" : initial ? "Save" : "Add"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending || justSaved}
            className={`min-h-11 rounded-control px-3 text-body text-muted
              disabled:opacity-60 ${focusRing}`}
          >
            Cancel
          </button>
          {/* A sibling live region, not `aria-live` on the button itself —
              the button is usually still focused when its label flips
              (PickButton's same reasoning). */}
          <p className="sr-only" role="status" aria-live="polite">
            {justSaved ? "Saved" : ""}
          </p>
        </div>
      </div>
    </form>
  );
}

/** A labeled single-line text field, with an optional note below the input. */
function TextField({
  id,
  label,
  value,
  onChange,
  note,
  type = "text",
  inputMode,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  note?: ReactNode;
  type?: HTMLInputTypeAttribute;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
}) {
  const noteId = `${id}-note`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={note ? noteId : undefined}
      />
      {note && (
        <p id={noteId} className="text-chip text-muted">
          {note}
        </p>
      )}
    </div>
  );
}

/**
 * The Restaurant form's Closed-days control — seven toggle chips in one row,
 * `S M T W T F S`, Sunday first (`0` = Sunday). `DESIGN.md`'s "Closed-day
 * toggles (2026-09-19 exception to control height)": seven 44px targets plus
 * gaps overrun a 375px viewport, and wrapping or stacking destroys the
 * week-shape the control is read by, so the chips sit at 36px (`h-9`) and
 * fill the row's width evenly instead. Each chip carries `aria-pressed` and
 * an accessible name naming the full day and its state — a bare "S" is
 * ambiguous between Saturday and Sunday even visually. `note` — the
 * post-Google-match disclosure — renders below the row exactly like
 * `TextField`'s own optional note.
 */
function ClosedDayToggles({
  id,
  value,
  onChange,
  note,
}: {
  id: string;
  value: number[];
  onChange: (value: number[]) => void;
  note?: ReactNode;
}) {
  function toggle(day: number) {
    onChange(
      value.includes(day)
        ? value.filter((d) => d !== day)
        : [...value, day].sort((a, b) => a - b),
    );
  }

  const noteId = `${id}-note`;
  return (
    <div className="flex flex-col gap-1">
      <span className={labelClass}>Closed days</span>
      <div
        role="group"
        aria-label="Closed days"
        aria-describedby={note ? noteId : undefined}
        className="flex gap-1"
      >
        {SHORT_WEEKDAYS.map((short, day) => {
          const closed = value.includes(day);
          return (
            <button
              key={day}
              type="button"
              aria-pressed={closed}
              aria-label={`${WEEKDAY_NAMES[day]}: ${closed ? "closed" : "open"}`}
              onClick={() => toggle(day)}
              className={`h-9 flex-1 rounded-control border text-body font-emphasis
                transition-colors duration-short ${focusRing} ${
                closed
                  ? "border-action bg-action text-action-ink"
                  : "border-line bg-surface text-ink hover:bg-raised"
              }`}
            >
              {short}
            </button>
          );
        })}
      </div>
      {note && (
        <p id={noteId} className="text-chip text-muted">
          {note}
        </p>
      )}
    </div>
  );
}
