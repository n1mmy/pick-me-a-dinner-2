# 02 — Prompt v10 and harness fixes, proposed from the backtest

Status: needs-triage
Type: AFK

Issue 01's v9 baseline has been run for all three rankers over the same 20
decided days (2026-10-02 .. 2026-10-26, `scripts/backtest-runs/`). This file
is the read of those results and the changes proposed from them, with the
evidence for each. Nothing here is implemented; the user decides what goes
into prompt v10, and whether per model.

## Parent

[Spec: Backtest the AI ranking, then decide](../PRD.md)

## The read

One run each, 20 days; a difference of one or two days is noise.

| ranker | hit@3 | hit@5 | hit@10 | median rank | too-soon days | top-5 slots on Options never eaten in the window |
| --- | --- | --- | --- | --- | --- | --- |
| Opus 5.5, pithy | 13/20 | 14/20 | 15/20 | 3 | 2 | 53/100 |
| Sonnet 5.5, pithy | 7/20 | 11/20 | 13/20 | 4 | 4 | 41/100 |
| Strata v9 (see the numbering bug below) | 11/20 | 12/20 | 15/20 | 2 | 1 | 55/100 |
| deterministic Score, same days (`scripts/backtest-baseline.ts`) | 5/20 | 8/20 | 12/20 | 8 | — | most |

What was eaten, 20 days: Ninja Sushi 4, Leftovers 3, Atlas 2, Big Mouth 2,
Mazra 2, Mollie Stone's 2, and one each of Local Kitchens, Quiche, Societea,
Taqueria, Thai, West Coast Cafe. All three rankers get the swim Tuesdays, the
Mazra nights, the Monday Local Kitchens and the restocked Quiche. The misses
and the false positives are structural and shared:

