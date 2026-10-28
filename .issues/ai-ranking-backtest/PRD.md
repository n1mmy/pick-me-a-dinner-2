# Spec: Backtest the AI ranking, then decide

Status: needs-triage

The understanding reached in a grilling session on 2026-10-28, after reading
the prompt-v9 round (commit 96f14c7, ADR-0012). It records what was settled,
what was deliberately left open, and why. Issue 01 is the only work decided;
issue 02 holds the candidate changes for whoever has the backtest results.

## What the AI ranking is for

- The product is the **top 3–10** of the list plus what the prose says. The
  top rows are picks the Household would plausibly make tonight; each
  rationale tells them something the Recency chip and Tag chips cannot.
- Every candidate is still ranked and displayed. The relative order of the
  tail does not matter. Tail prose is not important, but it is nice to get a
  sense of why a row sits where it does.
- Generation time matters for AI search (10s vs 30s vs 90s is a real UX
  difference — that is what `pithy` mode is for). It does not matter for a
  Prepared note (2 min vs 10 min vs 30 min makes no difference).

## What the v9 round showed (the structural reading)

Measured on four hand-picked rank checks over three evenings, v9 improved
(5/8 vs 4/8, two Strata runs each). Those checks could not see the things that
actually got worse:

- **Rationales turned into cadence talk.** Cadence vocabulary ("inside its
  stretch", "not due", "cadence", "interval") went from 2–8 occurrences per
  Strata note in v8 to 17–39 in v9. The household-sourced content ("Jen said no
  more buns", "Mission Bay delivery was much better") receded. Cause: the
  timing facts gave every row a cheap true sentence, and every row must carry
  prose.
- **Weekday habits read into flat counts.** Strata reads the counts correctly
  ("Ninja Sushi Thursday 4", "Taqueria Friday 2/14 but Tuesday dominant 7") and
  then bends them, because the brief instruction tells it to open on the
  evening's strongest signal — Day note, else *weekday habit* — so with no Day
  note it goes looking for a weekday story. A framing effect, not arithmetic;
  Claude shows a milder version. In this Household real weekday habits are
  rare (Societea 10 of 12 Tuesdays, Local Kitchens Monday-only, the swim
  Tuesdays, Atlas leaning Friday); nearly everything else is flat.
- **Claude anchored on a stale Interval.** Aji Ichi's whole-history median gap
  is 6 days (a spring run); the Household moved to Ninja in July ("now that
  Ninja is reopen, ninja is preferred") and the recent gaps are 14–21. Claude
  ranked it #1 on Thursday ("normally every six days and well overdue") and #2
  on Friday, with the preferred Ninja below it. Not in the eval set at all.
- **Rejection reasons are two kinds.** Across every Option's series: *state*
  reasons ("none left", "no box this week", "too recent") and *standing*
  reasons about how the Option works ("comes in 2-packs from Costco", "Jen
  cooks these only when she has ingredients set", "Spiral is for Sundays when
  Aji Ichi is closed"). The standing ones are mostly from May–June and are
  richer than anything after them, so "newest wins" would be wrong. Claude's
  Quiche #4 on Friday came from reading an older state reason past a later Log
  entry and a later "none left".
- **The eval had no ground truth.** Four checks, three undecided evenings, two
  runs: within noise. Claude's tail is in catalog-id order (rows 15–36 on
  Tuesday), so only top-N checks mean anything for Claude.

## Settled

- **Evaluate against reality.** A backtest over recent decided days: build the
  snapshot as the Household would have seen it that day, generate, and score
  against what they actually ate and what they rejected as too soon. Issue 01.
  Both models are backtested — Claude may behave differently from Strata, and
  that may change what is decided. Claude runs are billed: ask first, with the
  call count.
- **The four hand-picked checks are dropped.** Their evenings are undecided,
  so the backtest cannot include them; the backtest is the score.
- **The timing facts stay** (ADR-0012). They are right for ordering and wrong
  as rationale material; the second is a prose rule, not a snapshot change.
- **A rationale leads with what the chips cannot show**; timing qualifies a
  reason, never is one. Written into CONTEXT.md's **AI rationale** entry. The
  prompts do not say this yet — that is a candidate change in issue 02.
- **The weekday is not the default lens.** The evening's signal is what kind
  of evening it is (Day note, swim night, weekend vs weeknight, the last few
  days); a weekday habit is one thing an Option may have, and few do. A prompt
  change, held in issue 02; no habit label in the snapshot.
- **Rejection reasons are evidence, with no supersession rule.** A reason may
  be a standing dislike, a standing fact, a passing state that fades, or a
  one-off; the Household is not obliged to keep state current, and a
  stock-dependent Home meal may be ranked on a condition ("if there is one in
  the freezer"). Written into CONTEXT.md's **Rejection** entry.
- **The brief is judged by consistency and a hand-read**, not a hit rate: the
  Options it names as standouts sit in that note's top 3; when the day has a
  Day note the brief reflects it; a sample of briefs per prompt version is
  read by a person.
- **A bucketed variant is worth a free test** (Strata first sorts every
  candidate into ready / too soon / not on hand / off its weekday / nothing to
  say, then orders and writes). A candidate, not a commitment.

## Deliberately open

- **What to change in the prompts, and whether per model.** Decided from the
  backtest results by whoever has them, not from the current understanding.
  Issue 02 keeps the candidates.
- **The stale Interval.** A known defect; the backtest shows its size. If it
  needs fixing, prefer a definition without a tuning constant.
- **Whether Strata should do a smaller job.** Nothing in the round says so;
  revisit only if the backtest says Strata's ranking is not worth loading.
