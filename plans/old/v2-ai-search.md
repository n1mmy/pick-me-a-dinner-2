# v2 — AI search (reconciled plan)

Reconciled feature plan for **AI search**. The base is `plans/v2-ai-grill.md`
(the `/grill-with-docs` plan); all of its decisions stand except where noted.
Seven elements are taken from `plans/v2-ai-ceo.md` (the `/plan-ceo-review`
plan): the **env-configurable model**, **Anthropic tool-use with a strict
schema**, the **~80-character cap on the AI rationale**, **prompt-injection
delimiters** on Household text, **one retry on a transient error**,
**unordered (alphabetical) candidate input**, and a **per-call observability
log line**.

The CEO plan's structural departures from grill were **not** adopted: its
divider/partition layout (grill keeps the in-place swap into an AI mode), its
empty-query-renders-the-deterministic-list behavior (grill keeps the empty
query as a valid triggered search), and its keep-the-filter-zone-visible
behavior (grill hides it). The CEO plan's explicit out-of-flight race guard is
also not adopted — instead the query box is **disabled while a call is in
flight** (decision 5), which removes the race entirely. `plans/v2-ai-grill.md`
and `plans/v2-ai-ceo.md` remain on disk as the source material; **this
document is the source of truth for the AI-search feature** from here.

v1 is implemented and merged to `main`; its canonical plan now lives at
`plans/old/v1-plan.md` (moved, not edited — historical record). This document
does not restate v1.

Status: reconciled draft — pending `/plan-eng-review`.
Branch: ralph-2

Domain terms: see `CONTEXT.md` (**AI search**, **AI rationale**). Architecture
decision: see `docs/adr/0004-ai-search.md`.

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
   The ranked list and every rationale come from **one model call**. Each
   rationale is **plain text (no markdown), capped at ~80 characters**; the
   validation step (§3) truncates anything longer. *(Cap taken from the CEO
   plan.)*

4. **Model input and output.**

   **Input — one JSON snapshot.** The whole dataset is a few KB, so the call
   sends all of it:
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

   The active Options are sent in **alphabetical order by name**, not in
   deterministic rank order — a pre-ranked candidate list would anchor the
   model toward the existing order. All Household-authored free text (Option
   names, tags, notes, Log notes, and the query itself) is wrapped in
   XML-style delimiters in the prompt so catalog text cannot be read as model
   instructions. *(Alphabetical input and delimiters both taken from the CEO
   plan.)*

   **Output — Anthropic tool-use with a strict schema.** The call uses
   Anthropic **tool-use**: a single tool whose input is an **ordered array** of
   `{ id, reason }`. The array order *is* the AI result ranking; `reason` is
   the AI rationale for that row. The model returns only Options it is
   genuinely confident fit the query, so the array may be a subset of the
   Catalog — or empty (decision 8). *(Tool-use + strict schema taken from the
   CEO plan; it replaces grill's unspecified "one model call" output shape.)*

5. **Failure model — fail safe to deterministic.**
   - *Latency:* while the call is in flight the query box shows a pending
     state and is **disabled** — only one search runs at a time, so a slow
     response can never overwrite a newer one. This is grill's simpler
     alternative to the CEO plan's explicit out-of-flight race guard. The
     deterministic list stays visible underneath until results arrive, then
     swaps.
   - *Transient failure* (timeout, HTTP 429, 5xx, network): the call is
     **retried once**. *(Retry taken from the CEO plan.)*
   - *Failure* (the retry also fails, or a non-transient error — malformed or
     unparseable output, which a retry would not fix): an inline error on the
     search box ("Search unavailable — try again"); the deterministic list is
     left exactly as-is. Nothing is lost; the user can retry or just use the
     deterministic ranking.
   - *No `ANTHROPIC_API_KEY`:* the search box is **hidden entirely** — the same
     way Places autofill degrades to manual entry when `GOOGLE_PLACES_API_KEY`
     is unset.

6. **Model — env-configurable.** Anthropic API, a Claude **Sonnet** model. Two
   new env vars: `ANTHROPIC_API_KEY` (required for the feature; absent → search
   box hidden, decision 5) and `AI_MODEL` (optional; the model id, default a
   current Sonnet model). Making the model an env var keeps a model upgrade a
   config change rather than a code change. At this app's volume (a handful of
   searches a day) cost is negligible, so the size choice optimizes for
   judgment quality on fuzzy queries and rationale prose, not price. *(The
   `AI_MODEL` env var is taken from the CEO plan; grill hardcoded the model.)*

7. **AI search is its own mode.** While AI results are shown, the existing
   Tonight filter zone (All/Home/Restaurant kind segment, tri-state tag chips)
   is **hidden** — the query absorbs filtering. Clearing the search restores
   both the deterministic list and its filter controls. One ranking authority
   on the list at a time.

8. **Empty results and consistency.** The model may return **zero** Options
   (an empty tool-use array — e.g. "something light" when nothing qualifies) —
   that renders a plain empty-state message with a clear/retry control,
   mirroring the existing "No Options match the current filter" state. AI
   search is non-deterministic and **uncached** by design: a search is a
   deliberate one-off act, so run-to-run variance is acceptable and a query
   cache would be unwarranted machinery.

9. **Observability.** Each model call emits one structured log line — query
   length, model id, latency, outcome (`ok` or `fallback:<class>`), and the
   count of Options returned. It is the only window into a paid external
   call's latency and failure rate. *(Taken from the CEO plan.)*

## 3. Folded-in assumptions

Decided without a separate question; revisit if any feels wrong:

- The query box submits on Enter or via an explicit button; the button is also
  how an **empty query** is triggered.
- Model-returned option IDs are **validated against the real active Options**;
  unknown or duplicate IDs are dropped (the model does not get to invent rows).
  Validation also **truncates** any `reason` longer than the ~80-char cap.
- **No rationale streaming** — the full structured result renders at once.

## 4. Testing

ADR-0003's deterministic ranking is untouched and keeps its table tests. For AI
search, the model call is mocked; the deterministic, pure parts are
unit-tested directly:
- snapshot assembly from Catalog + Log — correct fields, Places fields absent,
  Options in alphabetical order, Household text wrapped in delimiters;
- tool-use response parsing — well-formed and malformed tool input;
- output validation — ID validation, dedup, drop-unknown, rationale truncation
  to the ~80-char cap;
- the fail-safe path — each failure class in decision 5 leaves the
  deterministic list intact, and a transient error is retried once before
  fallback.

One hand-verified live smoke check (consistent with v1 plan §15: no browser
E2E in v1).

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
- `plans/v2-ai-grill.md` and `plans/v2-ai-ceo.md` are the source material this
  document reconciles; they are kept on disk but are no longer the source of
  truth for the feature.
