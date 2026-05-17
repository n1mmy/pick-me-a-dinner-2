"use client";

import { useId, useState, useTransition } from "react";
import { fetchPlaceDetails, searchGooglePlaces } from "./places-actions";
import {
  PLACES_UNAVAILABLE_NOTICE,
  autofillFromPlace,
  boxStateFromSearch,
  type PlaceAutofill,
  type PlacesBoxState,
} from "./places-box";

const labelClass = "text-meta font-emphasis uppercase tracking-wide text-muted";
const inputClass =
  "min-h-11 rounded-input border border-line bg-surface px-3 text-body text-ink " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-action";

/**
 * The "Search Google" box on the Restaurant form. Rendered only when a Places
 * API key is configured (the parent gates on `placesEnabled`). Searching, or
 * picking a hit, calls a Places server action; selecting a result autofills
 * the parent form via `onAutofill`. Any Places failure swaps the box for an
 * inline notice — the manual fields stay editable, so a save still works.
 */
export function PlacesSearchBox({
  onAutofill,
}: {
  onAutofill: (autofill: PlaceAutofill) => void;
}) {
  const fieldId = useId();
  const [query, setQuery] = useState("");
  const [state, setState] = useState<PlacesBoxState>({ status: "idle" });
  const [pending, startTransition] = useTransition();

  function runSearch() {
    if (query.trim().length === 0) return;
    startTransition(async () => {
      setState(boxStateFromSearch(await searchGooglePlaces(query)));
    });
  }

  function selectPlace(placeId: string) {
    startTransition(async () => {
      const result = await fetchPlaceDetails(placeId);
      if (result.ok) {
        onAutofill(autofillFromPlace(result.value));
      } else {
        setState({ status: "unavailable" });
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-input border border-line p-3">
      <label htmlFor={`${fieldId}-query`} className={labelClass}>
        Search Google
      </label>
      <div className="flex items-center gap-2">
        <input
          id={`${fieldId}-query`}
          className={`${inputClass} flex-1`}
          value={query}
          placeholder="Restaurant name or address"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              runSearch();
            }
          }}
        />
        <button
          type="button"
          onClick={runSearch}
          disabled={pending || query.trim().length === 0}
          className="min-h-11 rounded-control bg-action px-3 text-body font-emphasis
            text-action-ink transition-colors duration-micro hover:bg-action-hover
            focus-visible:outline focus-visible:outline-2
            focus-visible:outline-offset-2 focus-visible:outline-action
            disabled:opacity-60"
        >
          Search
        </button>
      </div>

      {state.status === "unavailable" && (
        <p className="text-chip text-muted">{PLACES_UNAVAILABLE_NOTICE}</p>
      )}

      {state.status === "results" && state.results.length === 0 && (
        <p className="text-chip text-muted">No matches — enter details manually</p>
      )}

      {state.status === "results" && state.results.length > 0 && (
        <ul className="flex flex-col">
          {state.results.map((result) => (
            <li key={result.placeId} className="border-b border-line last:border-b-0">
              <button
                type="button"
                onClick={() => selectPlace(result.placeId)}
                disabled={pending}
                className="flex min-h-11 w-full flex-col items-start py-2 text-left
                  focus-visible:outline focus-visible:outline-2
                  focus-visible:outline-offset-2 focus-visible:outline-action
                  disabled:opacity-60"
              >
                <span className="font-display text-name font-name text-ink">
                  {result.name}
                </span>
                <span className="text-chip text-muted">{result.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
