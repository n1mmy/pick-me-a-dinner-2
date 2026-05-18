# PRD: AI search on Tonight

Status: ready-for-agent

Vocabulary: [`CONTEXT.md`](../../CONTEXT.md) — the **AI search** and **AI
rationale** terms (added in the v2 grill session) govern this PRD. Decisions:
[`docs/adr/0004-ai-search.md`](../../docs/adr/0004-ai-search.md) — AI search as
an additive layer; ADR-0003 (ranking computed in TypeScript) stays unchanged.
Plan: [`plans/v2-ai-search.md`](../../plans/v2-ai-search.md) — the reconciled
plan this PRD is drawn from.

This PRD adds **AI search** to the **Tonight** screen of the shipped v1 app. It
does not change the deterministic ranking, the Log, or the Catalog.

---

## Problem Statement

The deterministic Tonight ranking is good at recency and variety, but it cannot
interpret intent. A member of the Household often wants dinner chosen against a
soft, situational need — "something light", "we have guests", "a quick
weeknight thing" — and Tonight has no way to hear that. All the screen offers is
a fixed Score-ranked list, an All/Home/Restaurant segment, and tri-state Tag
filters. If the intent isn't already a Tag, there is no path to it: the
Household must eyeball the whole list and translate the mood into a filter
themselves. The app ranks Options well; it just can't be *asked a question*.

## Solution

A search box on **Tonight**. A member of the Household types an intent — or
leaves the box empty — and submits; an AI model re-ranks the active **Catalog**
to fit that intent and returns a ranked set of **Options**, each result row
carrying a one-line **AI rationale** explaining why it fits.

AI search is **additive and never the default**. The deterministic ranking is
still what loads on its own and is the fail-safe floor. Running a search is
always a deliberate act. The AI result swaps in place of the deterministic list
on the same screen and is **ephemeral** — a clear control, or any page reload,
restores the deterministic ranking, and nothing is persisted. AI result rows
are **pickable** exactly like deterministic rows (`pick = log` is unchanged). If
the model call fails, the deterministic list is left untouched and an inline
error appears. Where `ANTHROPIC_API_KEY` is not configured the search box is
absent entirely — Tonight is exactly v1.

## User Stories

### Running a search

1. As a member of the Household, I want a search box on Tonight, so that I can
   ask for dinner by intent ("something light") instead of only scanning the
   recency-ranked list.
2. As a member of the Household, I want to submit a query with Enter or an
   explicit button, so that running a search is a deliberate act.
3. As a member of the Household, I want to run a search with the box left
   empty, so that I can get an AI re-rank on learned patterns without having to
   phrase a query.
4. As a member of the Household, I want the search to run only when I trigger
   it, so that the deterministic ranking still loads by default and the AI
   never runs on its own.
5. As a member of the Household, I want a pending indicator while a search
   runs, so that I know the model is working.
6. As a member of the Household, I want the deterministic list to stay visible
   underneath while a search is in flight, so that I am never left looking at a
   blank screen.
7. As a member of the Household, I want the search box disabled while a search
   is running, so that I cannot fire a second search that races the first.

### The AI result

8. As a member of the Household, I want the AI result to replace the Tonight
   list in place, so that I read the answer on the same screen I asked on.
9. As a member of the Household, I want the AI to return a ranked set sized to
   my query, so that a narrowing query ("light") gives me a focused shortlist
   rather than the whole Catalog re-sorted — and an open or empty query
   ("recommend something", or no text at all) gives me the whole Catalog
   ranked instead, each row's rationale reading as a positive reason near the
   top and as a "why this is a weaker pick tonight" note near the bottom.

   > **Post-facto amendment — 2026-05-17.** Everything from "— and an open or
   > empty query" onward was added *after* the feature shipped. The original
   > story covered only the narrowing-query case; use showed an open query
   > reads better as the full ranked Catalog (with negative reasons low down)
   > than as a short list. This records the behavior `lib/ai-search.ts` now
   > implements; it was not part of the as-built v2 spec.
10. As a member of the Household, I want AI result rows to be pickable exactly
    like deterministic rows, so that I can Pick straight from a search result.
11. As a member of the Household, I want the AI result to be ephemeral, so that
    clearing the search — or reloading the page — restores the deterministic
    ranking with nothing persisted.
12. As a member of the Household, I want a clear control on the search, so that
    I can dismiss the AI result and return to the deterministic list in one
    action.
13. As a member of the Household, I want a search that fits nothing to show a
    plain empty-state message, so that "no Options fit" reads as a real answer
    rather than a broken screen.
