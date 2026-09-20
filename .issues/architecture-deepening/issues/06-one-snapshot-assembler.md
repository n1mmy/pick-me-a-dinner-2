# 06 — Build the AI snapshot in one place (the eval harness is measuring a different one)

Status: done
Type: AFK

## What to build

`buildSnapshot` (`lib/ai-search.ts`) is pure and well tested, but the
*assembly* around it — which queries feed it, and how their rows are mapped —
is written out three times, and two of the three have drifted:

| Site | Log source |
| --- | --- |
| `app/tonight-actions.ts:56-79` (production) | `getFullLogForSnapshot()` — past entries **and** Planned dinners |
| `scripts/ai-search-eval.ts:183-215` | `getTonightData(today).logEntries` — **non-future only** |
| `scripts/model-comparison/show-prompt.mjs:39-66` | `getTonightData(today).logEntries` — **non-future only** |

ADR-0008 is explicit that the AI snapshot sees the household's near future, and
`app/tonight-actions.ts`'s own docstring explains why the deterministic query is
the wrong source ("picking for Friday should not blind the model to Sunday's
already-planned pizza"). The two script sites never got that change, so the
model-comparison sweeps — the ones that picked the current default model and
effort — scored a snapshot production does not send, and `show-prompt` prints a
prompt the app never issues. Both scripts also re-derive
`todaySqlDate(new Date(), process.env.APP_TZ ?? "UTC")` inline, the binding
issue 02 consolidated into `today()` everywhere else, and `show-prompt.mjs`
hand-copies `createAiSearchClient`'s user-turn split under a comment that says
"exactly how `createAiSearchClient` splits the user turn" — a drift waiting to
happen.

Concentrate the assembly.

- Create `lib/snapshot-source.ts` exporting one async function:
  `snapshotForDay({ asOf, query })`, returning
  `{ snapshot, idByIndex, nameById }`.
  - It owns the three reads (`getTonightData(asOf)` for the Catalog,
    `getFullLogForSnapshot()` for the Log, `getRejections()`), the
    `SnapshotOption` / `SnapshotLogEntry` mapping both call sites currently
    repeat, and the `buildSnapshot` call.
  - `nameById` (the UUID → name map the eval harness builds for display) comes
    back from here too, so the script stops re-deriving it.
  - `asOf` is required and validated by the caller — this module does not read
    the clock, so it takes a day rather than defaulting to one.
- `app/tonight-actions.ts` keeps the API-key check, the Selected-day
  resolution, and the `createAiSearchClient(...).search(...)` call; its body
  becomes one `snapshotForDay` call. Its `getTonightData` /
  `getFullLogForSnapshot` / `getRejections` imports go.
- `scripts/ai-search-eval.ts`'s `buildSnapshotFromDb` becomes a call to
  `snapshotForDay({ asOf: today(), query })` — **this is the fix**: the eval
  harness now measures production's snapshot, Planned dinners included.
- `scripts/model-comparison/show-prompt.mjs` uses `snapshotForDay` too, and
  stops hand-copying the user-turn split: export the split from
  `lib/ai-search.ts` as `splitUserTurn(snapshot)` →
  `{ snapshotBody, queryBlock }`, have `createAiSearchClient` use it, and have
  `show-prompt.mjs` print its output. The printed prompt is then the issued
  prompt by construction.
- `app/tonight-actions.test.ts` currently mocks `db/queries`; re-point it at
  `lib/snapshot-source` (mocking `snapshotForDay`) or keep the query mocks and
  let them flow through the new module — either is fine, but the existing
  assertions about what the action forwards must survive.
- New `lib/snapshot-source` coverage is not required beyond what
  `lib/ai-search.test.ts` already gives `buildSnapshot`: the module is the
  read-and-map adapter, and its one interesting fact — that the Log comes from
  `getFullLogForSnapshot` — is asserted by the existing action test.

**Note for whoever runs the next sweep.** The baseline in
`scripts/model-comparison/` was measured against the non-future snapshot. It is
not invalidated, but it is not directly comparable to a post-fix run; say so in
`scripts/model-comparison/README.md` rather than silently re-baselining.

No ADR change — this makes ADR-0008's "the snapshot sees the near future" true
in the harness as well as the app. No `CONTEXT.md` change.

## Acceptance criteria

- [ ] `lib/snapshot-source.ts` exports `snapshotForDay({ asOf, query })` and is
      the only place `buildSnapshot` is called outside its own tests
- [ ] `app/tonight-actions.ts`, `scripts/ai-search-eval.ts`, and
      `scripts/model-comparison/show-prompt.mjs` all route through it; none of
      the three maps `SnapshotOption` / `SnapshotLogEntry` itself
- [ ] The eval harness and `show-prompt` both send the **full** Log
      (`getFullLogForSnapshot`), matching production
- [ ] No `process.env.APP_TZ` binding remains in `scripts/ai-search-eval.ts` or
      `scripts/model-comparison/show-prompt.mjs` — both use `today()`
- [ ] `lib/ai-search.ts` exports `splitUserTurn`; `createAiSearchClient` and
      `show-prompt.mjs` both use it, and `show-prompt.mjs` contains no
      hand-copied split
- [ ] `app/tonight-actions.test.ts` still asserts what the action forwards
- [ ] `scripts/model-comparison/README.md` notes that the existing baseline
      predates the Log-source fix
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green, and
      `pnpm build` passes with no env vars set

## Blocked by

- [05 — Concentrate Tonight's Selected-day suppression into one module](./05-tonight-day-candidate-set.md)
  — only for sequencing: both restructure the Tonight/AI-search wiring, and
  taking 05 first keeps the two diffs from overlapping in `app/`.