1. **The Pick was under its Interval on 8 of 20 days** (Ninja at 4 of 6,
   Atlas 9 of 13, Thai 14 of 19, Mazra 13 of 15, Big Mouth 7 of 22, Leftovers
   4 of 17 and 5 of 15, Mollie 16 of 49). The Interval is a median, so half
   the Household's real gaps are shorter by construction; the prompt teaches
   "has come round at 8–9 days for a weekly Option", i.e. wait until it is
   past. Opus gave three of its seven misses an *empty* reason — filed under
   pithy mode's "obviously bad pick (just eaten)": Ninja on 10-18 (#31, four
   days after Ninja), Big Mouth 10-15 (#34), Leftovers 10-21 (#29). The
   Household's own line, from its too-soon Rejections and early eats in the
   window: rejected at 37–47% of the Interval (Quiche 7/15, Mazra 6/15, Thai
   7/19), eaten at 67–87% (Ninja 4/6, Atlas 9/13, Thai 14/19, Mazra 13/15).
2. **Aji Ichi is the biggest false positive.** Top 5 on 11 Opus days, 15
   Sonnet days, 8 Strata days; eaten zero times; three "sushi too recent"
   Rejections in the window (09-19, 10-15, 10-19 — the last with Aji at
   Opus #2 / Sonnet #1). Its all-time Interval is 6 (the spring run: gaps
   4 3 7 3 9 …); its gaps since Ninja reopened are 6 14 21 21, and its three
   eats since then are all Mondays, the day Ninja is closed. Both Claude
   models quote "normally every six days" and rank it #1–2 on Thursdays,
   Fridays and a Saturday. Candidate 5 confirmed, and larger than expected.
3. **"Due" rarities fill the top 5.** Chicken and Rice: 13 Opus top-5 days,
   5 eats in eight months, never eaten in the window. The never-tried trio
   (bb.q, Sofra, BJ's): 19 Opus / 29 Sonnet / 30 Strata top-10 rows; bb.q in
   Strata's top 5 on 16 of 20 days. Hungryroot: Sonnet #1 on 10-18, 10-25
   and 10-26 with "check a box is in", after "no box this week" (10-10) and
   "dont have" (10-19) were already in its snapshot.
4. **Stock and standing rules were ignored on 10-11.** Quiche #1 on all
   three rankers, seven days after the 10-04 Quiche, against the Household's
   own "minimum re-suggest time 1.5 weeks" (Rejection 09-23), and with both
   quiches of the 09-16 pack already eaten (09-17, 10-04). Rejected that
   night: "Too soon. And no quiche currently".
5. **Leftovers has no cadence; it has a trigger.** Four of its last five
   eats were the day after a restaurant (Thai→09-30, West Coast Cafe→10-17,
   Societea→10-21, Ninja→10-26). Every ranker ranks it on "its two-week
   cadence" — #2 on quiet Saturdays, #29–#32 on the nights it was eaten.
6. **A contradicted standing reason.** "sonia doesnt like atlas pizza much
   any more. less frequent" (08-26) is quoted against Atlas on 10-11 (Opus
   #12: "Sonia cooling on Atlas"); the Log since that reason has Atlas four
   times in six weeks, more often than before it.
7. **Weekday claims on flat counts, every model.** Top-10 rows with a weekday
   claim: Opus 79, Sonnet 102, Strata 150. Mazra (Wed 5, Thu 3,
   Fri 3, Sat 3 of 15) is called a Wednesday, Thursday, Friday and Saturday
   regular on four different days; West Coast Cafe "Thursday Italian" (2 of
   2) was then eaten on a Friday; Chicken and Rice "Saturday is its most
   common day" (2 of 5). The real habits in this Household hold most of an
   Option's eats: Societea Tue 9/12, Taqueria Tue 7/14, Thai Tue 6/11, Local
   Kitchens Mon 3/3, Hungryroot Sun+Mon 11/14, Aji Mon 3/3 since July.

Text, per model:

- **Opus** is the best writer and the best ranker: household detail in 3–8
  of each day's top-10 rows ("one roti and a medium pizza", "the salmon plate
  for Jen", "Jen cooks these only when the ingredients are on hand"), one
  name-opening row in 200. Faults: cadence-only rows (81 of 200 top-10 rows
  carry cadence vocabulary; "Comes round roughly monthly and that stretch is
  up" for Chicken and Rice on 13 days); a blank reason at #2 (Spiral, 10-10 —
  a pithy "obviously bad" row ranked second); one voice slip ("You often have
  it yourself on no-Jen nights"); 40 of its 51 elapsed-time suspects are tail
  rows saying "just had", which pithy mode asked to leave empty.
- **Sonnet** opens 41 of 200 top-10 rows with the Option's name despite the
  explicit ban, quotes counts that refute its own claim ("a Thursday-leaning
  spot (3 of 13 eats)"), and leans on cadence in 126 of 200 rows. It loses to
  Opus on every ordering measure. Not worth tuning for; keep Opus.
- **Strata** writes in the snapshot's schema: "the helen-fried-chicken tag is
  due", "sonia-rice tags that are ready", "the Mexican tag has come round on
  its usual interval", "Nine Tuesdays make this"; 159 of 200 top-10 rows are
  cadence talk. Its briefs open on the weekday nearly every note-less night,
  as the brief instruction tells them to. It can read "due" the way proposal
  2 asks, though: on 10-25 it put Ninja #1 at 7 days against an Interval of
  6 — "their own sushi cautions point to close repeats, not this established
  frequency" — where Opus had it #10 and Sonnet #34. It also drops a row or
  two on some days (10-09, 10-11, 10-25: Roma Deli), plain omissions from
  the tail.
- **Strata row numbering is broken on 2 of 20 days** (the last four days
  are clean). On 10-02 all 37 rows
  came out in catalog order 1..37: the reasoning trace planned "1 27 Quiche …
  4 2 Atlas" (rank, then number) and the answer wrote the rank where the
  number belongs, so Aji (#1 in the catalog) carries Quiche's rationale and
  the scored "Atlas #2" is an accident (Atlas is catalog #2). On 10-14 row 1
  was "1" (Aji) carrying Ninja's rationale, and Ninja — its intended #1 and
  the actual Pick — was dropped by the parser as a duplicate number
  (`parseRankingText` skips repeats and unknown numbers silently). Traces
  for 10-09 and 10-11 show the same plan-then-emit step done right, so this
  is intermittent. Scored as intended by the traces (Atlas #4 on 10-02,
  Ninja #1 on 10-14), Strata would be 11/20, 13/20, 16/20.

## Proposals

Ordering — both prompts unless marked.

1. **Interval = the current run** (candidate 5). Define `intervalDays` as the
   median of the gaps *after the Option's longest gap*, falling back to the
   all-time median when the longest gap is the latest one (no run yet). No
   tuning constant; `CONTEXT.md`'s "usual" becomes the current rhythm. On the
   real data: Aji 6→18, Ninja 6→6, Mazra 15→14, Atlas 12→14, Quiche 15→16,
   Taqueria 14→15, Thai 19→17, Big Mouth 20→18, Leftovers 13→14, Societea
   20→28, Chicken and Rice 36→22. The "recent half of the gaps" median does
   *not* fix Aji (still 6); the single last gap does (21) but is one sample.
   Lower-risk alternative: keep the median and add `lastGapDays` as a fact.
   Recommend the redefinition, because the number also feeds the prose.
2. **Re-teach "due"** (new; the ordering half of candidate 1). Replace the
   Cadence bullet's "has come round at 8–9 days" with: an Option is in play
   from about two-thirds of its Interval, a quick repeat below about half,
   and between the two the evening decides; the Interval is a median, so
   half of this Household's own gaps were shorter. Add that `eaten` is how
   much they choose it: a staple (twenty eats, a short Interval) at
   two-thirds of its Interval outranks a rarity (five eats in eight months)
   whose Interval is "up" — being due is not being wanted. Pithy mode: drop
   "just eaten" from the "obviously bad pick" examples; say "eaten yesterday
   or the day before".
3. **State, stock, rules and triggers** (candidate 3, confirmed). A state
   reason ("none left", "no box", "paused") newer than the Option's last eat
   holds until a Log entry or a later note says otherwise: rank it low and
   say the condition. A reason that states a rule ("minimum 1.5 weeks",
   "less frequent") is a standing rule — apply it. When the Log since a
   reason contradicts it (Atlas), the Log wins. Some Home meals have no
   rhythm and follow a trigger — Leftovers follows a restaurant night, a box
   meal follows a delivery — rank them on the trigger, conditionally, not on
   a cadence.
4. **Cap novelty** (new). "Never tried can itself be a reason to rank it
   higher" currently lifts bb.q and Sofra into the top 5. Novelty puts an
   untried Option in the visible middle, not above a staple in its window;
   an Option that has sat untried through months of decisions is one the
   Household keeps passing over.
5. **The weekday test** (candidate 2, confirmed, made concrete). A weekday
   habit means one weekday holds most of the Option's dinners and more than
   a couple of them, or two adjacent weekdays hold nearly all; the commonest
   day of a spread across four or five weekdays is not a habit — say nothing
   about the weekday there. Expect to find few. The brief opens on what kind
   of evening it is (Day note, swim night, weekend or weeknight, the last few
   days), not "the weekday habit".

Text.

6. **The rationale rule into both prompts** (candidate 1). A strong pick
   leads with what the chips cannot show — a Note, a standing reason, how
   the Option fits the shape of the evening, a habit the counts bear out —
   and timing is one clause at most. Replace "the Option's own interval is
   the useful fact" and lead the examples with note- and evening-shaped
   ones; a row with nothing but timing to say belongs to the tail and says
   little. Third person throughout.
7. **Strata vocabulary.** Never write "tag", "interval", "cadence", "rhythm",
   "spacing" or a field name to the Household; say the food, the person, the
   night. Numbers from the counts stay out of the prose.

Strata only.

8. **Name column and verifying parser.** Ask Strata for
   `<number>|<name>|<rationale>`; when the name does not match the number's
   Option, resolve the row by name and flag it. Strata is free, so the extra
   tokens cost nothing; this closes the 10-02 and 10-14 defect, which both
   created a false hit and lost a true #1.
9. **Ranking first, then the brief.** Written after the rows, the brief can
   only summarise what is there; today it names Options at #4–#12 (10-08
   Big Mouth #7, 10-10 Quiche #4, 10-12 Leftovers #4, 10-13 Little
   Vietnamese #4, 10-16 Atlas #12, 10-21 Sofra #6). Keep the marker between
   the two.
10. **The bucketed variant** (candidate 4) stays worth a free A/B — after 8
    and 9, against this baseline.

Harness, before the v10 run, so it measures right.

11. `namedInBrief`'s first-word rule matched "Chicken" in "bb.q Chicken San
    Bruno" to Chicken and Rice (10-07, 10-14, 10-15, 10-16) and "pasta" in
    "Italian pasta habit" to Pasta (10-08): "brief names outside top 3" is
    11 days on paper and about 6 in fact (the six listed under proposal 9).
    Require the full name, or a word that appears in no other candidate's
    name. The Day-note check ignores words under four letters, so "No Jen"
    (10-20) reads as a brief silent on the Day note when it opened on it.
12. Count elapsed-time suspects over the top 10 like the other flags.
13. Add to the record and the aggregate: top-5 slots on Options not eaten in
    the window; the Pick's `daysSinceLast` over `intervalDays`; a top-10 row
    with an empty reason; a ranking in catalog order; a name/number mismatch
    (after 8).
14. Fold the deterministic Score in as a free baseline ranker
    (`scripts/backtest-baseline.ts` is the scratch version).
15. A second Opus run on the same days before any change gives the noise
    floor: 20 billed calls, about 20k cache-write tokens each. Strata reruns
    are free.

Expected effect, honestly (revised after the noise floor, below): under v9
Opus lands on 14 or 16 at hit@5 depending on the draw, so a v10 run at 16
proves nothing by itself. The reachable ordering gain is a floor, not a
count: the two Ninja nights (10-18 at two-thirds of its Interval, 10-25 just
past it) become hits in every run, and 10-11 moves into the top 5 once the
Quiche rule holds. The burger seven days after a burger, the two Leftovers
nights and the Monday Mollie Stone's stay misses. The visible win is the top
5: roughly half of its slots today go to Options the Household did not eat
once in four weeks, and that measure moved by one slot between two identical
runs. The v10 acceptance test, one Opus run of 20 calls, reads the stable
measures first:

- top-5 slots on Options never eaten in the window: from 52–53 to below 35;
- too-soon days: from 2 to 0 (Quiche off the 10-11 top 5, Aji off 10-19's);
- Aji Ichi's top-5 days: from 11 to 3 or fewer;
- no day whose Pick carries an empty reason (v9: 3–4 days);
- hit@5 at least 16 with 10-18 and 10-25 both in the top 5; a gain under 3
  days on hit@5 alone is not readable from one run;
- elapsed-time flags compared only over the brief and top 10 (the harness now
  counts them that way).

## Observations that did not become candidates

- The Societea "not top 3" check was arguably wrong: the swim places rotate
  (Taqueria 10-06, Thai 10-13, Societea 10-20) and every ranker's Tuesday
  order followed that rotation. Dropped with the other hand checks.
- Whether Strata should do a smaller job (brief + top N): nothing in the
  baseline says so — its hit rates sit between Opus and Sonnet — and the
  Household wants the whole list ranked through the AI lens.
- Claude's tail is catalog-id order in pithy mode; a rank past about #15 is
  "not considered", not a measurement. Score Claude on top-N only.

## Comments

- 2026-10-28: proposal 15 done. A second Opus 5.5 pithy run with v9
  unchanged, on the same 20 days and the same dev DB (every day's
  candidate count matches run 1), saved as
  `scripts/backtest-runs/ai-search-opus-5-5-pithy-run2.{json,log}`.

  | Opus 5.5 pithy, v9 | run 1 | run 2 |
  | --- | --- | --- |
  | hit@3 | 13/20 | 14/20 |
  | hit@5 | 14/20 | 16/20 |
  | hit@10 | 15/20 | 17/20 |
  | mean / median rank | 8.4 / 3 | 6.7 / 2 |
  | too-soon days | 2 (10-11, 10-19) | 2 (same days) |
  | elapsed / weekday / timing-only flags | 51 / 79 / 9 | 44 / 82 / 11 |
  | top-5 slots on Options never eaten in the window | 53/100 | 52/100 |

  Flips: hit@3 on 1 day (10-25, Ninja #10 → #1), hit@5 on 2 (10-25, and
  10-18, Ninja #31 with an empty reason → #5 "slightly early"), all in run
  2's favour. On the 14 other top-5 days the Pick moves at most one place,
  and the misses stay misses (10-11 #12/#8, 10-15 #34/#31, 10-21 #29/#30,
  10-26 #20/#27). Top 5: on average 3.8 of run 2's five are in
  run 1's (min 2, on 10-25; 5 on 5 days, 4 on 7, 3 on 7). Same #1 on 15
  of 20 days. Top-5 occupancy is stable: Chicken and Rice 13/14, Aji Ichi
  11/11, bb.q 6/6, Hungryroot 4/4, Quiche 6/5, Ninja 3/5.

  **Noise floor:** two identical v9 runs differ by 1 day at hit@3 and 2 at
  hit@5; a v10 change must move more than that to be read as real. This
  bites the "expected effect" above: the two Ninja nights that were the
  reachable ordering gain are exactly the days that flipped by noise, so
  on Opus a v10 gain of about two days is not readable from one run. The
  never-eaten top-5 slots (53 → 52) and the per-Option occupancy are
  stable, so that measure can carry the v10 read.
- 2026-10-28: proposals 1–9 and 11–14 implemented as prompt v10 (both
  prompts; `AI_SEARCH_PROMPT_VERSION` and `PREPARED_PROMPT_VERSION` are "10").
  1: `intervalOf` in `lib/snapshot.ts`, ADR-0012 amended, `CONTEXT.md`
  Interval rewritten; on the real data Aji 6→18, Ninja 6, Mazra 14, Atlas
  14, Quiche 16, Taqueria 15, Thai 17, Big Mouth 18, Leftovers 14, Societea
  28, Chicken and Rice 22, Hungryroot stays 7 (its longest gap is the latest
  one — the state rule covers it). 2–6: `CADENCE_RHYTHM`,
  `DAY_OF_WEEK_RHYTHM`, `STANDING_REASONS_AND_TRIGGERS`, `NOVELTY_RULE` and
  `RATIONALE_LEAD` in `lib/ai-search.ts`, shared by both prompts; pithy and
  drop modes say "eaten yesterday or the day before". 7: the vocabulary
  paragraph in `buildPreparedSystemPrompt`. 8–9: Strata writes
  `<number>|<name>|<rationale>`, then `=== BRIEF ===`, then the brief;
  `parsePreparedReply` resolves a disagreeing row by name and reports the
  count (`resolvedByName`), and still reads the v9 order and number-only
  rows. 11–13: `scripts/backtest.ts` — brief names by any unique word of a
  name, Day-note words from three letters, every flag over the brief and
  top 10, and new fields: the Pick's since/Interval, empty top-10 reasons,
  catalog-order days, rows resolved by name, never-eaten top-5 slots,
  Pick-under-Interval days and how many were hit@5. 14:
  `scripts/backtest-score.ts`, saved as `score-baseline.{json,log}`: 5/8/12
  of 20, 63/100 never-eaten slots. `scripts/backtest-compare.ts` diffs two
  runs. Under the new Interval the Pick was short of it on 11 of 20 days,
  7 of those above two-thirds. 10 (the bucketed Strata variant) stays open
  as a free A/B after the v10 Strata run.
- 2026-10-28: v10 Opus run: **fails the acceptance test.** One Opus 5.5
  pithy run with prompt v10 on the same 20 days and the same dev DB (every
  day's candidate count matches the v9 runs), saved as
  `scripts/backtest-runs/ai-search-v10-opus-5-5-pithy.{json,log}`.

  | Opus 5.5 pithy | v9 run 1 | v9 run 2 | v10 | target |
  | --- | --- | --- | --- | --- |
  | top-5 slots on Options never eaten in the window | 53/100 | 52/100 | 46/100 | below 35 ✗ |
  | too-soon days | 2 (10-11, 10-19) | 2 (same) | 1 (10-15) | 0 ✗ |
  | Aji Ichi top-5 days (top-3) | 11 (9) | 11 (7) | 13 (10) | 3 or fewer ✗ |
  | days whose Pick has an empty reason | 4 | 3 | 4 | 0 ✗ |
  | hit@3 / hit@5 / hit@10 | 13 / 14 / 15 | 14 / 16 / 17 | 11 / 13 / 15 | hit@5 ≥ 16 ✗ |
  | 10-18 and 10-25 in the top 5 | no / no | yes / yes | yes (#2) / yes (#2) | both ✓ |
  | mean / median rank | 8.4 / 3 | 6.7 / 2 | 8.2 / 2 | |
  | elapsed / weekday / timing-only flags | 51 / 79 / 9 | 44 / 82 / 11 | 10 / 74 / 8 | |
  | empty top-10 reasons | 1 | 0 | 0 | |

  What worked. Both named too-soon targets cleared: Quiche is off the 10-11
  top 5 and Aji is off 10-19's. Both Ninja nights are hits (10-18 #2 at
  4 of 6, "its quick cycle has come round"; 10-25 #2), though under v9 those
  were the noise days. The novelty cap holds: bb.q goes from 6 top-5 days
  to 0, and BJ's and Sofra stay out. Elapsed-time talk drops from 44–51
  flags to 10. More reasons lead with something the chips can't show
  ("the note says get Sonia chips, not nachos", "Helen's burger, no tomato
  or onion"). Leftovers now gets its trigger: 10-17 #4, "depends on a big
  restaurant order, and none came this week".

  What didn't. Three days that were stable hits in both v9 runs became
  misses, which is outside the noise floor:
  - **10-07 Ninja, #2 and #2 → #34 with an empty reason**, at exactly
    its Interval (6 of 6). In pithy mode that means the model treated the
    staple as an "obviously bad pick", and the row doesn't say why. Its
    #2 reason for Aji says "the sushi slot after Ninja is open again".
  - **10-10 Mollie Stone's, #3 and #2 → #7, and 10-16 West Coast Cafe,
    #3 and #3 → #16** ("Italian; Thursday spot"). Both were rarities well
    past their Interval (63 of 34, 141 of 49), so proposal 2's "being due
    is not being wanted" cost two real eats. Chicken and Rice, the rarity
    the rule was aimed at, holds 14 top-5 days and climbs from 5 to 9 top-3
    days, each time on an evening-shaped reason ("an easy sous-vide night
    at home after a run of restaurants"). Proposal 6's lead gives a home
    meal a reason that the cadence used to supply.

  So hit@5 is 13: two gains on noise days, three losses on stable days, a
  net of −1 against run 1 and −3 against run 2. 10-11 didn't come into the
  top 5 either (Atlas #10, "the household's own rule says less often").
  Proposal 3 now counts Sonia's 08-26 "less frequent" as a standing rule,
  even though the Log since contradicts it.

  **Aji Ichi got worse.** Its Interval of 18 is in the snapshot and gets
  quoted ("Aji Ichi's run of about 18 days is up"), but the model now ranks
  it as Ninja's substitute: "with Ninja just had, Aji Ichi is the sushi
  pick" (10-10 #1), "its usual stretch … is up, though Ninja was last night"
  (10-15 #1), and "Rejected yesterday only because sushi was too fresh"
  (10-16 #1). The Household's three "sushi too recent" Rejections are about
  sushi, not Ninja. Aji is #1 on five days (10-10, 10-12, 10-15, 10-16,
  10-17). Never-eaten slots fell 6, which is real against a 1-slot noise
  floor but far short of the target: bb.q (6 → 0) and Spiral (2 → 0) drop
  out and Hungryroot and Minari fall, while Aji (+2), Pasta (4 → 7) and
  Frozen food take their slots.

  The new too-soon day is 10-15: Mazra #3 at 6 of 14, "it sits at half its
  usual stretch". That's below the "quick repeat below about half" line
  from proposal 2, so the model ranked it against the rule it was given.
  The weekday test barely registered: 74 claims against 79–82, including
  Aji "Saturday is its second-strongest day" (Sat 6 of 25).

  Against the deterministic Score (`score-baseline`), v10 Opus still wins
  clearly: 11/13/15 against 5/8/12, and 46 never-eaten slots against 63.
  Next, for the user to decide: a category-level sushi rule (a "sushi too
  recent" Rejection covers every sushi Option; Aji is not Ninja's
  substitute), and whether "due is not wanted" should spare a rarity that's
  well past its Interval and was eaten in the window. Score the Strata v10
  run against this before changing the prompt again.
- 2026-10-28: v10 Opus run 2: **still fails the acceptance test, and
  run 1 overread two days as v10 effects.** Same model, mode, days and DB
  as run 1. Saved as
  `scripts/backtest-runs/ai-search-v10-opus-5-5-pithy-run2.{json,log}`.

  | Opus 5.5 pithy | v9 run 1 | v9 run 2 | v10 run 1 | v10 run 2 | target |
  | --- | --- | --- | --- | --- | --- |
  | top-5 slots on Options never eaten in the window | 53/100 | 52/100 | 46/100 | 45/100 | below 35 ✗ |
  | too-soon days | 2 (10-11, 10-19) | 2 (same) | 1 (10-15) | 3 (10-15, 10-19, 10-20) | 0 ✗ |
  | Aji Ichi top-5 days (top-3) | 11 (9) | 11 (7) | 13 (10) | 13 (11) | 3 or fewer ✗ |
  | days whose Pick has an empty reason | 4 | 3 | 4 | 1 (10-21) | 0 ✗ |
  | hit@3 / hit@5 / hit@10 | 13 / 14 / 15 | 14 / 16 / 17 | 11 / 13 / 15 | 14 / 14 / 17 | hit@5 ≥ 16 ✗ |
  | 10-18 and 10-25 in the top 5 | no / no | yes / yes | yes / yes | yes (#2) / yes (#1) | both ✓ |
  | mean / median rank | 8.4 / 3 | 6.7 / 2 | 8.2 / 2 | 6.5 / 2 | |
  | elapsed / weekday / timing-only flags | 51 / 79 / 9 | 44 / 82 / 11 | 10 / 74 / 8 | 15 / 79 / 11 | |

  Run 1 against run 2: same #1 on 17 of 20 days. Top-5 overlap averages
  3.9 (minimum 3), against 3.8 between the v9 runs. Every flip is in run
  2's favour: hit@3 +3 (10-07, 10-08, 10-17), hit@5 +1 (10-07), hit@10 +2
  (10-07, 10-26). That's slightly wider than the v9 noise floor (1 / 2).

  What this changes in the run 1 read:
  - **10-07 was noise, not "due is not wanted".** Ninja is #2 again ("the
    sushi staple with a roughly weekly beat, now right on cadence"). The
    #34 with an empty reason was a one-off.
  - **10-10 and 10-16 are real losses.** Mollie Stone's is #7 / #9 and
    West Coast Cafe #16 / #18 in both v10 runs, against #3/#2 and #3/#3
    under v9. Proposal 2 costs rarities that are well past their Interval.
  - **The 10-19 fix was noise.** Aji is #1 on 10-19 again, the day the
    Household rejected it as "sushi too recent". Its reason: "the
    standing Monday sushi stop … Sunday's Ninja sits close, but Monday is
    Aji Ichi's night". Only the 10-11 Quiche fix held, in both runs.
  - **New too-soon day 10-20:** Thai Nakorn #3, and the reason states the
    problem itself: "they had it last swim Tuesday". 10-15 Mazra #5 ("lands
    a little early in its usual cycle") repeats run 1's miss.
  - **Aji as Ninja's substitute is stable,** and now explicit: "the go-to
    sushi spot whenever Ninja isn't the pick" (10-15 #1), "the sushi staple
    when Ninja is too soon" (10-16 #1). Aji is #1 on six days (10-10, 10-12,
    10-15, 10-16, 10-17, 10-19). Chicken and Rice rises to 17 top-5 days
    from 14 but drops to 5 top-3 days from 9; Local Kitchens goes 3 → 8.
  - Never-eaten slots, 46 then 45, are the most stable measure across the
    two runs. The v9 → v10 drop of about 7 is real, and far short of 35.

  Pooled v10 hit@5 is 13.5 against v9's 15. The net cost is the two
  rarity days. The Ninja gains fall within v9's own noise. The two open
  questions from run 1 stand, and run 2 makes the sushi rule the larger of
  the two: a "sushi too recent" Rejection covers every sushi Option, and
  Aji isn't Ninja's substitute.
