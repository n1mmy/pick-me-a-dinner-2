"use client";

import Link from "next/link";
import { useState } from "react";
import type { ArchivedOption, OptionWithTags } from "../../db/queries";
import type { OptionKind } from "./actions";
import { OptionForm } from "./option-form";
import { OptionRow } from "./option-row";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-action";

/**
 * The Catalog screen: Home meals and Restaurants in two sections, each row
 * showing the name. Adding and editing happen inline — an "add" affordance or a
 * row expands in place into the form. `allTags` feeds every form's Tag
 * autocomplete. Archived Options are reachable again from a collapsed
 * "Archived" disclosure pinned below the two active sections.
 */
export function CatalogScreen({
  home,
  restaurants,
  archived,
  allTags,
  placesEnabled,
}: {
  home: OptionWithTags[];
  restaurants: OptionWithTags[];
  archived: ArchivedOption[];
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
      {archived.length > 0 && <ArchivedDisclosure archived={archived} />}
    </main>
  );
}

/**
 * The "Archived (N)" disclosure pinned at the bottom of the Catalog, after the
 * active sections — collapsed by default so it costs no screen space until the
 * Household scrolls to it; the pattern mirrors Tonight's "Rejected tonight"
 * disclosure. Expanded, it lists Archived Options as links to their detail
 * pages, the place an Archived Option can be Un-archived. It is rendered only
 * when something is Archived, so the active Catalog reads exactly as before.
 */
function ArchivedDisclosure({ archived }: { archived: ArchivedOption[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((isOpen) => !isOpen)}
        className={`min-h-11 self-start rounded-control border border-line
          px-4 text-body font-emphasis text-action transition-colors
          duration-short hover:bg-raised ${focusRing}`}
      >
        {`Archived (${archived.length})`}
      </button>
      {open && (
        <ul className="flex flex-col">
          {archived.map((option) => (
            <li key={option.id} className="flex border-b border-line py-3">
              <Link
                href={`/catalog/${option.id}`}
                className={`font-display text-name font-name text-ink
                  underline-offset-2 hover:underline ${focusRing}`}
              >
                {option.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
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