14. As a member of the Household, I want the empty-state to offer a
    clear/retry control, so that I can return to the deterministic list or try
    another query.

### The AI rationale

15. As a member of the Household, I want each AI result row to carry a one-line
    AI rationale, so that I understand why the model thinks that Option fits my
    query.
16. As a member of the Household, I want the AI rationale kept short (about 80
    characters, plain text), so that it reads at a glance and never sprawls.
17. As a member of the Household, I want the AI rationale to take the place of
    the Explanation chip on AI result rows, so that one row never shows two
    competing "why" lines.
18. As a member of the Household, I want the deterministic Explanation chip
    back on every row when I clear the search, so that the default list keeps
    its recency rationale.

### Failure and fallback

19. As a member of the Household, I want a failed search (timeout, rate limit,
    API down) to leave the deterministic list exactly as it was, so that a
    failure costs me nothing.
20. As a member of the Household, I want an inline error on the search box when
    a search fails, so that I know it failed rather than wondering why nothing
    changed.
21. As a member of the Household, I want a transient failure retried once
    automatically, so that a momentary blip does not make me retype and
    resubmit.
22. As a member of the Household, I want to retry or just use the deterministic
    ranking after a failure, so that the AI being down never blocks me from
    deciding dinner.
23. As a member of the Household, I want the model never to return an Option
    that is not in my Catalog, so that every search result is something I can
    actually Pick.

### Configuration

24. As the Household's administrator, I want AI search to appear only when
    `ANTHROPIC_API_KEY` is configured, so that an unconfigured deployment
    simply shows v1 Tonight with no broken feature.
25. As the Household's administrator, I want the AI model chosen by an env var
    (`AI_MODEL`), so that I can move to a newer model without a code change.
26. As the Household's administrator, I want the app build to succeed with no
    AI env vars set, so that deploying is unaffected by whether AI search is
    configured.
27. As the Household's administrator, I want one log line per model call
    (latency, outcome, result count), so that I can see how the external call
    is performing.

### Interplay with the picker

28. As a member of the Household, I want the All/Home/Restaurant segment and
    the Tag filter chips hidden while an AI result is shown, so that the query
    is the single ranking authority and I am not fighting two filters at once.
29. As a member of the Household, I want the kind segment and Tag filters back
    when I clear the search, so that the deterministic list keeps its
    filtering.
30. As a member of the Household, I want the search box hidden when my Catalog
    is empty, so that there is nothing to search before I have added Options.

### Accessibility and cross-cutting

31. As a member of the Household using assistive tech, I want the swap between
    the deterministic list and the AI result announced, so that the change of
    list is perceivable without sight.
32. As a member of the Household using assistive tech, I want the pending and
    error states announced, so that I know a search's status without seeing it.
33. As a member of the Household using a keyboard, I want the search box, the
    submit control, and the clear control reachable with visible focus, so that
    AI search is fully operable without a mouse.
34. As a member of the Household, I want the search controls usable on both
    phone and desktop with adequate touch targets, so that I can search
    comfortably in the kitchen.

## Implementation Decisions

### AI search is additive, never the default

- ADR-0004 holds: AI search is an additive layer. `lib/ranking.ts` and
  `rankTonight` are **not touched** — ADR-0003 stands. The deterministic
  ranking is the default Tonight view and the fail-safe the feature falls back
  to. The Tonight page stays `force-dynamic`.
- A search runs only on a deliberate submit (Enter or button). An **empty
  query is a valid trigger**. Because the call is submit-driven, no debounce is
  needed.

### New deep module — `lib/ai-search`

A single new module, modeled on `lib/places.ts` (the existing external-API deep
module): a small interface, with every failure mode collapsing to one typed
"unavailable" outcome and a per-request timeout via `AbortController`. It has
pure parts and one impure call.

- **Snapshot builder (pure).** Given the active Catalog (each Option's `id`,
  `name`, `kind`, `tags`, `notes`), the full non-future Log (`optionId`,
  `eatenOn`, `note`), today's Household calendar day, and the query, it produces
  the model-input JSON. Decisions baked in:
  - Options are sent in **alphabetical order by name**, not in Score-rank order
    — a pre-ranked candidate list would anchor the model toward the existing
    order.
  - Per-Option and per-Tag **recency integers** are included, so a rationale
    citing "three weeks" quotes a number the app supplied. They are derived by
    reusing the **exported pure helpers** from `lib/ranking.ts` (`lastEaten`,
    `lastTagUse`, `daysSince`) — `rankTonight` is not re-run or modified.
  - The Restaurant **Places fields are excluded** (`address`, `phone`, `lat`,
    `lng`, `googlePlaceId`, `mapsUrl`) — opaque to the model and not useful for
    ranking.
  - All Household-authored free text (Option names, Tags, Option notes, Log
    notes, and the query) is wrapped in **XML-style delimiters** so catalog
    text cannot be read as model instructions.
