# 02 — Prepared rank numbers mean the stored place; refuse thin rankings

Status: done
Type: AFK

## Parent

[Prepared notes: pre-landing review](../../../plans/prepared-notes-review.md)
— findings O1 and I5;
[Code review 2026-10-23](../../../plans/code-review-2026-10-23.md) — Spec
(c)4. The backtest read
(`.issues/ai-ranking-backtest/issues/02-candidates-after-the-backtest.md`)
found Strata dropping a row or two from the tail on 3 of 20 days, which is
what I5 is about.

## What to build

DESIGN.md "AI layers" says "a numeral always means the same place in the
same ranking". Two things break that today.

- **O1 — rank numbers shift after a row leaves the list.** `rankOf`
  (`lib/picker-view.ts:168`) numbers the Prepared rows still on screen, and
  `resolveRanking` (`:189`) has already dropped the Options Picked, Rejected,
  or Closed since the note was written. The note ranks A #1 and B #2; Reject
  A, and B shows as #1; Pick B, and the decided-day line reads "The note
  ranked B #2" (`lib/prepared-comparison.ts` reads the stored ranking).
  Number a Prepared row by its position in the **stored** ranking, not its
  position on screen. Have `resolveRanking` return each named row's 1-based
  place in the ranking it was given (`rank?: number`), and have the Prepared
  memo in `app/tonight-screen.tsx:766` build `rankOf` from that, with
  `pickerView` taking the map instead of deriving it when one is supplied.
  The Claude AI search layer keeps numbering as it does; its rows are never
  filtered after resolution.
- **I5 — the unranked tail looks model-ranked, and a thin ranking overwrites
  a full one.** Rows appended by `appendUnnamed` get continuing numbers and
  no rationale, so a candidate the note forgot reads as "the note ranked
  this #35". Render appended rows **unnumbered** (the rank gutter empty, as
  DESIGN.md "Tonight row anatomy" allows for a row with no rank) and give
  them the one rationale "The note left this one out", mirroring AI search's
  `OMITTED_CANDIDATE_REASON`. Server side, `parsePreparedReply`
  (`lib/prepared-note.ts:278`) accepts any reply with at least one row;
  refuse one that names fewer than **90% of the candidates** (`null`, so the
  last good note stays), and log the count on the fallback line. 90% is a
  default, not a measurement: it lets the one-or-two-row omissions the
  backtest saw through and refuses the 3-of-37 case the review described. If
  you want a different number, say why in Comments.

Keep the comparison line reading the stored ranking as it does; after O1 the
screen agrees with it.

## Acceptance criteria

- [x] `lib/picker-view.test.ts`: a named row keeps its stored place after an
      earlier-ranked row is gone from `rows`; appended rows carry no `rank`
- [x] `app/tonight-screen.test.tsx`: after a Rejection the next Prepared row
      still shows the note's number; an appended row shows no numeral and
      the left-out rationale; the AI search layer is unchanged
- [x] `lib/prepared-note.test.ts`: a reply naming fewer than the threshold
      is unavailable; one at the threshold parses; the threshold is a named
      constant with its reason beside it
- [x] `DESIGN.md` "AI layers" states the unnumbered appended row and its
      rationale, in the same commit
- [x] `corepack pnpm typecheck`, `lint`, `test`, `build` all green

## Blocked by

- Nothing. Second in the review's suggested order.

## Comments

- O1: `resolveRanking` gives each named row `rank`, its 1-based place in the
  ranking it was given (a repeated id keeps its first place); appended rows
  have none. `pickerView` takes an optional `ranks` map and uses it as given;
  Tonight's Prepared memo builds it from the resolved rows. Claude AI search
  rows still number by screen position.
- I5, screen: an appended row has an empty rank gutter and the rationale
  "The note left this one out" (`PREPARED_OMITTED_REASON` in
  `app/tonight-screen.tsx`). The existing filter test now ranks Cherry Pie in
  its note, since an unnamed row no longer carries a number to keep.
- I5, server: the refusal lives in `prepare`, not `parsePreparedReply`, so
  the fallback log line can carry the row count (`rowCount` is now the rows
  read, on either path). `MIN_RANKED_SHARE = 0.9`, kept as the issue's
  default; a ranking is kept when `rows / candidates >= 0.9`. The parser
  still reads a one-row reply, so its tests stay about parsing. The client
  tests' good replies now rank all three candidates.
- DESIGN.md "AI layers" gains "A Prepared numeral is the note's own place".
- Gate: typecheck, lint, test (569), build all green.
