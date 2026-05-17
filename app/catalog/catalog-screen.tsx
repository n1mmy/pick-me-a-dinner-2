"use client";

import { useState } from "react";
import type { OptionWithTags } from "../../db/queries";
import type { OptionKind } from "./actions";
import { OptionForm } from "./option-form";
import { OptionRow } from "./option-row";

/**
 * The Catalog screen: Home meals and Restaurants in two sections, each row
 * showing the name. Adding and editing happen inline — an "add" affordance or a
 * row expands in place into the form. `allTags` feeds every form's Tag
 * autocomplete.
 */
export function CatalogScreen({
  home,
  restaurants,
  allTags,
  placesEnabled,
}: {
  home: OptionWithTags[];
  restaurants: OptionWithTags[];
  allTags: string[];
  placesEnabled: boolean;
}) {
  const isEmpty = home.length === 0 && restaurants.length === 0;

  return (
    <main className="column flex min-h-screen flex-col gap-5.5 pb-24 pt-5.5 desktop:pb-12">
      <h1 className="font-display text-h1 font-h1 text-ink">Catalog</h1>
      {isEmpty && (
        <p className="text-body text-muted">
          Add a meal or restaurant to get started
        </p>
      )}
      <OptionSection
        kind="home"
        title="Home meals"
        addLabel="Add a meal"
        options={home}
        allTags={allTags}
        placesEnabled={placesEnabled}
      />
      <OptionSection
        kind="restaurant"
        title="Restaurants"
        addLabel="Add a restaurant"
        options={restaurants}
        allTags={allTags}
        placesEnabled={placesEnabled}
      />
    </main>
  );
}

/** One kind's section: a heading, its rows, and the inline-expand add form. */
function OptionSection({
  kind,
  title,
  addLabel,
  options,
  allTags,
  placesEnabled,
}: {
  kind: OptionKind;
  title: string;
  addLabel: string;
  options: OptionWithTags[];
  allTags: string[];
  placesEnabled: boolean;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-meta font-emphasis uppercase tracking-wide text-muted">
        {title}
      </h2>
      {options.length > 0 && (
        <ul className="flex flex-col">
          {options.map((option) => (
            <OptionRow
              key={option.id}
              option={option}
              allTags={allTags}
              placesEnabled={placesEnabled}
            />
          ))}
        </ul>
      )}
      {adding ? (
        <div className="border-b border-line py-3">
          <OptionForm
            kind={kind}
            allTags={allTags}
            placesEnabled={placesEnabled}
            onCancel={() => setAdding(false)}
            onSaved={() => setAdding(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="min-h-11 self-start rounded-control px-2 text-body
            font-emphasis text-action focus-visible:outline focus-visible:outline-2
            focus-visible:outline-offset-2 focus-visible:outline-action"
        >
          + {addLabel}
        </button>
      )}
    </section>
  );
}
