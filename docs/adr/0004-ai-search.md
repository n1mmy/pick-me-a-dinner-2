# AI search as an additive layer over the deterministic ranking

_Amended by ADR-0011: when a Prepared note exists, its ranking is what loads on
Tonight, not the deterministic list._

v1 shipped with "no AI" as an explicit non-goal and ADR-0003 deliberately
keeping the Tonight ranking a pure, testable TypeScript function. We are now
adding **AI search**: a triggered, query-driven re-ranking of Tonight by Claude
(Anthropic API). It is **triggered, never the default**: no model call sits on
the page load. What loads on its own is the deterministic ranking, or a
**Prepared note**'s ranking written ahead by a free local model and stored
(ADR-0011). Either way the deterministic ranking stays the offline-proof floor
every AI layer falls back to. AI search runs only on a deliberate request,
replaces the list in-place and ephemerally, and degrades cleanly (inline error
on failure, search box hidden when no `ANTHROPIC_API_KEY` is set).

## Considered options

- **No AI (status quo).** The deterministic Score is good at recency and
  variety but cannot interpret intent — "something light", "we have guests" —
  and cannot find soft patterns in Log history.
- **AI replaces the deterministic ranking.** Rejected: it would put a
  non-deterministic external API call on the critical path of the home screen,
  and discard a pure, unit-tested ranking for a feature that can be offline or
  fail. (ADR-0011 later puts an AI ranking on the home screen without a call
  on the critical path, by writing it ahead and storing it.)
- **AI as an additive, triggered layer (chosen).** Keeps the deterministic
  ranking as the fail-safe; AI search is opt-in and can fail back to it with
  nothing lost.

## Consequences

- ADR-0003 is unchanged: the deterministic ranking stays in TypeScript and
  stays the floor. AI search does not touch `lib/ranking.ts`.
- A new external dependency (Anthropic API) and credential (`ANTHROPIC_API_KEY`)
  enter the system. The feature is absent, not broken, when the key is unset.
- AI search is non-deterministic and uncached by design — a search is a
  deliberate one-off act, so run-to-run variance is acceptable.
