# Timing facts in the snapshot, not a sort key

ADR-0005 withheld pre-computed recency from the model snapshot, so the model
would reason about habits instead of re-sorting on a ready-made key, and
ADR-0011 carried that over to Prepared notes. We now put **timing facts** in the
snapshot shared by AI search and Prepared notes. Each candidate carries how many
days it was eaten, days since its last eat, its **Interval** (the median gap
between eats, from two eats up), and its eats per weekday. A `tags` block
carries the first three for every Tag. This amends ADR-0005's withheld-recency
consequence and ADR-0011's inheritance of it. The rest of ADR-0005 stands: the
model still reasons over the dated history, and nothing in the snapshot
combines the facts into a sort key.

The case for it is consistency, not arithmetic. Strata's reasoning traces
subtracted dates correctly every time; what varied was *which* facts it worked
out and how it weighed them, so the same Option could land near the top of one
run and near the bottom of the next. The clearest failure was a Tag-level
repeat the model missed while the Option's own numbers pointed the other way,
which is why the facts are per Tag as well as per Option.

## Considered options

- **Prompt only.** Keep withholding the facts and tune wording. Rejected:
  wording fixed the simple case (the last visit on the same weekday) but left
  the inconsistency.
- **Each Option's eat dates grouped on it, nothing computed.** Saves the model
  the lookup, but leaves the judging inconsistent and Tag timing still to be
  assembled across Options.
- **Facts per Option only**, as first proposed. Rejected on the data: the
  clearest failure was Tag-level.
- **Facts per Option and per Tag (chosen)**, with no derived "overdue" flag,
  ratio, or habit label, so the facts stay facts to weigh rather than a key to
  sort by. A future reader should not add a combined "how overdue" number;
  that is the sort key ADR-0005 was right to withhold.

## Consequences

- Measured on a fixed set of evenings with repeated Strata runs, the target
  cases passed more often than before, the known mis-rankings stayed out of
  the top five, and the top five never followed the order of
  days-since-over-Interval. The rationales now name the trade-off ("not quite
  due, but the weekday habit keeps it high"). Some misses remain where the
  model still reads a weekday habit into flat weekday counts.
- Claude AI search passed the same checks. Its rationales lean on cadence, and
  a few still state elapsed time ("they just had it last week"), which the
  rhythm-claim rule forbids.
- The snapshot grows by about 1.7k tokens, on Claude's cached prefix and on
  every Strata note.
- Timing is counted the way **Recency** is: Log entries of active Options on or
  before the anchor day. A Pick already made for the anchor day counts toward
  its Tags.
