# 01 — Tonight shows a stored Prepared note whenever one exists

Status: done
Type: AFK

## Parent

[Spec: Browser tests](../PRD.md)

## What to build

With no local model configured, a stored **Prepared note** for the
**Selected day** still shows on **Tonight**, and after a model switch a note
reads current until the sweep rewrites it. The `LOCAL_AI_*` variables
control generation only, as ADR-0011 says.

- Tonight drops its "local model configured" guard and always asks for the
  Selected day's stored note. With no note, Tonight is as before.
- The read judges current against out of date by hashing the date's current
  snapshot with the model recorded on the stored note, not the configured
  model. Its doc comment says what the label now means: the Household's
  inputs moved on since the note was written; after a model switch the note
  reads current until the sweep rewrites it.
- The sweep's own gate is unchanged.

Tests in the existing Prepared notes DB suite, next to the `preparedNoteFor`
cases, red first: a note hashed with its own model reads current while the
configured model names a different one, and while it is unset. Kept as a
guard, already green: the read returns a stored note with no `LOCAL_AI_*`
set. Still held: an input change flips it out of date; decided and past
dates read frozen.

Commit this on its own. The guard removal on the page has no unit test; the
Tonight spec in ticket 03 proves it.

## Acceptance criteria

- [x] Tonight shows the Selected day's stored note with no `LOCAL_AI_*` set
- [x] A stored note reads current while `LOCAL_AI_MODEL` names a model other than the one recorded on it, and while it is unset
- [x] An input change still flips a note out of date; decided and past dates still read frozen
- [x] The read's doc comment states the new meaning of out of date
- [x] Unit and DB suites green, typecheck and lint clean

## Blocked by

None (can start immediately).

## Comments

- Done. Two new `preparedNoteFor` cases went red against the configured-model
  hash and green once the read hashed with `stored.model`. The page-level
  guard removal is proven by ticket 03's Tonight spec.