- **`parseAndValidate` (pure).** Given the model's tool-use response and the
  set of active Option IDs, it returns a validated, ordered array of
  `{ id, reason }`: any `id` not in the active Catalog is dropped (hallucinated);
  duplicates are deduped, first occurrence kept; any `reason` longer than ~80
  characters is truncated. `reason` is plain text — no markdown.
- **The Anthropic call (impure).** Uses Anthropic **tool-use with a strict
  schema**: a single tool whose input is an **ordered array** of
  `{ id, reason }` — the array order is the result ranking and `reason` is the
  AI rationale. The call carries a ~10-second timeout (`AbortController`). On a
  **transient** error (timeout, HTTP 429, 5xx, network) the call is retried
  **once**; a non-transient failure (malformed or unparseable output, which a
  retry would not fix) is not retried. Every failure collapses to one typed
  fallback outcome.
- **`aiSearchEnabled()`** — returns whether `ANTHROPIC_API_KEY` is set,
  mirroring `placesEnabled()`. It gates the search box.
- The Anthropic client is constructed **lazily**, never at import time, so the
  build stays env-free (review fix F2).

### Model and configuration

- Anthropic API, a Claude **Sonnet** model. Two new env vars:
  `ANTHROPIC_API_KEY` (absent → search box hidden) and `AI_MODEL` (optional;
  the model id, default a current Sonnet model). Both are added to
  `.env.example`.
- `lib/check-env.ts` is **unchanged**: `ANTHROPIC_API_KEY` is optional (absent
  → feature hidden), so it does not belong in the hard-required boot set.

### Server action — `aiSearchAction`

- A new server action, `aiSearchAction(query)`, **`authedAction`-wrapped**
  (review fix F1 — auth by default; only an authenticated session may invoke
  it). It builds the snapshot, calls
  `lib/ai-search`, and returns either the validated ordered result (with
  rationales) or a typed fallback signal. It is thin — the logic lives in
  `lib/ai-search`.

### Data — `getTonightData` extended

- `getTonightData` is extended to additionally return each Option's `notes` and
  each Log entry's `note`, so the snapshot builder has the text the model
  needs. The ranking input is otherwise unchanged — `rankTonight` still
  receives exactly what it does today.

### Tonight as a two-state screen

- `app/tonight-screen.tsx` gains a search box above the list and a swap between
  two states: the **deterministic list** (v1, the default) and the **AI
  result** (the validated rows with AI rationales). A search swaps the
  deterministic list for the AI result in place; a clear control — and any page
  reload — restores the deterministic list. The AI result is never persisted.
- While an AI result is shown, the existing filter zone (All/Home/Restaurant
  kind segment, tri-state Tag chips) is **hidden** — the query is the single
  ranking authority. Clearing the search restores both the deterministic list
  and its filter controls.
- The list stays a flat, uniform scan in both states (honors the v1 flat-list
  decision).
- AI result rows are pickable via the unchanged `pick = log` path;
  `app/tonight-row.tsx` renders the AI rationale in place of the Explanation
  chip when a row is part of an AI result.
- **In flight:** the search box shows a pending state and is **disabled**, and
  the deterministic list stays visible underneath until the result arrives,
  then swaps. Disabling the box means only one search runs at a time, so a slow
  response can never overwrite a newer query — no separate race guard is
  needed.
- An **empty AI result** renders a plain empty-state message with a clear/retry
  control, mirroring the existing "No Options match the current filter" state.
- On **failure**, an inline error shows on the search box and the deterministic
  list is left exactly as-is.
- `app/page.tsx` passes a "search enabled" flag (whether `ANTHROPIC_API_KEY` is
  set) to the screen; the search box is hidden when that flag is false or the
  Catalog is empty.

### Observability

- One structured log line per model call: query length, model id, latency,
  outcome (`ok` or `fallback:<class>`), and the count of Options returned.

## Testing Decisions

A good test exercises a module's **external behavior** through its public
interface — given these inputs, expect this output — and does not assert on
internal structure, so it survives refactors. Framework: **Vitest**, as used
across the existing suites. The live Anthropic call is never made in tests — the
client is mocked.

**Tested module 1 — `lib/ai-search` (pure parts).**

