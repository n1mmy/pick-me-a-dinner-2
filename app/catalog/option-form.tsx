"use client";

import { type FormEvent, useId, useState, useTransition } from "react";
import type { OptionWithTags } from "../../db/queries";
import {
  createOption,
  updateOption,
  type OptionFormValues,
  type OptionKind,
} from "./actions";
import { TagInput } from "./tag-input";

const labelClass = "text-meta font-emphasis uppercase tracking-wide text-muted";
const inputClass =
  "min-h-11 rounded-input border border-line bg-surface px-3 text-body text-ink " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-accent";

/**
 * The inline add/edit form for one Option — identical on phone and desktop. An
 * `initial` Option means edit; its absence means add. The Restaurant form
 * exposes the restaurant-only fields for manual entry (Places autofill is a
 * later issue). `allTags` is the Tag vocabulary the token input suggests from.
 */
export function OptionForm({
  kind,
  initial,
  allTags,
  onCancel,
  onSaved,
}: {
  kind: OptionKind;
  initial?: OptionWithTags;
  allTags: string[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const fieldId = useId();
  const [name, setName] = useState(initial?.name ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [mapsUrl, setMapsUrl] = useState(initial?.mapsUrl ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isRestaurant = kind === "restaurant";

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
      tags,
    };
    startTransition(async () => {
      const result = initial
        ? await updateOption(initial.id, kind, values)
        : await createOption(kind, values);
      if (result.ok) {
        onSaved();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor={`${fieldId}-name`} className={labelClass}>
          {isRestaurant ? "Restaurant name" : "Meal name"}
        </label>
        <input
          id={`${fieldId}-name`}
          className={inputClass}
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={error !== null}
          aria-describedby={error ? `${fieldId}-error` : undefined}
        />
        {error && (
          <p id={`${fieldId}-error`} className="text-chip text-danger">
            {error}
          </p>
        )}
      </div>

      {isRestaurant && (
        <>
          <TextField
            id={`${fieldId}-address`}
            label="Address"
            value={address}
            onChange={setAddress}
          />
          <TextField
            id={`${fieldId}-phone`}
            label="Phone"
            value={phone}
            onChange={setPhone}
          />
        </>
      )}

      <TextField
        id={`${fieldId}-url`}
        label={isRestaurant ? "Website or menu link" : "Recipe link"}
        value={url}
        onChange={setUrl}
      />

      {isRestaurant && (
        <TextField
          id={`${fieldId}-maps`}
          label="Maps link"
          value={mapsUrl}
          onChange={setMapsUrl}
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
        />
      </div>

      <TagInput value={tags} onChange={setTags} suggestions={allTags} />

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-control bg-accent px-4 text-body font-emphasis
            text-surface focus-visible:outline focus-visible:outline-2
            focus-visible:outline-offset-2 focus-visible:outline-accent
            disabled:opacity-60"
        >
          {initial ? "Save" : "Add"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="min-h-11 rounded-control px-3 text-body text-muted
            focus-visible:outline focus-visible:outline-2
            focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/** A labeled single-line text field. */
function TextField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
