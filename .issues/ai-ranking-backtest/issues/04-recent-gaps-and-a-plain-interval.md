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

- 2026-10-28 — **v12 Opus on the original 20 days**
  (`scripts/backtest-runs/ai-search-v12-opus-5-5-pithy.*`, compared with
  the v11 run of the same days). The 40 further days are held back until
  the change is settled; a chained 40-day run was stopped after a few
  days and its partial files are not recorded.

  **The fact did not land the way it was meant to.** Aji Ichi is #1 on 4
  of the 20 days (v11: 1), top 3 on 8 (v11: 8), eaten on none. Its last
  eat is 09-28 throughout, so the snapshot shows it at 9 to 23 days since,
  against an Interval of 10 and recent gaps of 21, 21, 14. The model reads
  the slowdown and then treats it as a debt: "has settled into a slower
  recent pace that is due again now" (#2, 10-07, nine days since); "recent
  pace has slowed well past its usual weekly beat" (#1, 10-15, seventeen
  days, and no weekly beat in the facts); "the recent Aji Ichi pace is
  overdue" (#1, 10-16, eighteen days against gaps of 21); "Aji Ichi has
  gone longer unordered" (#3, 10-21). The prompt says what `recentGaps`
  is ("the pace as it stands") and not what a changed pace is evidence of,
  so the due reflex fills the gap: a pace that has slowed reads as
  neglect to make up, not as the Household choosing it less.

  **The rest of the read holds.** Hit@3 10 → 13 (10-12, 10-13, 10-17
  gained, none lost); hit@5 and hit@10 unchanged at 13 and 17; same #1 on
  16 of 20; top-5 slots on never-eaten Options 58 → 48 of 100. Swim
  Tuesdays, Mazra's saved-for-Jen reading, the quiche best-by, Tadu's
  Mondays all read as in v11. No empty reasons; no field names in the
  prose; the gaps are not recited as numbers (one row says "their sushi
  gaps run around four to seven days", which is the Tag's gaps in words).
  Mean rank 5.5 → 7.2 on two outliers: West Coast Cafe #15 → #35 on
  10-16 ("Italian, rare") and Leftovers #10 → #31 on 10-21 ("Leftovers
  were just eaten": they were, on 10-17, so this is the model reading a
  four-day gap as "just"). Latency and output tokens within noise (12.4
  → 12.7 s, 1045 → 1085).

  **Interval as a plain median changed little on these days.** The Picks'
  timing lines moved (Atlas 14/20 → 14/12, Big Mouth 29/20 with gaps
  82,18,22) without moving their ranks.

  Not done: a wording change. The one general sentence that would address
  the misreading is an evidence statement, not a rule — what a slowed pace
  is evidence of — and whether to add it is the user's call.
