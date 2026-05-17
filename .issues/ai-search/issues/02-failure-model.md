# 02 — AI search: failure model and fallback

Status: ready-for-agent
Type: AFK

## Parent

[PRD: AI search on Tonight](../PRD.md)

## What to build

Make AI search **fail safe**. When the model call cannot complete, the
Household loses nothing: the deterministic ranked list is left exactly as it
was, and an inline error explains what happened.

In `lib/ai-search`, give the Anthropic call a **~10-second timeout** (an
`AbortController`). On a **transient** failure — timeout, HTTP 429, 5xx, or a
network error — retry the call **once**. A non-transient failure — malformed or
unparseable tool-use output, which a retry would not fix — is not retried.
Every failure mode collapses to a single typed fallback outcome, the way the
Places client collapses every failure to one "unavailable" result.

On Tonight, when `aiSearchAction` returns the fallback outcome, show a
**persistent inline error** on the search box ("Search unavailable — try
again") and leave the deterministic list untouched. The error clears when the
query is cleared or a later search succeeds. The Household can retry, or simply
keep using the deterministic ranking.

## Acceptance criteria

- [ ] The Anthropic call has a ~10-second timeout via `AbortController`
- [ ] A transient failure (timeout, 429, 5xx, network) is retried exactly once;
      a malformed-output failure is not retried
- [ ] Every failure mode collapses to one typed fallback outcome
- [ ] A failed search leaves the deterministic list exactly as-is and shows a
      persistent inline error on the search box
- [ ] The inline error clears on query-clear or a subsequent successful search
- [ ] Unit tests cover each failure class mapping to the fallback, and the
      retry-once-on-transient / no-retry-on-malformed behavior; a screen-level
      test covers "a failed search leaves the deterministic list intact and
      shows the error"
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green

## Blocked by

- Issue 01 — AI search: end-to-end skeleton
