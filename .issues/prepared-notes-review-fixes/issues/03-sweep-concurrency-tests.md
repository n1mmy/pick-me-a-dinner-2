# 03 — Sweep guards: lease derived from the timeout, claim race and prompt-version tests

Status: done
Type: AFK

## Parent

[Prepared notes: pre-landing review](../../../plans/prepared-notes-review.md)
— findings I7 and I9;
[Code review 2026-10-23](../../../plans/code-review-2026-10-23.md) —
Architecture deepening (a)4 (the lost `inputHash` prompt-version test).

## What to build

Three invariants of `runSweep` (`lib/prepared-notes.ts:137`) hold only by
comment or by luck. Each gets a test; one gets a derived constant.

- **I7 — the lease outlasts the timeout only in prose.** `CLAIM_LEASE`
  (`lib/prepared-notes.ts:59`) is a bare `interval '45 minutes'` and
  `REQUEST_TIMEOUT_MS` (`lib/prepared-note.ts:344`) a private 40-minute
  constant. Each comment names the other; nothing enforces it, and the
  timeout has been raised once already. If the next raise passes the lease,
  a second replica takes over a date mid-generation and no test fails.
  Export `REQUEST_TIMEOUT_MS`, derive the lease from it (timeout plus five
  minutes, built into the `sql` fragment), and unit-test that the lease is
  longer than the timeout.
- **I9 — the claim race branch is untested.** The `claim.inputHash === hash`
  branch (`:158`), where the other replica wrote this exact note between the
  read and the claim, has no test: delete the branch or its `releaseClaim`
  and nothing fails. The existing "leaves a date to the replica that holds
  its claim" test (`lib/prepared-notes.db.test.ts:250`) covers
  `claim === null`. Add a DB test that stores a note, then mocks
  `getPreparedNote` to return `null` for the next sweep; assert the client
  is asked nothing and that `claimDay` succeeds straight afterwards (the
  claim was released).
- **The prompt-version hash test is gone.** Prepared notes issue 02 ticked
  "`inputHash` changes with the prompt version"; the test lived in the
  deleted `lib/prepared-notes-job.test.ts`. `inputHash` is private now, and
  `PREPARED_PROMPT_VERSION` has been bumped five times since with nothing
  covering the path. Add a DB test through `runSweep`, the way architecture
  issue 01 asked: mock `PREPARED_PROMPT_VERSION` to a new value and assert
  the stored note is regenerated.

## Acceptance criteria

- [x] `REQUEST_TIMEOUT_MS` exported; `CLAIM_LEASE` built from it; a unit
      test asserts lease > timeout
- [x] `lib/prepared-notes.db.test.ts`: the claim-race test above; deleting
      the `claim.inputHash === hash` branch makes it fail
- [x] `lib/prepared-notes.db.test.ts`: a prompt-version bump regenerates a
      stored note
- [x] `corepack pnpm typecheck`, `lint`, `test`, `test:db`, `build` all
      green

## Blocked by

- Nothing. Third in the review's suggested order.

## Comments

- I7: `REQUEST_TIMEOUT_MS` exported; `CLAIM_LEASE_MS = REQUEST_TIMEOUT_MS +
  5 * 60_000` (still 45 minutes), and the `sql` fragment is built from it.
  `lib/prepared-notes.test.ts` asserts lease > timeout.
- I9: `getPreparedNote` is wrapped in a pass-through `vi.fn` module mock; the
  race test stores a week of notes, makes the read return `null`, and checks
  the client is asked nothing and every date can be claimed straight after.
  Mutation-checked: deleting the `claim.inputHash === hash` branch fails it,
  and so does deleting only its `releaseClaim`.
- Prompt version: `PREPARED_PROMPT_VERSION` is mocked with a getter over a
  hoisted override; bumping it makes the next sweep regenerate all seven
  dates with a new hash. Mutation-checked: dropping the version from
  `inputHash` fails it.
- Gate: typecheck, lint, test (570), test:db, build all green.
