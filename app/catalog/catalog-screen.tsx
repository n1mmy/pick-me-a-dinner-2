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
 * showing the name. Two add buttons sit in the header beside the title — the
 * Catalog's add affordance, each tinted its meal-kind hue; clicking one
 * expands its `OptionForm` below the header. Editing happens inline — a row
 * expands in place into the form. `allTags` feeds every form's Tag
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
  // Which kind's add form is open, or `null`. The two add buttons in the
  // header stay put; clicking one opens its `OptionForm` below the header,
  // and saving or cancelling closes it.
  const [adding, setAdding] = useState<OptionKind | null>(null);

  return (
    <main className="column flex min-h-screen flex-col gap-5.5 pb-24 pt-5.5 desktop:pb-12">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="font-display text-h1 font-h1 text-ink">Catalog</h1>
        <div className="flex gap-2">
          <AddButton
            kind="home"
            label="Add a meal"
            onClick={() => setAdding("home")}
          />
          <AddButton
            kind="restaurant"
            label="Add a restaurant"
            onClick={() => setAdding("restaurant")}
          />
        </div>
      </div>
      {adding && (
        <OptionForm
          key={adding}
          kind={adding}
          allTags={allTags}
          placesEnabled={placesEnabled}
          onCancel={() => setAdding(null)}
          onSaved={() => setAdding(null)}
        />
      )}
      {isEmpty && !adding && (
        <p className="text-body text-muted">
          Add a meal or restaurant to get started
        </p>
      )}
      <OptionSection
        title="Home meals"
        options={home}
        allTags={allTags}
        placesEnabled={placesEnabled}
      />
      <OptionSection
        title="Restaurants"
        options={restaurants}
        allTags={allTags}
        placesEnabled={placesEnabled}
      />
      {archived.length > 0 && <ArchivedDisclosure archived={archived} />}
    </main>
  );
}

/**
 * One of the two Catalog add buttons, in the header beside the title. Filled
 * with its meal-kind hue — teal `kind-home` for "Add a meal", plum
 * `kind-restaurant` for "Add a restaurant" — so the add affordance carries the
 * same kind coding the rows do.
 */
function AddButton({
  kind,
  label,
  onClick,
}: {
  kind: OptionKind;
  label: string;
  onClick: () => void;
}) {
  // Full literal class strings — Tailwind's content scan needs to see them.
  const fill = kind === "home" ? "bg-kind-home" : "bg-kind-restaurant";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 rounded-control px-4 text-body font-emphasis
        text-action-ink transition-opacity duration-short hover:opacity-90
        ${fill} ${focusRing}`}
    >
      {label}
    </button>
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

/** One kind's section: a heading and its rows. */
function OptionSection({
  title,
  options,
  allTags,
  placesEnabled,
}: {
  title: string;
  options: OptionWithTags[];
  allTags: string[];
  placesEnabled: boolean;
}) {
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
    </section>
  );
}
