# 03 — AI snapshot includes the future

Status: ready-for-agent
Type: AFK

## Parent

[PRD: Dated Rejections on the Log](../PRD.md)

## What to build

Extend the **AI search** snapshot so the model sees the Household's near
future, not only past history (extends ADR-0005).

- `buildSnapshot` is fed the **full Log** including future-dated entries
  (**Planned dinners**); the snapshot `log` carries each entry with its real
  date. The snapshot already includes today's date, so the model distinguishes
  a plan from history itself.
- A full-Log feed query for the snapshot (every Log entry, all dates, active
  Options) replaces the non-future Log the snapshot currently borrows from
  `getTonightData`. The deterministic ranking keeps its non-future Log — only
  the AI snapshot sees the future.
- The Rejections block keeps **two** groups. The not-today group already
  receives future-dated rows via `partitionRejections`; relabel it
  date-neutrally in the snapshot type and the system prompt — the current
  "Earlier rejections" wording would misdescribe a future row — and have the
  prompt state that each row carries its own date, past or upcoming. No third
  group is added.
- The today-only suppression / candidate-removal set is unchanged: an Option
  whose only Rejection is future-dated stays a candidate.

Extend `lib/rejections.test.ts` and `lib/ai-search.test.ts` for the new
behavior. No live Anthropic call is made in any test.

## Acceptance criteria

- [ ] `buildSnapshot` includes future-dated Log entries in the snapshot `log`,
      each with its real date
- [ ] The deterministic ranking (`lib/ranking.ts`) still excludes future Log
      rows
- [ ] The not-today Rejections group carries future-dated rows and is labelled
      date-neutrally in the snapshot type and the system prompt
- [ ] An Option whose only Rejection is future-dated stays in the candidate
      `options`
- [ ] The suppression set remains `rejected_on = today` only
- [ ] `lib/rejections.test.ts` and `lib/ai-search.test.ts` are extended for the
      above
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green, and
      `pnpm build` passes with no env vars set

## Blocked by

- None — can start immediately
