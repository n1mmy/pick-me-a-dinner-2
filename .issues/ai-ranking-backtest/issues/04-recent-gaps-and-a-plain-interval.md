# 04 — Prompt v12: recent gaps as a fact, the Interval a plain median again

Status: needs-triage
Type: AFK

## Parent

[Spec: Backtest the AI ranking, then decide](../PRD.md)

## Why

The 40-day v11 Opus run (issue 03) had one Option at #1 on 13 of 39 days,
eaten on 2. The read of 2026-10-28 called it a rarely-chosen Option that the
model kept pushing on "due" alone. The numbers said otherwise: 23 eats, an
Interval of 10, and both eats in the window exactly 21 days after the one
before. Its habit had slowed from ten days to three weeks with no single
long break, so the "current run" Interval (ADR-0012, first amendment) never
reset, and from day eleven of every cycle the snapshot read "twice its
usual gap, not yet eaten". The model ranked a stale number faithfully.
No prompt rule fixes a wrong fact.

Two things follow, both general — no Option is named anywhere:

- **Each candidate and each Tag carries its last three gaps, newest first**
  (`recentGaps`). The pace as it stands, as a raw fact. The prompt says what
  the field is and stops; no threshold, no ratio, no "slowed" label
  (ADR-0012's no-sort-key rule holds).
- **The Interval is the median of every gap again.** With the recent gaps
  on the page the Interval's job is the habit over the whole history, and
  the all-time median is the plainest statement of it. The current-run
  version was a half-measure: neither long-run nor current, hinging on
  where one longest break happened to fall, and two sentences of prompt to
  explain. Its explanation is now one clause. The Interval is a snapshot
  fact only (not a Score factor), so nothing else moves.

## What changed

- `lib/snapshot.ts`: `recentGaps?: number[]` on `SnapshotTiming` (Options
  and Tags), omitted under two eats like the Interval; `intervalOf` is
  `median`; `recentGapsOf` keeps the last three, newest first.
- `lib/ai-search.ts` `SNAPSHOT_EVIDENCE`: the timing bullet names the two
  facts and what each is evidence of. `lib/prepared-note.ts` adds the field
  name to the words that never reach the Household. Both prompt versions
  are "12".
- `scripts/backtest.ts`: a Pick's timing line shows its recent gaps
  ("21/10 (gaps 21,14,10)").
- `CONTEXT.md` Interval entry; ADR-0012 second amendment.

## Acceptance (read, not scored)

- [ ] On the same 60 days as v11 (20 + 40), the Option that led 13 of 39
      days leads far fewer, and its rows say why the pace is what it is
      rather than "its usual stretch has run over".
- [ ] No row names the field or recites the gaps as numbers.
- [ ] The rest of the read (swim Tuesdays, standing choices, Tag reach of
      a too-soon Rejection) holds as in v11.
- [ ] Hit@3/5/10 against Score on the 60 days: context, not a target.

## Comments
