# 03 — Tags on Options

Status: done
Type: AFK

## Parent

[PRD: Pick Me a Dinner — v1](../PRD.md)

## What to build

Tag attachment on the Catalog Option form. The Household attaches Tags to an
Option via an autocomplete token input: typing offers existing Tags and lets the
user create a new Tag inline. There is no separate Tags-management screen — this
token input is the only place Tags are created or changed.

Introduce the shared `normalizeTag` helper — a small pure function that trims
and lowercases a Tag string. Every Tag goes through it on input so "Pasta" and
"pasta " never become two Tags; the `tags.lower(name)` unique index from issue
01 enforces this at the DB level. `normalizeTag` is a *shared* helper because
the import script (issue 09) must normalize identically — the two call sites
cannot be allowed to drift.

Attaching and detaching Tags writes `option_tags` rows. A Tag that ends up with
no Options simply stops appearing anywhere; that is harmless and needs no
cleanup UI.

## Acceptance criteria

- [x] The Catalog Option form has an autocomplete token input that suggests
      existing Tags and creates a new Tag on free text
- [x] `normalizeTag` trims and lowercases; it is a shared pure function used by
      the tag-attach path (and later the import script)
- [x] Adding "Pasta" when "pasta" exists reuses the existing Tag — no duplicate
      row (case-insensitive uniqueness holds)
- [x] Tags attach/detach via `option_tags` and persist across reloads
- [x] `normalizeTag` has unit tests: trims, lowercases, leaves an already-normal
      Tag unchanged

## Blocked by

- Issue 02 — Catalog: Options CRUD
