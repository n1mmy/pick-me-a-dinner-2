# 13 — The rationale rules state the row, not a recipe (prompt v16)

Status: done
Type: AFK

## Parent

[Spec: Backtest the AI ranking, then decide](../PRD.md)

## Why

A live v15 open search for Thursday 2026-10-29 led every top-5 row with a
weekday: "Thursday is a regular sushi night" (Aji Ichi: 3 of 25 eats),
"Their Friday-ish pizza slot fits" (on a Thursday), "A Monday-style takeout"
(on a Thursday), "usually saved for Tuesday swim, but it suits a Thursday
too". The v15 backtest log reads the same: nearly every strong row is
*lead fact, and its pace has come round*, in about 100 characters.

That shape is prescribed. `RATIONALE_RULES` said "Lead with [a note / a
standing reason / the shape of the evening / a weekday habit]. Timing earns
at most a clause after that", and `OPEN_QUERY_INSTRUCTION` set the budget
("roughly 100 characters (140 at most)", "three to six words"). Three of the
four leads need a Day note or a note to quote; the weekday is on every Log
date. "Vary how the rationales open" then produced varied phrasings of the
one template. Issue 10 removed the weekday counts the claims were read off,
and the claims changed kind, not count (35 of 65 → 35 of 59).

v11 made the move for the weighing — state what each thing is evidence of,
leave the judgment to the model — and the commit says it worked. The writing
rules were still the v10 shape: seven rules, one per failure in some run.
This issue makes the same move for the writing.

## What to do

- `RATIONALE_RULES` becomes one statement (both prompts): what the row shows
  (name, days since, the same per Tag), what the line is for (why it sits
  where it does this evening — for a genuine pick, what makes it one; for
  the rest, what keeps it below the rows above), third person, in their
  words. No lead menu, no timing clause, no enumerated ban, no "vary".
- `OPEN_QUERY_INSTRUCTION` drops the character and word budgets and the
  two named tiers: "one sentence for the few genuine picks, a few words for
  the rest". The 200-character cap in `parseRankingText` stays as the guard.
- The Prepared prompt's own "never in the snapshot's" bullet folds into the
  shared statement ("in their words — the food, the person, the night"); its
  own lengths for the top five and the brief stay where they are.
- Both prompt versions `"16"`; the tests; `CONTEXT.md`'s AI rationale entry;
  ADR-0005's third amendment.

## Read (billed)

One Opus 5.5 AI-search run of v16 on the 20 days, compared against
`ai-search-v15-opus-5-5-pithy.json` through `backtest-compare`. Twenty
billed calls, about three dollars; approved 2026-10-29. Read for:

- weekday leads naming a day that is not the evening's gone;
- notes still quoted where they bear;
- the elapsed-time restatement (f8a8ff5) not back — the one failure the
  deleted ban was written for, now held off by the positive framing alone;
  if it returns, the fix is a short guardrail paired with the positive, not
  the enumerated list;
- hit@N within v15's noise.

## Acceptance

- [x] Both prompts read `RATIONALE_RULES` as one statement; no "Lead with",
      "NEVER state", "Vary how", or a character budget in `lib/`.
