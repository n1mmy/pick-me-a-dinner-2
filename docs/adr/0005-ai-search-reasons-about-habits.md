# AI search reasons about habits, not just recency

_Amended by ADR-0012: the snapshot now carries timing facts per Option and per
Tag. It still carries no sort key._

_Amended 2026-10-28: the prompt says what each kind of data in the snapshot is
evidence of — a Log entry, a note, a Rejection, a Day note, a timing fact — and
leaves the weighing to the model. No prompt rule, example, or evaluation target
is written for a named Option. Prompt v10 had carried a weighing rule per
backtest finding, each with an example from this Household's Log; the model
quoted the rules and ranked against them, and the examples read as
instructions rather than patterns to find._

_Amended 2026-10-29 (prompts v16 and v17): the same for the writing. The
rationale rules — a menu of leads, a timing clause after, a ban on elapsed
time in every form, "vary the openings", character budgets — were one rule per
failure seen in some run, and the model wrote to the recipe: lead fact plus
"its pace has come round" on every strong row, the weekday as the lead
whenever nothing else was to hand. The prompt now says what the row shows and
what the line is for, and leaves the writing to the model. Two of the old
rules stay, as one clause each paired with what to do instead: v16, which
stated only what the row shows, restated the days-since number in nearly half
its top-10 rows and opened two thirds of them with the Option's name. The
rhythm-claim rule below is the guardrail's reason._

_Amended 2026-10-29 (prompt v18): each guardrail says what goes in the line's
place, not only what the line must not carry. v17 said the line never states
elapsed time and never opens with the name; a local model at low effort filled
the gap with the number spelled out, and at high effort with nothing, while the
snapshot's own words — pace, gap, tag, codes, names as typed — reached the
screen. Now the timing is written in what the household would notice, the line
opens on the reason, and it is in their words with the snapshot's named once.
The Prepared prompt's sentence quota for its top five becomes a ceiling, so one
decisive reason is not padded to three sentences._

ADR-0004 added AI search as an additive, triggered layer over the
deterministic ranking. In practice it added little: the model was fed the same
pre-digested recency integers the deterministic Score already uses and was
forced to answer in one shot, so it simply re-sorted by recency — mirroring the
default list instead of improving on it. We are reshaping the AI search path so
the model **reasons about the Household's eating history** — its habits and
rhythms — rather than re-sorting recency. The Household's canonical case: a Tag
eaten roughly weekly should rank high once it is a week overdue, even when
other Options carry a higher raw recency.

## Considered options

- **Status quo.** AI search keeps mirroring recency and adds nothing the
  deterministic Score does not already give. Rejected: it makes the feature
  pointless.
- **A deterministic cadence term in the ranking.** Compute each Tag's typical
  interval from the Log and rank by how overdue an Option is against its own
  rhythm. Deterministic, unit-testable, explainable, and it would fix the
  canonical case in the *default* Tonight list with no query at all. Rejected:
  it can only catch the patterns we think to encode. The Household explicitly
  wants patterns nobody articulated — day-of-week rhythm, what follows what,
  Options quietly drifting out of rotation — and a fixed-form cadence term
  cannot discover those.
- **Open-ended AI pattern discovery (chosen).** Give the model legible raw
  history and room to think, and let it find whatever rhythms it can — cadence
  among them — without us enumerating them in advance.

## Consequences

- ADR-0004 still holds: AI search remains additive and triggered, and the
  deterministic Score is still the offline-proof fail-safe floor. This decision
  changes only how the AI path reasons.
- The model snapshot presents the Log as plain dated history (with
  day-of-week) and, since ADR-0012, timing facts per Option and per Tag. It
  carries **no combined sort key**: the model weighs facts against the history
  rather than anchoring on a ready-made ranking. A future reader should not add
  one.
- AI search uses extended thinking: a call costs more tokens and runs tens of
  seconds rather than a few. Acceptable because it is a deliberate, triggered
  action with a pending state and a fallback — never the home-screen load.
- The valuable re-ranking path is non-deterministic and not unit-tested — the
  opposite of ADR-0003's pure, tested ranking. Iteration is done with a CLI
  harness against real data, judged by whether the rationales surface something
  genuinely useful. Reverting to the deterministic cadence option later means
  building that math from scratch.
- An **AI rationale** states a **rhythm claim**, never an elapsed-time claim
  (both defined in `CONTEXT.md`). The prompt originally allowed plain-words
  timing ("overdue", "just had it") as the readable alternative to raw dates;
  in practice most rationales became restatements of "it has been a while",
  duplicating the Recency chip and the per-Tag chips the Tonight row renders
  directly above them. What replaces duration is the Option's own Interval
  ("runs about every two weeks and that stretch is up"), which the chips cannot
  show — the habit-reasoning this ADR exists for, now required rather than
  invited. This governs how findings are *expressed*. If the ranking itself
  must return a top five that is diverse *in kind*, that is an amendment to
  this ADR, not a tuning.
- The size of the AI result is query-dependent. A query that genuinely narrows
  the Catalog ("something light") returns a focused shortlist of the Options
  that fit. An empty query, or an open one that narrows nothing ("recommend
  something"), returns the whole candidate Catalog ranked — each rationale then
  does double duty: a positive reason near the top, a "why this is a weaker
  pick" note near the bottom. The model itself judges whether a query narrows.
