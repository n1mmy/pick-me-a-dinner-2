# Option codes are letters, not integers

The snapshot refers to Options by a short label (ADR-0004, ADR-0011) and both
rankers write one label per row in rank order. With integer labels `1..N`, a
rank position is always a valid label, so a model that writes its place
where the Option belongs produces a row the parser cannot tell from a right
one: Strata, Opus and GLM have each done it, and the sweep stored a Catalog
in alphabetical order as a ranking. **Options are labelled with letter codes
(`A`…`Z`, `AA`…), so a rank written as a code resolves to nothing, the reply
falls under the ranked-share bar and is refused.** The code replaces the
number everywhere the snapshot named one — candidates, Log and Rejection rows,
the candidate checklist — and both prompts call it the Option's code.

## Considered options

- **Keep integers and cross-check each row against a name column.** This was
  v10–v13. The name column grew its own defects (shared names, `|` in a name,
  unmatched names leaking into the rationale) and a four-column row defeated
  the check anyway; each new reply shape needed a new parser branch.
- **Keep integers and offset them (`101..`).** Disjoint only while the Catalog
  stays under 100, and a model that drops a digit is back in the collision.
- **A rank column of its own**, so the rank has a home. Reintroduces
  column-position parsing, which is what failed.
