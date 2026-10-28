# 02 — Candidate changes, to be decided from the backtest

Status: needs-info
Type: AFK

Waiting on issue 01's results. This is the context a future agent should have
when reading them — what was proposed, why, and what evidence each candidate
needs — not a list of work to do. The decision belongs to whoever has the
backtest output and a more nuanced understanding than the 2026-10-28 session.
Claude and Strata may need different answers.

## Parent

[Spec: Backtest the AI ranking, then decide](../PRD.md)

## Candidates

1. **Prompt v10: the rationale rule.** CONTEXT.md's **AI rationale** entry
   now says a strong pick's rationale leads with what the chips cannot show,
   and timing is a clause at most. Both prompts (`lib/ai-search.ts`,
   `lib/prepared-note.ts`) still invite cadence talk — the shared rule text
   says "the Option's own interval is the useful fact". Evidence to look for:
   how many top-10 rows the "timing-only" flag catches in the v9 baseline, per
   model.

2. **Prompt v10: the weekday is not the default lens.** The brief instruction
   ("open on the evening's strongest signal — Day note, weekday habit, or the
   last few days") sends Strata looking for a weekday story on every
   note-less evening, and the `DAY_OF_WEEK_RHYTHM` bullet gives no sense of
   how rare a real weekday habit is. Proposed wording: the signal is what kind
   of evening it is; most Options have no weekday habit, expect to find few.
   Evidence: the weekday-claim flag against the counts, per model. ADR-0012
   rules out a computed habit label; reopen that only if wording plainly
   fails.

3. **Prompt v10: Rejection reasons widened.** The prompt distinguishes a
   standing dislike from a one-off (`lib/ai-search.ts:685-688`); CONTEXT.md's
   **Rejection** entry now also names standing facts and fading state, and
   allows a conditional rationale for stock-dependent Home meals. Evidence:
   how often a stock misread (Quiche, Hungryroot, Quesadilla, Leftovers) costs
   a hit in the baseline. Do not add a "newest supersedes" rule: the richest
   reasons are the oldest.

4. **A bucketed Prepared note.** Strata first sorts every candidate into
   ready / too soon / not on hand / off its weekday / nothing to say, then
   orders within and writes prose. Attacks run-to-run inconsistency in a weak
   model and gives the tail its "why" as the bucket name. Free to test; only
   worth it against a baseline. Not for AI search, where time matters.

5. **The stale Interval.** `intervalDays` is the median gap over the whole
   history (`lib/snapshot.ts:476`). Aji Ichi: 6 all-time, 14–21 recently.
   Claude quoted the 6 and ranked it #1. Evidence: does the baseline show
   drifted Options ranked high on their stale Interval? If it needs fixing,
   prefer a definition without a tuning constant ("last six gaps" was
   proposed and declined for that reason); CONTEXT.md's **Interval** says
   "usual", which should mean the current rhythm.

6. **Claude's tail is catalog-id order** in `pithy` mode. Rows past the
   rationales fall out in id order. Not a defect if the tail's order does not
   matter (PRD), but the backtest should score Claude on top-N only.

## Observations that did not become candidates

- Strata's briefs: one came in at 30 words against a 40–70 range.
- The Societea "not top 3" check was arguably wrong: the swim places rotate
  (Taqueria 10-06, Thai 10-13, Societea 10-20) and Strata's Taqueria / Thai /
  Societea order followed that rotation. Dropped with the other checks.
- Whether Strata should do a smaller job (brief + top N) was considered and
  not pursued: time does not matter for a Prepared note, and the Household
  wants the whole list ranked through the AI lens.
