# 01 — AI search: end-to-end skeleton

Status: ready-for-agent
Type: AFK

## Parent

[PRD: AI search on Tonight](../PRD.md)

## What to build

The first complete path through **AI search**, end to end: a member of the
Household types an intent into a search box on **Tonight**, submits, and the
screen swaps the deterministic ranked list for an AI-ranked result, each row
carrying an **AI rationale**.

Build the **`lib/ai-search` deep module**, modeled on the existing Places
client — a small interface, with the Anthropic client constructed **lazily**
(never at import time, so the build stays env-free). It has a pure **snapshot
builder** that turns the active Catalog (each Option's name, kind, Tags, and
notes), the full non-future Log (with each entry's note), per-Option and
per-Tag **recency** integers, today's Household calendar day, and the query
into the model-input JSON — Options in **alphabetical order by name**, the
Restaurant Places fields excluded, all Household-authored text wrapped in
XML-style delimiters. The recency integers are derived by reusing the exported
pure helpers of the ranking module; `rankTonight` is not re-run or modified.
The module calls the Anthropic API with **tool-use and a strict schema** — a
single tool whose input is an ordered array of `{ id, reason }`, the order
being the result ranking. A pure `parseAndValidate` step drops any returned
`id` not in the active Catalog (a hallucination) and returns the ordered
result.

Extend **`getTonightData`** to additionally return each Option's notes and each
Log entry's note — the snapshot builder needs them. The ranking input is
otherwise unchanged.

Add the **`aiSearchAction` server action**, `authedAction`-wrapped, which
builds the snapshot, calls `lib/ai-search`, and returns the validated ordered
result.

On **Tonight**, add a search box above the list. Submitting a query — by Enter
or a button, an empty query allowed — runs the action and swaps the
deterministic list in place for the AI result. AI result rows render the AI
rationale in place of the Explanation chip and are pickable exactly like
deterministic rows (`pick = log` is unchanged). A clear control, and any page
reload, restores the deterministic list. The deterministic ranking stays the
default that loads on its own.

Rough edges are acceptable here and are addressed by the issues blocked on this
one: minimal error handling (a basic inline message is enough), no retry, and
the filter zone need not yet hide in AI mode.

## Acceptance criteria

- [ ] A search box on Tonight; submitting a query (Enter or button, empty
      allowed) swaps the deterministic list for an AI-ranked result in place
- [ ] `lib/ai-search` builds the model snapshot — active Catalog with notes,
      non-future Log with notes, recency integers, alphabetical order, Places
      fields excluded, Household text delimited
- [ ] The Anthropic call uses tool-use with a strict ordered `{ id, reason }`
      schema; the client is constructed lazily so the build needs no env vars
- [ ] `parseAndValidate` drops any `id` not in the active Catalog
- [ ] AI result rows show the AI rationale instead of the Explanation chip and
      are pickable; clearing the search or reloading restores the
      deterministic list with the Explanation chip
- [ ] `getTonightData` returns Option notes and Log-entry notes; the ranking
      input is unchanged and `rankTonight` still passes its tests
- [ ] `aiSearchAction` is `authedAction`-wrapped and rejects an unauthenticated
      caller
- [ ] Unit tests cover the snapshot builder (ordering, field selection,
      delimiters, recency) and `parseAndValidate` (hallucinated `id` dropped);
      a screen-level test covers submit-swaps / clear-restores (introduces
      React Testing Library)
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green, and
      `pnpm build` passes with no env vars set

## Blocked by

- None — can start immediately
