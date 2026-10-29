# 03 — Prompt v11: the prompt states evidence, the model weighs

Status: needs-triage
Type: AFK

## Parent

[Spec: Backtest the AI ranking, then decide](../PRD.md)

## Why

Two v10 Opus runs (issue 02, comments of 2026-10-28) read the same way: the
wording measures moved a lot (elapsed-time flags 44–51 → 10–15, bb.q out of
the top 5, reasons leading with notes and orders) and the ordering measures
barely moved or went backwards (never-eaten top-5 slots 52 → 45, Aji Ichi
11 → 13 top-5 days, hit@5 16 → 13–14). The model quoted a rule and ranked
against it in the same row ("it sits at half its usual stretch", Mazra #3 on
10-15). The Interval fix for Aji was absorbed by a new frame — "the sushi
staple when Ninja is too soon" — that both v10 runs state outright.

The grill of 2026-10-28 settled the direction (`/grill-with-docs`):

- **General means across Options.** No prompt rule, example, or evaluation
  target is written for a named Option. The app stays one Household's
  instrument (ADR-0002).
- **The AI ranks the whole list** (ADR-0005 and ADR-0011 unchanged); every
  ranked row carries a reason, tail rows in a few words, because output
  tokens are the wait.
- **The prompt says what each kind of data is evidence of and stops.**
  Weighing is the model's (ADR-0005 amended). The thresholds ("in play from
  two-thirds"), "being due is not being wanted", the novelty placement rule,
  the weekday-habit test, and every example drawn from this Household's Log
  are gone. The one statement kept about the Interval is that it is a median
  of the Household's own gaps, so falling short of it is ordinary.
- **Rejections are listed per Tag as well as per Option** in the snapshot,
  same rows, reason included (ADR-0006 amended). A "too recent" under
  `sushi` reaches every sushi Option; the model still judges the reason.
- **The harness is for reading a prompt change.** `backtest-compare` now
  opens with each day's top 10 and brief from both runs, the Pick marked,
  the flags as markers on their rows. The numeric acceptance test in issue
  02 is context, not a target.

## What changed

- `lib/snapshot.ts`: each entry in `tags` carries `rejections` (date, Option
  number, reason; newest first) when any Option carrying the Tag has one.
  Tags are read from the Catalog as it stands, not from the row's copy.
  Backtest mode cuts them to before the anchor day like the block.
- `lib/ai-search.ts`: `SNAPSHOT_EVIDENCE`, `RECENCY_THROUGH_HABITS` and
  `RATIONALE_RULES` replace `TIMING_FACTS_DESCRIPTION`, `CADENCE_RHYTHM`,
  `DAY_OF_WEEK_RHYTHM`, `STANDING_REASONS_AND_TRIGGERS`, `NOVELTY_RULE` and
  `RATIONALE_LEAD`. Pithy mode never asks for an empty reason: a weak pick
  gets three to six words. `AI_SEARCH_PROMPT_VERSION` is "11". The pithy
  system prompt is 1,530 words, from 2,577.
- `lib/prepared-note.ts`: shares the three blocks; keeps its own output
  contract (name column, brief last) and the vocabulary rule, without the
  Household-drawn examples. `PREPARED_PROMPT_VERSION` is "11", so every
  stored note regenerates.
- `scripts/backtest-compare.ts`: the read section, first.
- `CONTEXT.md`: Interval loses its thresholds; Rejection says a too-soon
  reason speaks for the Tags. ADR-0005 and ADR-0006 carry amendment lines.

## Acceptance

Read, not scored: an Opus 5.5 pithy run of v11 on the twenty v9/v10 days,
compared day by day against `ai-search-v10-opus-5-5-pithy` and `-run2`
through the read section. What to look for:

- [ ] A Tag's too-soon Rejection is read against the other Options of its
      kind: no top-5 row whose reason makes one Option the stand-in for
      another the Household just turned down as too recent.
- [ ] No ranked row with an empty reason; the Pick's row always says
      something.
- [ ] No row that quotes a rule it then ranks against — there are no rules
      left to quote.
- [ ] Rarities well past their Interval that the Household did eat
      (10-10, 10-16) are not pushed down by a rule; wherever they land, the
      reason is about the evening or the Option, not a policy.
- [ ] The flags (elapsed, weekday claim on flat counts, timing-only) stay
      at or under v10's.
- [ ] hit@5 not below the Score baseline's 8/20 by less than the noise
      floor — the floor check, not the goal.

The Strata run of v11 follows, compared the same way against `strata-v10`.
Which days and which model for later runs: decided per run.

## Comments

