# 07 — Small cleanups the reviews named

Status: ready-for-agent
Type: AFK

## Parent

[Prepared notes: pre-landing review](../../../plans/prepared-notes-review.md)
— C1 residual, I6, M1–M3, O2, O5;
[Code review 2026-10-23](../../../plans/code-review-2026-10-23.md) —
Standards #2 and #5, Spec (c)6.

## What to build

Each item is small and independent. Do them in one commit per bullet or all
together; none needs a design decision.

- **M1 / Standards #2 — `APP_TZ ?? "UTC"` in three places.**
  `lib/local-day.ts:72` says the fallback lives in one place; `app/page.tsx:76`
  and `instrumentation.ts:32` repeat it. Add `appTimeZone()` beside `today()`
  and use it in all three.
- **Standards #5 — `LOCAL_AI_*` read outside its one reader.**
  `lib/prepared-note.ts:56` calls `localModel()` the one place the model is
  read, but `instrumentation.ts:34-35` and `scripts/prepared-note-eval.ts:96,
  97, 123, 171` read the variables directly. Add a `localModelConfig()`
  returning `{ baseUrl, apiKey, model }` next to `localModel()` and route
  every reader through it.
- **M2 — `PreparedNoteRow` is a dead export** (`db/schema.ts:212`). Delete.
- **M3 — the eval script's run-time comment is stale.**
  `scripts/prepared-note-eval.ts:30` still says "a few minutes at Strata's
  ~25 tok/s"; the measured figures are six to ten minutes idle and up to
  about 35 under load (`lib/prepared-note.ts:336`). Fix the line.
- **O2 — a date with zero candidates is retried every sweep.** When every
  Option is Closed or Rejected for a date, or the Catalog is empty, the
  model is still called and its empty ranking always refused, so the date
  regenerates every ten minutes. In `runSweep` (`lib/prepared-notes.ts:149`),
  skip a day whose `built.idByIndex` is empty. DB test.
- **C1 residual — a date Picked mid-sweep is still generated.**
  `eligibleDays` is read once per sweep; a Pick landing while an earlier
  date generates still claims and generates this one, only to be refused at
  the store, wasting one 10–40 minute generation. Re-check
  `getDecidedDates(day, day)` before `claimDay`. DB test.
- **I6 — a sweep crossing midnight writes one note for a past date.** `now`
  is fixed per sweep. Recompute today per iteration (a `clock` parameter in
  place of the fixed `now`, defaulting to `() => new Date()`). Low priority;
  skip if it complicates the signature for the tests.
- **O5 — the stream reader keeps reasoning it never uses.** `readStream`
  (`lib/prepared-note.ts:383`) accumulates `reasoning` always; production
  passes no `onReply`. Accumulate it only when `onReply` is set. The eval and
  backtest scripts set it, so their `--reasoning` traces are unaffected.
- **Spec (c)6 — the spec documents are stale.** `.issues/prepared-notes/PRD.md`
  (lines 37, 161, 167) and `plans/prepared-notes.md` (25, 137, 148) still
  say a 150–300 word brief, a 15-minute timeout, and a 20-minute lease; the
  code uses 40–70 words, 40 minutes, and 45 minutes. PRD Story 4 still asks
  the brief to warn about closed Restaurants; say the Closed disclosure
  carries that. Wording only.

## Acceptance criteria

- [ ] Each bullet done or struck through with a one-line reason in Comments
- [ ] `grep -rn 'APP_TZ ??' --include=*.ts --include=*.tsx .` and
      `grep -rn 'process.env.LOCAL_AI' --include=*.ts --include=*.tsx .`
      each find one file
- [ ] `corepack pnpm typecheck`, `lint`, `test`, `test:db`, `build` all
      green

## Blocked by

- Issue 03 if it lands first (both touch `runSweep`); otherwise nothing.
