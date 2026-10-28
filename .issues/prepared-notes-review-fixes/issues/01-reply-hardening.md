# 01 — Model reply hardening: bound the brief, abort on every failure path

Status: ready-for-agent
Type: AFK

## Parent

[Prepared notes: pre-landing review](../../../plans/prepared-notes-review.md)
— findings I2 and I3. The GPT-6.1 Sol outside voice named I3 as its reason
to request changes.

## What to build

Both fixes are in `lib/prepared-note.ts`.

- **I2 — a brief has no length bound.** `parsePreparedReply` (`:278`) caps
  each rationale at `MAX_PREPARED_RATIONALE_LENGTH` but takes everything on
  the brief's side of the marker as the brief. Since prompt v10 the brief is
  below `=== BRIEF ===`, so anything trailing the marker — reasoning leaking
  into `content`, a second ranking, a template change on the server — is
  stored and rendered in full at 720px and wider. Refuse a brief over about
  1,200 characters (the prompt asks for 40–70 words, about 450 characters):
  return `null`, so the last good note stays. Add `MAX_PREPARED_BRIEF_LENGTH`
  beside the rationale cap, with a comment saying why it refuses rather than
  truncates (a truncated brief would be stored as good and read as the
  model's whole answer). The v9-order fallback (rows below, brief above) gets
  the same bound.
- **I3 — the request isn't aborted on failure paths.** `prepare` (`:482`)
  sets a timeout that aborts `controller`, but `finally` (`:527`) only clears
  the timer. A non-JSON SSE event (`JSON.parse` throwing inside
  `readStream`), a non-ok response, or a missing body all leave the HTTP
  stream open, so Strata keeps decoding up to 20k tokens for a reader that is
  gone while the sweep starts the next date on the same GPU. Call
  `controller.abort()` in `finally`; it is a no-op once a fetch has finished.

## Acceptance criteria

- [ ] `lib/prepared-note.test.ts`: a case in the `is unavailable when` table
      for a brief over the bound, in both marker orders; a brief at the
      bound still parses
- [ ] `lib/prepared-note.test.ts`: a stub stream with a `data: not-json`
      event, a non-ok response, and an ok response with no body each leave
      the `fetch` call's `signal.aborted` true once `prepare` returns; a
      good reply still parses (the abort lands only after `readStream` has
      returned)
- [ ] `scripts/prepared-note-eval.ts` and `scripts/backtest.ts` still run:
      `--reasoning` traces are unaffected (the abort happens after
      `readStream` returns on the success path)
- [ ] `corepack pnpm typecheck`, `lint`, `test`, `build` all green

## Blocked by

- Nothing. First in the review's suggested order; lands before Prepared notes
  issue 07 (deploy).