- 2026-10-28: v11 Opus run, read against v10 run 2 through the read
  section (`npx tsx scripts/backtest-compare.ts
  scripts/backtest-runs/ai-search-v10-opus-5-5-pithy-run2.json
  scripts/backtest-runs/ai-search-v11-opus-5-5-pithy.json`). Same 20 days,
  same dev DB, candidate counts match. Saved as
  `scripts/backtest-runs/ai-search-v11-opus-5-5-pithy.{json,log}`.

  | Opus 5.5 pithy | v9 r1 / r2 | v10 r1 / r2 | v11 |
  | --- | --- | --- | --- |
  | hit@3 / hit@5 / hit@10 | 13/14/15, 14/16/17 | 11/13/15, 14/14/17 | 10 / 13 / 17 |
  | mean / median rank | 8.4/3, 6.7/2 | 8.2/2, 6.5/2 | 5.5 / 3 |
  | too-soon days | 2 / 2 | 1 / 3 | 1 (10-20 Thai #5) |
  | Aji Ichi top-5 (top-3) days; days at #1 | 11 (9), 11 (7) | 13 (10), 13 (11); 6 | 10 (8); 1 |
  | empty top-10 reasons; Picks with an empty reason | 1, 0; 4, 3 | 0, 0; 4, 1 | 0; 0 |
  | never-eaten top-5 slots | 53 / 52 | 46 / 45 | 58 |
  | elapsed / weekday / timing-only flags | 51/79/9, 44/82/11 | 10/74/8, 15/79/11 | 16 / 94 / 9 |
  | output tokens / latency, mean | 776 / 9.8s, 942 / 11.8s | 841 / 10.4s, 918 / 11.1s | 1045 / 12.4s |

  Against the checklist:

  - **Tag reach of a too-soon Rejection: works.** 10-16, the day after
    Aji was rejected "sushi too recent": Aji is out of the top 10 (v10: #1
    both runs, "the sushi staple when Ninja is too soon"). 10-19, the day
    Aji was rejected "sushi too recent" after Sunday's Ninja: Aji #9,
    "sushi came yesterday and two in a row is too much" (v10: #1 both runs).
    Aji's one #1 is 10-12, a Monday with Ninja closed, which is the
    Household's actual Aji pattern. Residue: 10-08 Aji #2 the night after
    Ninja ("sushi the night before argues for spacing; still the household
    staple") and 10-21 #4 "the sushi itch without repeating Ninja".
  - **No empty reasons.** 10-21 Leftovers is #10 "Only if something is
    left from the weekend" (v10: #32, blank).
  - **No rule quoted and ranked against**, since there are none; the two
    Household rules are applied the right way round (Quiche #10 on 10-10,
    "Below their stated minimum gap"). One quoted-and-ignored remains:
    10-20 Thai #5 "but they had it last Tuesday".
  - **Rarities not recovered**: Mollie Stone's #12 on 10-10, West Coast
    Cafe #15 on 10-16, reasons "Occasional grocery-store dinner", "An
    occasional Italian dinner out". Not a policy, but the one weighing
    sentence left in the rationale rules — "a row with nothing but timing
    to say belongs low" — is what sinks an Option whose only case is that
    it is due. v9 had them #2–3 on cadence alone.
  - **Flags**: elapsed and timing-only hold; weekday claims rise 79 → 94.
    With the strict test gone the model cites counts freely, mostly true
    ("Sunday is quiche's strongest night by far": Sun 6 of 14; "All three
    visits were Mondays") and sometimes thin ("Thursday is one of its
    regular nights": Mazra Thu 3 of 14).
  - **Floor**: hit@5 13 against Score's 8; mean rank 5.5 is the best of
    any run, median 3. hit@3 drops to 10: four #2–3 Picks slid to #4–5
    (10-12, 10-13, 10-17) and 10-18 Ninja went #2 → #8 at 4 of 6 ("Sushi
    is ordinary for them at this spacing, but Wednesday-heavy and eaten
    midweek") — the noise day again.

  What the read shows beyond the checklist:

  - The text is the most concrete yet and leads with the Household's own
    words: "order a medium and 1 roti, since the large went uneaten",
    "Jen asked for no more buns", "Sous vide can wait in the bath until
    Jen and Helen get in" (10-09, a late-return Day note), "Jen cooks
    these when she has the ingredients set, which suits an evening she is
    running" (10-10, "jen handling").
  - **Never-eaten slots rise to 58** because a good note now lifts an
    Option regardless of how often it is chosen: Tadu Ethiopian ("the
    Mission Bay delivery was much better", 0 eats in the window) is in the
    top 5 on 6 days and #1 on 10-26; Hungryroot 6 days, with its paused
    state read on some days ("it was paused lately") and not others
    (10-10 #1). Chicken and Rice holds 15. This is the "lead with what
    the chips cannot show" rule doing exactly what it says.
  - **Output is 14% longer and 1.3s slower.** Weak picks were asked for
    three to six words; the model wrote eight-to-twelve-word sentences
    with full stops. Speed is output tokens, so this is worth a tighter
    tail instruction or accepting.

  Open for the user: whether to drop "a row with nothing but timing to
  say belongs low" (it is the last ordering rule in the text, and it costs
  the rarities), whether the note-led lift on never-eaten Options is the
  rut-breaking the product wants or a false positive, and the tail length.
- 2026-10-28: user's call on the three: rarities sinking is fine, the
  note-led lift needs real usage to judge, the 1.3s is fine. **v11 on 40
  new days**, 2026-08-14 .. 2026-10-05, sampled across weekdays from a
  90-day window with the 20 v9/v10 days excluded (`--exclude=`, added to
  the harness for this). Saved as
  `scripts/backtest-runs/ai-search-v11-opus-5-5-pithy-40more.{json,log}`
  with the Score baseline on the same days, `score-baseline-40more`.
  39 scorable (09-25 was Panda Express, not in the Catalog). Catalog
  drift is larger here than on the recent 20: Ninja's reopening and the
  Aji Interval change both fall inside the window.

  | 40 new days, 39 scored | v11 Opus | Score |
  | --- | --- | --- |
  | hit@3 / hit@5 / hit@10 | 23 / 26 / 28 (59 / 67 / 72%) | 7 / 10 / 21 |
  | mean / median rank | 7.9 / 3 | — |
  | too-soon days | 3 | 1 |
  | never-eaten top-5 slots | 24/195 | 56/195 |
  | empty top-10 reasons | 0 | — |
  | elapsed / weekday / timing-only flags | 35 / 177 / 17 | — |

  **What reads well, day after day.** Every swim Tuesday is a top-5 hit,
  six of six, with the reason taken from the Household's own words
  ("saved for Tuesday swim night on Saturday", 09-22 #1). Mazra 4 of 4.
  Leftovers on its trigger: 09-19 #3 "Thursday's quiche went mostly
  uneaten and last night's roti order was too big" (eaten), 10-04 #4
  "Large pizza went largely uneaten Friday". Stock and rules are read
  right: Quiche "if Jen has some on hand" / "there was none in the house
  on Thursday" / "a two-pack was bought yesterday with a mid-October
  best-by" (09-17 #1, eaten); Hungryroot "by their own rule" Sat–Mon;
  Local Kitchens "they turned it down twice as too soon, but that
  objection no longer holds". Orders carried into the line: "order extra
  brown rice, since Helen eats it over the fried rice", "no tomato or
  onion for Helen, no onion for Jen", "order greens, not sambusas". The
  tail is tighter than on the 20 days (five to eight words), and only 24
  of 195 top-5 slots go to Options never eaten in the window.

  **The misses are mostly the long tail no ranker gets**: Frozen food
  (08-30, 09-12), Tomato Salad, No Shared Dinner (09-27), Roosters and
  Kukje on their first visit, Lotus Falafel after 189 days, Hungryroot
  (10-05, #22, after weeks of "don't have"). Eight of the thirteen.

  **Two things persist, both the "due" reflex, and v11 did not touch
  them:**
  - **Aji Ichi is #1 on 13 of 39 days and was eaten on 2** (both Mondays,
    which it also ranks #1 and gets). The other eleven are Saturdays,
    Thursdays and Wednesdays on "Saturday is its second-strongest night"
    (Sat 6 of about 24) and "its usual stretch has run over" — in this
    window Aji's current-run Interval is still 10–14, and the model
    writes "Ninja is now preferred" in the same breath and ranks Aji
    above it anyway (08-28, 09-03, 09-26: Ninja eaten, Aji #1). The fact
    the snapshot does not carry is how the two compare: Ninja 8 eats in
    the window, Aji 2.
  - **Weekday claims on counts of one or two** (4.4 a day): "Thursday
    fits its midweek habit" (Mazra Thu 2), "Saturday is its strongest
    night" (Chicken and Rice Sat 2 of 5), Chili's #8 because "their one
    visit fell on a Sunday". Dropping the strict test brought these back.

  **One thing the Tag reach changed that the Household's own behaviour
  contradicts.** Twice in the window the Household rejected Aji as "sushi
  too recent" and ate Ninja the next day (09-19 → 09-20, and 10-15 →
  10-18 on the first 20). The model, reading the Rejection against the
  Tag as the glossary now says, puts Ninja #11 on 09-20 ("sushi was turned
  down as too recent yesterday"). The words say sushi; the Pick says the
  Household meant Aji. Three Ninja nights at 4–6 days are top-5 misses
  (08-20 #19, 09-03 #8, 09-20 #11) against five hits. Whether to keep the
  Tag reading as the general rule and let the Household's Rejection
  wording catch up, or not, is a product question, not a prompt one.

  **Small text things.** "once called too plain" is attached to Chicken
  and Rice on ten of the forty days: one old note has become the
  Option's epithet. Of the 35 elapsed-time flags, about a third are
  "October" / "mid-October" — a best-by date, which the flag's regex
  mistakes for elapsed time; the rest are "last night" / "just had" on
  tail rows explaining a low rank.
