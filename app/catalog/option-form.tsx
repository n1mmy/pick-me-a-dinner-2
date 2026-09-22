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
/**
 * A form-internal group heading — one step stronger than a field's own
 * `labelClass` (text-ink, not text-muted) so "Where" / "Details" read as
 * structure above a run of fields, not as one more field label. The hairline
 * above each group (skipped on the first) turns the long flat form into a
 * scannable sequence, the same ledger-divider idiom the rest of the app uses.
 */
const groupHeading =
  "text-chip font-emphasis uppercase tracking-wide text-ink border-t " +
  "border-divider pt-3 first:border-t-0 first:pt-0";
/** `S M T W T F S`, Sunday first — matching the `0` = Sunday convention. */
const SHORT_WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * The inline add/edit form for one Option — identical on phone and desktop. An
 * `initial` Option means edit; its absence means add. The Restaurant form
 * exposes the restaurant-only fields for manual entry, and — when `placesEnabled`
 * — a "Search Google" box whose selection autofills those fields (every one
 * stays editable afterward). `allTags` is the Tag vocabulary the token input
 * suggests from.
 *
 * Fields are grouped (Where / Details) with a Google-written "Google data"
 * disclosure for the rarely-touched lat/lng/place-ID trio, rather than one
 * flat run of 13 equal-weight controls. Save holds "Saved ✓" briefly
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
  // The Google data disclosure opens by default only when there is already
  // something in it to see (an existing Places-sourced Restaurant); a fresh
  // add starts collapsed since it's empty until a Places search fills it.
  const [hasGoogleData] = useState(
    () => isRestaurant && (initial?.lat != null || Boolean(initial?.googlePlaceId)),
  );

  /**
   * Apply a Google place's detail to the fields — all stay editable after. An
   * already-filled URL is kept, not overwritten: a hand-picked menu link is
   * usually better than the Place's generic website, so a match flags
   * `urlKept` instead of clobbering it.
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {isRestaurant && placesEnabled && (
        <PlacesSearchBox
          onAutofill={applyAutofill}
          label={initial ? "Re-sync from Google" : "Start from Google"}
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

      {isRestaurant && (
        <div className="flex flex-col gap-3">
          <h3 className={groupHeading}>Where</h3>
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
          <ClosedDayToggles value={closedDays} onChange={setClosedDays} />
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h3 className={groupHeading}>Details</h3>
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
      </div>

      {isRestaurant && (
        <details
          className="flex flex-col gap-3 rounded-input border border-line p-3"
          {...(hasGoogleData ? { open: true } : {})}
        >
          <summary
            className={`${labelClass} cursor-pointer select-none ${focusRing}`}
          >
            Google data
          </summary>
          <p className="-mt-1 text-chip text-muted">
            Written by a Google Places match; only worth touching by hand if
            it&rsquo;s wrong.
          </p>
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

      {/* Bleeds full-width out of the form's own column padding so it reads
          as a footer bar, not one more gapped row; sticks above the mobile
          tab bar (its own height + the safe-area inset) so Save/Cancel never
          sit a scroll away on a long Restaurant form. Desktop's taller
          viewport and side rail don't need the sticking — it goes static
          there. */}
      <div
        className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10
          -mx-4 flex items-center gap-2 border-t border-divider bg-surface
          px-4 py-3 desktop:static desktop:mx-0 desktop:border-t-0
          desktop:bg-transparent desktop:px-0 desktop:py-0"
      >
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
        {/* A sibling live region, not `aria-live` on the button itself — the
            button is usually still focused when its label flips (PickButton's
            same reasoning). */}
        <p className="sr-only" role="status" aria-live="polite">
          {justSaved ? "Saved" : ""}
        </p>
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
      />
      {note && <p className="text-chip text-muted">{note}</p>}
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
 * ambiguous between Saturday and Sunday even visually.
 */
function ClosedDayToggles({
  value,
  onChange,
}: {
  value: number[];
  onChange: (value: number[]) => void;
}) {
  function toggle(day: number) {
    onChange(
      value.includes(day)
        ? value.filter((d) => d !== day)
        : [...value, day].sort((a, b) => a - b),
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span className={labelClass}>Closed days</span>
      <div role="group" aria-label="Closed days" className="flex gap-1">
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
    </div>
  );
}
