# Prompts v19: the line gives the count and the usual stretch

Grilled 2026-10-29 (`/grill-with-docs`), from reading v17 in production.
Settled there: `CONTEXT.md`'s **rhythm claim** and **Usual stretch**
entries, ADR-0005's fifth amendment. This plan is the work that follows.

## The premise that flipped

v17 and v18 said a rationale never states how long it has been: the count
is on the Recency chip beside the line, so a line that repeats it is
redundant (ADR-0005's consequence, issue 13's guardrail, issue 14's
"timing in what the household would notice"). Reading v17 in production
showed the opposite. A line is skimmed; a chip has to be found and parsed.
"At 15 days Mazra sits squarely inside the household's 12–16 day
Mediterranean rhythm" is faster to take in than "15d" plus nothing, and the
yardstick half of it — the 12–16 — was never on any chip: ADR-0012 removed
the Interval from the snapshot and the chips show days since only.

So the count is welcome, and welcome with the stretch beside it. What was
genuinely a fault in the v17 runs is different in kind: the gaps as a list
("gaps run 21,21,14,6"), Log dates as citations ("set aside on Sep 30"),
arithmetic that contradicts itself ("24 days, far past a 91-day gap"), and
a count measured from the wrong thing — "twenty days since Aji Ichi" while
sushi was four days ago, the Tag chip beside it red.

## What v18 did that this keeps

v18 also carried edits with no connection to timing, each a measured fault:
open on the reason rather than the name or a stand-in; the leak list (tag
syntax, field names, Log dates, codes, lowercase names); the top-five
sentence quota as a ceiling; "describe the evening only as specifically as
the evidence allows". Those stay. v19 is v18 with the timing clause
replaced and the timing words taken off the leak list.

## Changes

### 1. Shared `RATIONALE_RULES` (both prompts to "19")

The timing clause, in place of v18's "the line says what the timing means
in what the household would notice … never how long it has been, in any
form":

> Those numbers are theirs to read, and the line may read them back: how
> long it has been, set against the stretch they usually leave it, measured
> from whichever is nearer, the Option's own last turn or one of its Tags'.
> A count with no stretch beside it says little; the gaps themselves never
> appear as a list.

And in the leak list, "not tag, gap, pace, cadence, rhythm or spacing"
becomes "not a tag written as the snapshot writes it". The rest of the
paragraph is v18's. Still one guardrail paired with its positive, no lead
menu, no examples, no "vary" (issue 13).

### 2. The harness reads timing as a readout, not a fault

`scripts/backtest-compare.ts`: "states elapsed time" becomes "timing
count" and "with a yardstick" (the count beside a word that sets it against
something: usual, stretch, every, due, sooner, within…). The snapshot-word
regex loses pace, cadence, rhythm, spacing and gap and gains the field
names. Three fault counters: a gap list, a Log date, and "tag nearer,
counts option" — a Tag had sooner than the Option, and the line counts the
Option's days without the Tag's. The last needs the run file to carry each
row's Option daysSinceLast and nearer Tag, which `scripts/backtest.ts`
records from v19 on; older files print n/a.

### 3. The snapshot stays as it is

A range in place of the four gaps was considered and declined: ADR-0012
removed the median because every summary number became the thing the model
ranked against, a range over four gaps is one too, and the v17 lines show
the model already turns the gaps into "12–16 day rhythm" itself. The Aji
mismatch was not a gaps problem either; the sushi Tag's facts were in the
snapshot. If v19's yardstick coverage comes out low, a range is a separate
experiment after.

### 4. Not changing

The chips. A second timing rule for AI search or the brief. The row
lengths.

## Baseline: v17 and v18 re-counted with the new counters

Top-10 rows over the shared days, A → B. Strata medium is over 12 days
(v18 medium stopped there); Qwen v18 low has 18 usable days.

| rows | Opus 17 → 18 | Strata low 17 → 18 | Qwen low 17 → 18 | Strata med 17 → 18 |
| --- | --- | --- | --- | --- |
| timing count | 10 → 18 | 162 → 82 | 166 → 103 | 79 → 51 |
| with a yardstick | 6 → 9 | 126 → 50 | 126 → 52 | 62 → 31 |
| gap list | 0 → 0 | 11 → 0 | 4 → 0 | 1 → 0 |
| Log date | 0 → 0 | 29 → 12 | 6 → 1 | 23 → 2 |
| snapshot word (tag syntax, field names) | 5 → 0 | 47 → 7 | 40 → 11 | 32 → 6 |
| code as a word | 0 → 0 | 2 → 1 | 3 → 0 | 5 → 0 |
| lowercase name | 1 → 0 | 27 → 2 | 34 → 6 | 18 → 6 |
| opens with the name | 123 → 109 | 49 → 34 | 5 → 12 | 29 → 44 |
| opens with a stand-in | 2 → 7 | 7 → 9 | 5 → 5 | 4 → 4 |
| quotes the household | 26 → 9 | 70 → 29 | 58 → 31 | 32 → 10 |
| row length (mean chars) | 161 → 120 | 207 → 164 | 206 → 155 | 227 → 194 |

Two things to read off it. v18 did cut the leaks (gap lists, Log dates, tag
syntax, codes, lowercase names), and those bars carry over. v18 also
halved the quotes and shortened every row: the lines say less, which issue
14's own read called a regression. v19 has to get the quotes back while
keeping the leaks down.

## Read

1. **Local, first, each run approved like a billed one:** Prepared v19 on
   Strata at low, then medium, with
   `LOCAL_AI_MAX_TOKENS=40000`, on the same 20 days, each read against its
   own v18 and v17 through `backtest-compare`.
2. **Billed, after approval:** Prepared v19 on Opus 5.5 low (`--claude`,
   20 calls, about $3), then AI search v19 on Opus pithy (20 calls, about
   $3). Prepared first; if the shared edit fails there, AI search's run is
   not worth buying.

Days to read closely: 10-06, 10-09, 10-13, 10-17, 10-18, 10-20, 10-26.

## Bars, against v18 on the same model

- The share of timing lines with a yardstick up (Strata low v18: 50 of 82).
- Gap list and Log date rows at zero.
- "Tag nearer, counts option" rows: first measured on v19, so no number to
  beat; read the rows it prints on the close-read days and expect few.
- Quotes back toward v17's count (Strata low 70, Qwen low 58, Opus 26).
- v18's leak and name-opener counts hold; lowercase names and codes at zero.
- hit@N and mean rank within noise; no new unusable notes or omitted rows.
- Read by eye, which decides: top fives as concrete as Opus v17, no invented
  availability or attendance, no self-contradicting arithmetic. A line that
  keeps every rule but says less is a regression.

If one prompt passes and the other does not, the fix goes in the failing
prompt's own text, not back into the shared rules.
