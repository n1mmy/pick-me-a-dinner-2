# Timing facts in the snapshot, not a sort key

_Amended 2026-10-28, twice. First the Interval became the median gap of the
"current run" — the gaps since the longest break — because the all-time
median kept an Option "due" every six days for months after its habit had
slowed to three weeks (`.issues/ai-ranking-backtest/issues/02`). That caught
an abrupt change and missed a gradual one: an Option whose gaps had drifted
from ten days to three weeks with no single long break still read as due from
day eleven and led the ranking on a third of the evenings of a 40-day run
(`issues/03`). The second amendment, the same day, withdrew the current-run
definition: the Interval is the plain median of every gap again, and each
candidate and Tag also carries its **last three gaps, newest first**
(`recentGaps`). Two facts, each simple: the habit over the whole history and
the pace as it stands. Their difference is the Drift, and reading it is the
model's job (`issues/04`)._

_Amended a third time, 2026-10-28: the Interval is gone from the snapshot
and the glossary. With the plain median beside the gaps, the model named the
slowdown and ranked on the median anyway: "a slower recent pace that is due
again now" at nine days since, against gaps of 21 (`issues/04`, the v12
read). In every form a median gave the model a pace to be due against that
the Household no longer kept. The only timing summary now is the **last
four gaps, newest first** (`recentGaps`), on each candidate and each Tag,
and the prompt says that falling short of the last gap is ordinary and a
long gap among them is a break they took, not a pace to catch up on._

_Amended a fourth time, 2026-10-29: the weekday counts are gone from the
snapshot, the Interval's story one field over. They gave every row a cheap
true sentence, and the model read habits into flat counts — four Options
called a Wednesday, Thursday, Friday or Saturday regular on four different
days (`issues/02`), and the claim rate up again on the 40-day run after a
strict weekday test came and went (`issues/03`). Every Log date carries its
weekday, so a real habit is still there to find (`issues/10`)._

ADR-0005 withheld pre-computed recency from the model snapshot, so the model
would reason about habits instead of re-sorting on a ready-made key, and
ADR-0011 carried that over to Prepared notes. We now put **timing facts** in the
snapshot shared by AI search and Prepared notes. Each candidate carries how many
days it was eaten, days since its last eat, its last four gaps newest first
(from two eats up). A `tags` block carries the same for every Tag. This amends ADR-0005's withheld-recency
consequence and ADR-0011's inheritance of it. The rest of ADR-0005 stands: the
model still reasons over the dated history, and nothing in the snapshot
combines the facts into a sort key.

The case for it is consistency, not arithmetic. The local model's reasoning traces
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
  every Prepared note.
- Timing is counted the way **Recency** is: Log entries of active Options on or
  before the anchor day. A Pick already made for the anchor day counts toward
  its Tags.
