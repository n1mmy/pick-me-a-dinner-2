# v2 — AI search on Tonight (CEO-review plan)

Status: reviewed via `/plan-ceo-review` (2026-05-16), ready for `/plan-eng-review`
Branch: ralph-2

Adds an AI search box to the Tonight screen. An empty query keeps v1's
deterministic recency list untouched. A typed query has an LLM rank the active
Catalog against that intent, with a one-line reason on each strong match.

This reverses v1's §10 non-goal "No AI / LLM suggestion" (the v1 plan is the
archived historical record at [plans/old/v1-plan.md](old/v1-plan.md); the
non-goal there is superseded, the archive is not edited). The architecture
decision is recorded in `docs/adr/0004-ai-search.md` — see §10.

## 1. Scope

**In scope** — a query-driven AI re-rank, additive over the deterministic engine:
- A free-text search box on Tonight.
- A query-driven LLM re-rank of the active Catalog via an `authedAction`-wrapped
  server action.
- The deterministic engine ([lib/ranking.ts](../lib/ranking.ts)) is untouched —
  it stays the zero-query default, the candidate source, and the failure fallback.

**Not in scope** (declined during review):
- Suggested query chips (E1 — skipped).
- Streaming the AI response (E2 — skipped).
- Result caching (T3 — skipped; no speculative machinery for load that won't exist).
- AI reasons on the zero-query default list; conversational/multi-turn;
  preference learning; voice input; query history; a provider-abstraction
  interface; rate limiting.

## 2. Decision record

| ID | Decision |
|----|----------|
| D1 | Approach B — AI search box (not a silent always-on re-rank, not an engine replacement). |
| D2 | Mode SELECTIVE EXPANSION; 0 expansions accepted (E1 chips, E2 streaming both skipped). |
| D3 | Anthropic SDK (`@anthropic-ai/sdk`); model env-configurable (`AI_MODEL`), default a Sonnet model. |
| D4 | The LLM is given recency facts and may cite history freely. Reason factual quality is assessed post-launch — see §11. |
| D5 | `ANTHROPIC_API_KEY` unset → the search box is hidden; Tonight renders exactly as v1. |
| D6 | The AI reason replaces the deterministic Explanation chip — but only on strong-match rows above the divider (see T2). |
| T1 | Sending catalog + recency facts to Anthropic is accepted; documented in ADR-0004's data-boundary section. |
| T2 | AI search **reorders, never hides**. Strong matches sit above a hairline divider with AI reason chips; every other active Option sits below it in deterministic order, keeping its deterministic recency chip. |
| T3 | No caching. |

## 3. Architecture

```
        TONIGHT PAGE  (app/page.tsx, force-dynamic)
                        │
        getTonightData() → rankTonight()        ← lib/ranking.ts, UNCHANGED
                        │  deterministic rows + recency facts
                        ▼
              TonightScreen (zero query → render as v1 today)
                        │  user types a query + submits
                        ▼
              aiRankAction(query)   ← server action, authedAction-wrapped
                        │
                        ▼
              lib/ai-rank.ts
                ├─ buildPrompt(query, candidates)   candidates UNORDERED
                ├─ Anthropic call (tool-use, strict schema, ~10s timeout)
                └─ parseAndValidate(response, catalog)
                        │
        ┌───────────────┴────────────────────┐
        ▼ ok                                  ▼ fail / timeout / invalid
  strong matches (ordered, with reasons)   deterministic list +
  + divider + remaining Options below      inline "AI search
  in deterministic order w/ recency chips  unavailable" notice
```

`lib/ai-rank.ts` depends only on the *output types* of `rankTonight`, not its
internals. `lib/ranking.ts` stays a pure module and ADR-0003 stands unchanged.
Rollback is a `git revert` or unsetting the key — reversibility 5/5.

## 4. The AI rank module (`lib/ai-rank.ts`)

**Input to the LLM.** The active Catalog as an **unordered** set (alphabetical,
not recency-ranked — a ranked candidate list would anchor the model toward the
existing order). Each Option carries: `id`, `name`, `kind`, `tags`,
`notes` (`options.notes`), and recency integers (days since the Option was last
eaten; per-Tag recency). Plus `today` (Household calendar day) and the user's
query. Household-authored text (names, tags, notes, query) is wrapped in
XML-style delimiters so catalog text cannot read as instructions. The
Restaurant Places fields (`address`, `phone`, `lat`, `lng`, `googlePlaceId`,
`mapsUrl`) are excluded — opaque to the model and not useful for ranking.

**Output from the LLM.** Anthropic **tool-use** with a strict schema — a single
tool whose input is an ordered array of `{ id: string, reason: string }` for the
**strong matches only**. `reason` is plain text, no markdown, capped at ~80
characters. The model is told to return only Options it is genuinely confident
fit the query; a query that matches little or nothing yields a short or empty
array.

**Parse and validate** (`parseAndValidate`):
1. Drop any `id` not in the active Catalog (hallucinated).
2. Dedupe — keep first occurrence.
3. Truncate any `reason` over the cap.
4. The result splits Tonight into: **above divider** = the validated ordered
   strong matches (with AI reasons); **below divider** = every remaining active
   Option in deterministic `rankTonight` order, each keeping its deterministic
   Explanation chip. Invariant: above + below = exactly the active Catalog.

## 5. Error & rescue

| Failure | Handling |
|---------|----------|
| Timeout (~10s) | Fall back to the deterministic list + notice. |
| API 429 / 5xx / network | One retry on the transient error, then fallback. |
| Malformed tool input / unparseable | Fallback, no retry (a retry won't fix bad output). |
| `ANTHROPIC_API_KEY` missing/invalid | Search box hidden (D5); if invalid at call time, fallback + log. |
| Hallucinated / dropped / duplicate IDs | Handled in `parseAndValidate` (§4) — never an error. |

No catch-all `catch` — each class above is named and handled. The fallback
notice is **inline** (under the search box), **persistent** while the fallback
list is shown, and clears when the query is cleared or a new query succeeds.

## 6. UI & interaction states

```
ZERO QUERY ─────────▶ v1 deterministic list, no divider (unchanged)
   │ type + submit
   ▼
LOADING ── skeleton/spinner on the list; search box stays interactive
   │
   ├─▶ OK ───▶ [strong matches: AI reason chips] ──divider── [rest: recency chips]
   └─▶ FAIL ─▶ deterministic list + inline "Showing the usual ranking —
                AI search is unavailable" notice
   │ clear box
   ▼
ZERO QUERY
```

- **Submit-driven, not keystroke-driven** — the LLM call fires on explicit
  submit (Enter or button), so no debounce is needed.
- **Race guard:** each submit records the query it was issued for; a resolving
  response is discarded if the current query no longer matches it.
  (`useTransition` alone does not order out-of-flight responses.)
- The list stays a flat uniform scan (honors the v1 `tonight-flat-list-
  intentional` decision — the human scans every Option); the divider is a
  hairline separator, not a section card.
- The existing filter zone (kind segment, tag chips) stays visible and still
  applies — it AND-composes with the AI ordering.
- Search box hidden entirely when `rows.length === 0` or no API key.

## 7. Files

| File | Change |
|------|--------|
| `package.json` | Add `@anthropic-ai/sdk`. |
| `lib/ai-rank.ts` | New — lazy client, prompt builder, call, `parseAndValidate`. |
| `app/tonight-actions.ts` | New `aiRankAction`, `authedAction`-wrapped. |
| `app/page.tsx` | Pass a "search enabled" flag (API key present) to the screen. |
| `app/tonight-screen.tsx` | Search box, loading state, divider, fallback notice, race guard. |
| `app/tonight-row.tsx` | Render AI reason chip vs deterministic chip per row position. |
| `lib/check-env.ts` | `ANTHROPIC_API_KEY` as optional-but-recommended. |
| `.env.example` | Add `ANTHROPIC_API_KEY`, `AI_MODEL`. |
| `docs/adr/0004-ai-search.md` | Add a Data boundary section (see §10). |

## 8. Testing

The live LLM call is not unit-tested. Mock the Anthropic client and test the
contract:
- `buildPrompt` — candidates unordered, delimiters present, Places fields absent.
- `parseAndValidate` — hallucinated IDs dropped, duplicates deduped, reason
  truncated, the above/below split correct, invariant (above+below = catalog).
- Fallback path — each failure class in §5 produces the deterministic list.
- The race guard — a stale response does not overwrite a newer query.
- Search box hidden when the API key is absent.

One hand-verified live smoke check (consistent with the v1 plan §15: no browser
E2E in v1).

## 9. Observability

One structured log line per LLM call: query length, model, latency,
outcome (`ok` / `fallback:<class>`), count of strong matches returned.

## 10. Deploy & config

- No DB migration.
- The build must stay env-free (review fix F2) — `lib/ai-rank.ts` constructs
  its Anthropic client lazily, never at import time.
- New env vars: `ANTHROPIC_API_KEY` (optional; absent → feature hidden),
  `AI_MODEL` (optional; default a Sonnet model).
- `docs/adr/0004-ai-search.md` already records AI search as an additive layer
  with ADR-0003 unchanged. This plan adds one thing to it: a **Data boundary**
  section recording that AI search sends Option `name`/`kind`/`tags`/`notes` +
  recency integers to Anthropic on each query — low-sensitivity data that
  leaves the household's self-hosted infrastructure only on an explicit query
  (decision T1).

## 11. Post-launch

D4 was a deliberate ship-then-assess call. After real use, check whether AI
reasons state false facts about history. If they do so too often, constrain the
reason to query-match-only, or add numeric post-validation against the real
data. Until then, the LLM may cite history freely.

## 12. Implementation Tasks

- [ ] **T1 (P1, human: ~3h / CC: ~20min)** — ai-rank module — add `@anthropic-ai/sdk`; build `lib/ai-rank.ts`: lazy client, `buildPrompt` (unordered candidates, XML-delimited text, no Places fields), Anthropic tool-use call with ~10s timeout + one transient retry, `parseAndValidate` (ID integrity, above/below split).
  - Surfaced by: Sections 1, 2, 4; Codex (unordered input, strict schema, delimiters).
  - Files: `package.json`, `lib/ai-rank.ts`
  - Verify: `pnpm test` covers `buildPrompt` + `parseAndValidate`.
- [ ] **T2 (P1, human: ~1h / CC: ~10min)** — server action — `aiRankAction(query)`, `authedAction`-wrapped, returns the validated above/below result or a fallback signal.
  - Surfaced by: Section 1 (the call belongs in a server action).
  - Files: `app/tonight-actions.ts`
  - Verify: typecheck; the action rejects an unauthenticated caller.
- [ ] **T3 (P1, human: ~half day / CC: ~30min)** — Tonight UI — search box, loading state, hairline divider, AI reason chips above / deterministic chips below, inline persistent fallback notice, explicit race guard.
  - Surfaced by: Sections 4, 11; T2; Codex (race handling).
  - Files: `app/page.tsx`, `app/tonight-screen.tsx`, `app/tonight-row.tsx`
  - Verify: hand-verified live smoke check; race-guard unit test.
- [ ] **T4 (P1, human: ~30min / CC: ~5min)** — config gating — hide the search box when `ANTHROPIC_API_KEY` is unset; wire it into `lib/check-env.ts` as optional-but-recommended; add `.env.example` entries.
  - Surfaced by: Section 9; D5.
  - Files: `lib/check-env.ts`, `.env.example`, `app/page.tsx`
  - Verify: `pnpm build` passes with no env vars set.
- [ ] **T5 (P2, human: ~30min / CC: ~5min)** — ADR — add the Data boundary section to `docs/adr/0004-ai-search.md`.
  - Surfaced by: Section 10; T1.
  - Files: `docs/adr/0004-ai-search.md`
  - Verify: the section names what is sent and why it is accepted.
- [ ] **T6 (P2, human: ~30min / CC: ~5min)** — observability — one structured log line per LLM call (query length, model, latency, outcome).
  - Surfaced by: Section 8.
  - Files: `lib/ai-rank.ts`
  - Verify: the log line appears on both an `ok` and a `fallback` path.
- [ ] **T7 (P2, human: ~1h / CC: ~10min)** — tests — fallback paths, hidden-box-when-no-key, plus the T1/T3 contract tests above.
  - Surfaced by: Section 6; Codex (UI state tests).
  - Files: `lib/ai-rank.test.ts`, screen-level tests
  - Verify: `pnpm test` green.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | clean | SELECTIVE EXPANSION; 2 proposals, 0 accepted, 0 deferred |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | issues_found | Outside-voice plan review; 20 points, key catches folded in |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | not yet run |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | not yet run |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | not applicable |

- **CODEX:** outside voice ran; caught the data-boundary gap (now T1) and folded refinements (unordered LLM input, strict tool-use schema, prompt delimiters, explicit race guard).
- **CROSS-MODEL:** the review and Codex both flagged the factual-reason risk; the user made an informed ship-then-assess call (D4).
- **UNRESOLVED:** 0
- **VERDICT:** CEO review CLEARED — `/plan-eng-review` required before implementation.
