# v2 — AI search

Feature plan for **AI search**, produced by a `/grill-with-docs` session on
2026-05-16. v1 is implemented and merged to `main`; its canonical plan now
lives at `plans/old/v1-plan.md` (moved, not edited — historical record). This
document is the source of truth for the AI-search feature only; it does not
restate v1.

Domain terms: see `CONTEXT.md` (**AI search**, **AI rationale** added this
session). Architecture decision: see `docs/adr/0004-ai-search.md`.

## 1. What it is

A triggered, query-driven re-ranking of the Tonight screen by an AI model. The
Household types an intent into a query box — "something light", "we have
guests", "quick weeknight thing" — or leaves it empty, and the model returns a
ranked set of Options to fit it, each with a one-line **AI rationale**.

AI search is **additive**. The deterministic ranking (`lib/ranking.ts`,
ADR-0003) remains exactly what it is and remains the default Tonight view. AI
search never loads on its own; running it is always a deliberate action.

## 2. Resolved decisions

1. **Search, not a no-query re-rank.** There is a query box. The model returns
   a ranked *set* and decides its own cardinality — a narrowing query ("light")
   yields a subset of the Catalog, not the whole list re-sorted. An **empty
   query is valid** (re-rank on learned patterns rather than discrete rules)
   but is still a triggered action, not the page default.

2. **In-place, ephemeral.** Running a search swaps the deterministic list out
   for the AI result *on the same Tonight screen*. A clear control — and any
   page reload — restores the deterministic list. The AI result is never
   persisted. AI-result rows are **pickable** like any other Tonight row
   (`pick = log` works unchanged).

3. **AI rationale per row.** Each result row carries a model-generated line of
   prose explaining why that Option fits the query. It is distinct from the
   deterministic **Explanation chip** (which stays on the deterministic list).
   The ranked list and every rationale come from **one model call**.

4. **Model input — one JSON snapshot.** The whole dataset is a few KB, so the
   call sends all of it:
   - today's date (Household calendar day, `APP_TZ`);
   - every **active** Option: `id`, `name`, `kind`, `tags`, `notes`
     (`options.notes`);
   - the full **non-future** Log: `optionId`, `eatenOn`, `note`
     (`dinner_log.note`);
   - pre-computed per-Option and per-Tag recency (the numbers `lib/ranking.ts`
     already derives) — so a rationale citing "three weeks" quotes a number we
     supplied rather than doing date math.
   - **Excluded:** the Restaurant Places fields (`address`, `phone`, `lat`,
     `lng`, `googlePlaceId`, `mapsUrl`). A `googlePlaceId` is an opaque token
     the model cannot decode into cuisine/menu insight; name + tags + notes
     already encode cuisine.

5. **Failure model — fail safe to deterministic.**
   - *Latency:* the query box shows a pending state while the call is in
     flight; the deterministic list stays visible underneath until results
     arrive, then swaps.
   - *Failure* (timeout, rate limit, malformed output, API down): an inline
     error on the search box ("Search unavailable — try again"); the
     deterministic list is left exactly as-is. Nothing is lost; the user can
     retry or just use the deterministic ranking.
   - *No `ANTHROPIC_API_KEY`:* the search box is **hidden entirely** — the same
     way Places autofill degrades to manual entry when `GOOGLE_PLACES_API_KEY`
     is unset.

6. **Model.** Anthropic API, **Claude Sonnet** (`claude-sonnet-4-6`). New env
   var `ANTHROPIC_API_KEY`. At this app's volume (a handful of searches a day)
   cost is negligible, so the size choice optimizes for judgment quality on
   fuzzy queries and rationale prose, not price.

7. **AI search is its own mode.** While AI results are shown, the existing
   Tonight filter zone (All/Home/Restaurant kind segment, tri-state tag chips)
   is **hidden** — the query absorbs filtering. Clearing the search restores
   both the deterministic list and its filter controls. One ranking authority
   on the list at a time.

8. **Empty results and consistency.** The model may return **zero** Options
   (e.g. "something light" when nothing qualifies) — that renders a plain
   empty-state message with a clear/retry control, mirroring the existing "No
   Options match the current filter" state. AI search is non-deterministic and
   **uncached** by design: a search is a deliberate one-off act, so run-to-run
   variance is acceptable and a query cache would be unwarranted machinery.

## 3. Folded-in assumptions

Decided without a separate question; revisit if any feels wrong:

- The query box submits on Enter or via an explicit button; the button is also
  how an **empty query** is triggered.
- Model-returned option IDs are **validated against the real active Options**;
  unknown or duplicate IDs are dropped (the model does not get to invent rows).
- **No rationale streaming** — the full structured result renders at once.

## 4. Testing

ADR-0003's deterministic ranking is untouched and keeps its table tests. For AI
search, the model call is mocked; the deterministic, pure parts are
unit-tested directly: snapshot assembly from Catalog + Log, output validation
(ID validation, dedup, drop-unknown), and the fail-safe path (failure leaves
the deterministic list intact).

## 5. Out of scope

- Persisting AI results or search history.
- Caching, seed-pinning, or dedup of repeat queries.
- Streaming rationales.
- Google Places Details enrichment of restaurants for the model prompt.
- Any change to the deterministic ranking, its Score, or its Explanation chip.

## 6. Documentation status

- `CONTEXT.md` — **done.** Added **AI search** and **AI rationale**; the
  **Explanation chip** entry now disclaims the AI rationale.
- `docs/adr/0004-ai-search.md` — **done.**
- `plans/old/v1-plan.md`'s non-goals list still reads "no AI." It was moved to
  `old/` unedited as a historical record; this document supersedes that
  non-goal. No edit to the archived file.