- [x] The Opus runs are recorded as `ai-search-v16-opus-5-5-pithy.{json,log}`
      and `ai-search-v17-opus-5-5-pithy.{json,log}`, and their reads are
      comments below. v17 ships.
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test` pass.

## Comments

- **The v16 read** (Opus 5.5, default effort, the 20 days; 20 billed calls;
  `ai-search-v16-opus-5-5-pithy.{json,log}`, against v15 with
  `backtest-compare`). **The positive framing did not hold.** Counted over
  the top-10 rows of all 20 days (200 each), v15 → v16:
  - rows restating elapsed time (a day/week/month count, "days ago", "last
    night"): **3 → 91**. The f8a8ff5 failure, back and worse than v10:
    "Atlas is at 14 days", "hasn't come up in 114 days", "Two days ago.",
    "Last night." — the tail is almost nothing but.
  - rows opening with the Option's name: **12 → 131**. v15's "do not open
    with the name" was earning its place too.
  - rows using the snapshot's words (tag, pace, rhythm, cadence): 21 → 30
    ("Swim-tagged Korean", "its 12–16 day pace").
  - rows naming a weekday that is not the evening's: 30 → 28. The thing
    this issue set out to move did not move.
  - mean row length 70 → 88 characters; output tokens 1222 → 1267.
  - Ranking: hit@3 12 → 10, hit@5 12 → 13, hit@10 17 → 15, mean rank
    6.0 → 7.8, median 3 → 3; same #1 on 16 of 20. Two single-day swings
    (10-12 Local Kitchens #6 → #27, 10-21 Leftovers #21 → #33). Noise-sized
    on the hits, worse on the mean.
- **Why, in one line:** naming the quantity in the first sentence ("how
  many days since they last had it") put the number in the model's mouth
  as the thing the row is about; "in what you found" then read as the
  numbers it found. What the row *shows* is not a model the model holds
  of the reader's screen; the ban was a hard guardrail, which is the one
  case the writing guidance allows a prohibition — paired with the
  positive, not enumerated.
- Status stays in-progress: v16 is not shippable as the live prompt. The
  pre-registered fallback is a v17 — v16's shape plus one guardrail clause
  (the number is theirs to read; the line says what it means) and the
  name rule back as a fact ("they read the line beside the name") — one
  more billed run. Or v15 back. Decision with the user.
- **v17 written** (approved 2026-10-29, one more run of 20 billed calls):
  v16's one statement, with the elapsed-time and name rules back as one
  clause each paired with the positive, and "in what you found" → "in
  their history or their own words". The lead menu, the timing clause,
  "vary" and the budgets stay gone. Read for the same four things, with
  v15's 3 / 12 (elapsed-time rows / name-opening rows of 200) as the bar.
- **The v17 read** (`ai-search-v17-opus-5-5-pithy.{json,log}`; the same
  counts over the 200 top-10 rows, v15 / v16 / v17):
  - elapsed-time rows **3 / 91 / 6** — the guardrail holds.
  - rows naming the evening's own weekday 59 / 53 / **40**; of those, on
    an Option eaten on that weekday twice or fewer before the day (issue
    10's thin-count test) **35 / 25 / 16**, and on three or more 24 / 28 /
    24. The sound weekday claims (swim Tuesdays, Sunday quiche, Monday
    Aji Ichi) are all still there; the thin ones halved. Of the 16 left,
    seven are "open on <weekday>" (Tadu five times, Ninja on a Sunday —
    the `closedDays` sentence issue 10 flagged), and three or four are
    still habits read into two eats ("Fridays have often brought it" for
    Mazra at 2 of 13, "Sunday pizza fits their pattern" for Atlas at 2 of
    16).
  - rows naming a weekday that is not the evening's 30 / 28 / 25: the
    "Friday-ish pick" on a Thursday is rarer, not gone.
  - rows opening with the Option's name 12 / 131 / **59**: the one
    regression against v15. The clause is there ("They read the line
    beside the name, so it never opens with it") and holds only half as
    well as v15's bullet did; mid-paragraph, it may read as less of a
    rule than a line of its own.
  - snapshot words 21 / 30 / 19; mean row length 70 / 88 / 78 characters.
  - Ranking: hit@3 10, hit@5 12, hit@10 18, mean rank 6.0, median 3 —
    level with v15 (12 / 12 / 17, 6.0, 3). Same #1 on 13 of 20 against
    v15; two single-day swings (10-15 Big Mouth #20 → #32, 10-21
    Leftovers #21 → #8). Too-soon days 3 (10-11, 10-19, 10-20) against 2.
  - Reading the top fives: more of the household's own words quoted
    ("saving for tues", "the PTA dinner was not their own pick"), evening
    fit named more often, and the *lead + "its pace has come round"* shape
    is no longer the default. The prompt is ~400 words shorter.
- **Verdict:** v17 does what the issue set out to do on the weekday claims
  and the template, at level ranking, with the name-opening regression as
  its cost. Whether to ship it as is or spend one more run on the name
  rule as its own line is the user's call.
- **The Prepared v17 read** (Opus 5.5, `--claude`, effort low;
  `prepared-v17-opus-5-5-low.{json,log}` and `-reasoning/`; 20 billed
  calls, run in two parts after the session ended at 18 days). Against
  the two v15 Prepared Opus runs, the same counts over 200 top-10 rows
  (v15 / v15 run2 / v17):
  - elapsed-time rows 11 / 9 / **3**; rows naming the evening's weekday
    60 / 68 / **51**; rows naming another weekday 55 / 50 / **38**. The
    briefs: elapsed time in 7 / 5 / 6, the weekday named in 13 / 18 / 11,
    "you" in none. The briefs read well — each opens on the kind of
    evening and names one or two picks in the household's words.
  - rows opening with the Option's name 59 / 48 / **132**: worse again
    than on AI search, as two- or three-sentence rows naturally start
    "Mazra is…".
  - rows using the snapshot's words (pace, rhythm, spacing, tag)
    9 / 7 / **48**. This is the Prepared prompt's own vocabulary bullet,
    folded into "in their words — the food, the person, the night" in
    v16: the enumerated list ("the words tag, interval, cadence, rhythm
    and spacing … never appear") was doing work the positive form does
    not, on this prompt's longer rows.
  - Ranking 11/11/16, mean rank 6.5, median 2, too-soon days 1 — level
    with v15's 11/13/17 and 10/13/14. Thinking on some days only, as
    before.
- **Open for the Prepared prompt:** two regressions — the name opening
  and the snapshot vocabulary — against gains on elapsed time and the
  weekday. The vocabulary one has a known fix (its bullet back, as a
  guardrail paired with the positive); the name one is the same open
  question as on AI search. Not done here; the user decides whether v18
  carries both.
