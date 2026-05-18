# 02 — Catalog: Options CRUD

Status: done
Type: AFK

## Parent

[PRD: Pick Me a Dinner — v1](../PRD.md)

## What to build

The Catalog screen and its server actions — the first real vertical slice. The
Household can add, edit, list, Archive, and hard-delete Options (Home meals and
Restaurants), with manual data entry only (Google Places autofill is issue 07;
Tags are issue 03).

The Catalog renders Home meals and Restaurants in two sections, each row showing
the name. Adding and editing happen **inline** — the row (or an "add" affordance)
expands in place into a form, identical on phone and desktop. The Restaurant
form exposes the restaurant-only fields (address, phone, url, etc.) for manual
entry; the Home meal form has name, notes, and an optional `url` recipe link.

Archive sets `active = false` (the Option leaves the default Catalog list but
its Log history is unaffected). Hard-delete is allowed only for an Option with
zero Log entries; attempting to delete an Option with Log history must surface a
friendly inline "In your log — archive instead" message, never a 500 — i.e. the
`ON DELETE RESTRICT` violation is caught and translated. Destructive actions use
the §17 inline-confirm pattern ("Delete · Cancel" / "Archive · Cancel" in place,
no modal).

Cover the §17 interaction states for this screen (loading placeholder rows;
empty → "Add a meal or restaurant to get started"; blank-name inline field
error; saved Option appears/updates in place) and the §18 responsive/keyboard
rules.

## Acceptance criteria

- [x] Home meals and Restaurants can be added via an inline-expand form, listed
      in two sections, and edited inline
- [x] Archive sets `active = false`; archived Options drop out of the default
      Catalog list
- [x] Hard-delete works for an Option with zero Log entries
- [x] Deleting an Option with Log history shows the friendly inline "archive
      instead" message — no error page
- [x] Destructive actions require an inline "Delete/Archive · Cancel" confirm
      step
- [x] Loading / empty / error / success states match PRD §17 for Catalog
- [x] Server actions have tests: archive sets `active = false`; hard-delete is
      blocked for a logged Option and allowed for an unlogged one; blank name is
      rejected

## Blocked by

- Issue 01 — Walking skeleton (schema, scaffold, design tokens)
