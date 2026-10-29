# Domain Docs

How the engineering skills consume this repo's domain documentation. The repo
is **single-context**: one `CONTEXT.md` (the glossary) and `docs/adr/` at the
root.

## Before exploring, read these

- `CONTEXT.md`.
- The ADRs in `docs/adr/` that touch the area you're about to work in.

## Use the glossary's vocabulary

When your output names a domain concept (an issue title, a refactor proposal,
a hypothesis, a test name), use the term as `CONTEXT.md` defines it, never a
synonym it lists under _Avoid_.

A concept you need that isn't in the glossary is a signal: either you're
inventing language the project doesn't use (reconsider) or there's a real gap
(note it for `/grill-with-docs`).

## Flag ADR conflicts

If your output contradicts an existing ADR, say so rather than silently
overriding:

> _Contradicts ADR-0007 (example decision) — but worth reopening because…_

## Amending an ADR

An ADR states the decision as it stands now, so a reader of one file never
sees a rule a later ADR has changed. When a later decision changes an earlier
ADR, rewrite the affected text in place and add one italic line under the
earlier ADR's title: `_Amended by ADR-NNNN: what changed._` (or a date, when
the change has no ADR of its own). Leave the narrative of what it used to say
to the commit message. Record evidence in the issue, not the ADR: an ADR
carries the decision and one line on why.