- Snapshot builder:
  - Options come out in alphabetical order by name, not rank order.
  - Places fields are absent; Option `notes` and Log `note` are present.
  - per-Option and per-Tag recency integers are present and correct.
  - Household-authored text is wrapped in the delimiters; the query is
    included.
- `parseAndValidate`:
  - an `id` not in the active Catalog is dropped (hallucination).
  - duplicate IDs are deduped, first occurrence kept.
  - a `reason` over ~80 characters is truncated; a short one is left alone.
  - the result preserves the model's ordering.
- Failure-to-fallback mapping:
  - each failure class (timeout, HTTP 429, 5xx, network, malformed output)
    collapses to the typed fallback outcome.
  - a transient error triggers exactly **one** retry; a malformed-output
    failure triggers **none**.

**Tested module 2 — `app/tonight-screen.tsx` (a screen-level test).** This is a
new kind of test for this codebase, which to date has only pure-logic and
server-action suites; it uses React Testing Library with `aiSearchAction`
mocked. Adding React Testing Library is part of the work.

- submitting a query swaps the deterministic list for the AI result; clearing
  restores the deterministic list **and** the filter zone.
- the search box is disabled while a search is in flight.
- a failed search leaves the deterministic list intact and shows the inline
  error.
- the search box is hidden when search is not enabled (no key) or the Catalog
  is empty.

Prior art: `lib/places.test.ts` and `lib/ranking.test.ts` are the model for the
`lib/ai-search` tests — Vitest, pure functions exercised with hand-built
fixtures, the external client mocked exactly as `places.test.ts` mocks the
Places client. The screen-level test has no in-repo precedent; it follows
standard React Testing Library practice — render the component, drive it
through user interactions, assert on what the user would see.

The server action `aiSearchAction` needs no test of its own — it is a thin
`authedAction` wrapper over `lib/ai-search`, and both sides are covered. One
hand-verified live smoke check confirms a real model call end to end,
consistent with v1's "no browser E2E" testing posture.

## Out of Scope

- Caching, seed-pinning, or dedup of repeat queries — a search is a deliberate
  one-off act; run-to-run variance is acceptable by design (ADR-0004).
- Streaming the AI rationale — the full structured result renders at once.
- Persisting AI results or search history.
- Any change to the deterministic ranking, its Score, or the Explanation chip
  logic — `lib/ranking.ts` and ADR-0003 are untouched.
- Suggested-query chips, conversational/multi-turn search, preference learning,
  voice input, and a query-history UI.
- A provider abstraction — the Anthropic SDK is used directly; no interface to
  swap model vendors.
- Rate limiting on searches.
- AI rationales on the **zero-query default** list — the default deterministic
  list keeps its Explanation chip. An empty *submitted* query still runs a
  search and gets rationales; that is a triggered search, not the default
  state.
- Google Places Details enrichment of Restaurants for the prompt.
- Numeric post-validation of an AI rationale against the real Log — the model
  is given the recency facts and may cite them; tightening factual accuracy is
  a possible post-launch follow-up, not this PRD.

## Further Notes

- `docs/adr/0004-ai-search.md` already records AI search as an additive layer;
  this PRD implements it. No new ADR is written.
- `CONTEXT.md` already carries the **AI search** and **AI rationale** terms
  (added in the v2 grill session); no glossary change is needed.
- This PRD is drawn from `plans/v2-ai-search.md`, the reconciled plan (the
  `/grill-with-docs` base plus four `/plan-ceo-review` refinements:
  env-configurable model, tool-use with a strict schema, the ~80-char rationale
  cap, prompt-injection delimiters, one transient-error retry, alphabetical
  candidate input, and the observability log line). `plans/v2-ai-grill.md` and
  `plans/v2-ai-ceo.md` remain on disk as source material. That plan is
  `Status: pending /plan-eng-review`, so the architecture here may still be
  refined by an engineering review before implementation.
- **Coordination with the parallel Tonight decided-mode PRD**
  (`.issues/tonight-decided-mode/PRD.md`): both PRDs extend `getTonightData`
  (decided-mode adds `url`, `phone`, and Log-entry `id`/`created_at`; this PRD
  adds Option `notes` and Log `note`) and both touch `app/tonight-screen.tsx`,
  `app/tonight-row.tsx`, and `app/page.tsx`. Whichever lands second must
  **merge** rather than overwrite. The decided-mode PRD states that AI search
  "belongs inside the collapsible picker" — when both have shipped, the search
  box renders within decided mode's picker, collapsing with the rest of it.
