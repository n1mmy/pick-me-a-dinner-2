# Prompts v18: the rationale rules say what goes in the line's place

Merged from `prompt-tweaks-astra1.md`, `prompt-tweaks-fable1.md` and
`prompt-tweaks-opus1.md`, three reads of the v17 Prepared runs made on
2026-10-29. Where they agreed, this plan keeps the shared text. Where they
differed, the choice and its reason are stated inline. Nothing here has been
run; these are hypotheses with bars.

## Evidence

Seven v17 Prepared runs: Opus 5.5 low (20 days), Qwen 3.8 dense at low /
medium / xhigh (20 days), Strata (`qwen3.8-flash-next`) at the same three
efforts with a 40k budget. Two of the reads saw Strata at 10–13 days; the
third saw it at 20 days low, 19 medium, with the medium 2026-10-26 note
unusable and its failure record not saying why. Plus AI search v17 on Opus
(pithy). Counts are over top-10 rows.

- **Opus Prepared** writes the best text: concrete household sense ("the
  rice reheats easily for the late arrivals"). Its tics are issue 13's two
  regressions: 132 of 200 rows open "<Name> is…", and snapshot words
  (pace, rhythm, spacing) appear in 48 of 200, up from 9 when v16 removed
  the Prepared vocabulary bullet.
- **Local models at low and medium** stay concrete and quote the household
  most (up to 44% of rows), but state elapsed time outright in 58–76% of
  rows, usually as the first words and spelled out: "Fifteen days sits
  squarely in the 12-to-29 range…", with raw gap lists ("gaps run
  21,21,14,6"). Snapshot words in 62–78% of rows. Numerical lines sometimes
  contradict themselves (24 days called "far past" a 91-day gap).
- **Local models at xhigh** pass every count by saying nothing: stand-ins
  for the name ("The frequent comfort pick has a comfortable pace", 45 of
  200 rows), almost no quotes (3%, 0%), people as "one person… another".
- **On screen in every local run, never in Opus:** option codes in prose
  ("U is the mediterranean they actually want"; a brief with "AI Tadu's
  delivery note… O Kukje's corn"), names lowercase as typed ("Jen and
  helen"), tag syntax ("the helen: burger tag").
- **Fluent prose sometimes invents:** a cooler for sous-vide chicken, a
  promise that frozen food takes under ten minutes, leftovers assumed to
  remain.
- **AI search v17 on Opus** has none of the local faults and shares Opus's
  two: 59 of 200 rows open with the name, 19 use snapshot words.

Strata medium's 10-09 Leftovers line shows the target: "With two people
getting in late, reheating whatever's on hand lets everyone eat on their own
clock."

## Diagnosis

One cause behind three failure shapes. `RATIONALE_RULES` says what the line
must not carry (the number, the name) but not what goes in its place. Opus
fills the gap from judgement; the local models at low effort fill it with
the forbidden thing; at xhigh they fill it with nothing. The vocabulary,
code and lowercase faults are the snapshot's own words reaching the prose,
which the rules stopped naming at v16. Both causes sit in the shared text, so
the fix goes there, once, for both prompts.

Two Prepared-only faults have no shared cause: the compulsory two-or-three
sentences per top-five row leaves room for filler when one fact decides a
candidate, and briefs that announce the absence of a Day note.

A caveat from the fable read: the day-count openings at low effort are
partly effort, not prompt. The same v17 rule holds on Opus and on xhigh. If
the shared edit does not move them at low, the answer may be running the
local model higher, not more prompt.

## Changes

### 1. Shared `RATIONALE_RULES` (both prompts to "18")

The paragraph stays one paragraph, each guardrail paired with its positive,
no lead menu, no "vary", no examples: issue 13 showed the model writes to a
recipe, and the astra read's two style illustrations would be one. Draft,
with the three edits in bold:

> Each line is read beside the Option's name and the row's numbers: how
> recent it is, and the same per Tag. Those numbers are theirs to read; the
> line says what the timing means **in what the household would notice —
> what they had this week, who is home, what they said last time —** never
> how long it has been, in any form. It carries what that row cannot show:
> why the Option sits where it does this evening, in their history or their
> own words — for a genuine pick, what makes it one; for the rest, what keeps
> it below the rows above. It **opens on that reason, not on the name beside
> it or a stand-in for it**. Write about the household in the third person,
> in their words — the food, the person, the night — **never the snapshot's:
> not tag, gap, pace, cadence, rhythm or spacing, not a field name, not a
> Log date, not an Option's code.
> An Option is called by its name, a person by theirs, capitalised even
> where the household typed it lower case.**

- **Timing in what they'd notice** gives low effort something to write in
  place of "Fifteen days…" and xhigh something in place of "its cadence is
  ordinary". It names what a timing claim rests on, not how a line opens.
  The read checks that "After a week of…" does not become the template.
- **Open on the reason** makes the name rule positive and closes the
  stand-in dodge in the same clause. Both prompts read this one clause; it
  fails worse on Prepared (132 of 200 against AI search's 59), whose longer
  rows give it more room. The sentence that repeated "beside the name" folds
  into it: the paragraph loads on every call of both prompts.
- **The snapshot's words, named once** restores v15's Prepared vocabulary
  bullet as a shared guardrail with only the words that leak today, and
  covers codes, Log dates and capitalisation: the faults that reach the
  screen. AI search's 19 snapshot-word rows are the same fault, smaller.

`AI_SEARCH_PROMPT_VERSION` and `PREPARED_PROMPT_VERSION` both become "18".
The Prepared prompt's "The same holds in the brief" carries all three to the
brief.

### 2. Prepared-only lines (`lib/prepared-note.ts`)

- **Replace the sentence quota.** Today: "The top five rows each get two or
  three full sentences…". Instead: "Give the strongest rows enough to make
  the decision useful, up to three sentences; one is enough when there is
  one useful reason. Write less as you go down, tapering to a single short
  sentence for the weakest; no row is left blank." Accept shorter strong
  rows that keep the reason; reject shortening that drops a constraint or an
  ordering detail. AI search sets its own lengths and is unchanged.
- **Drop the sentence that invites announcing a missing Day note.** Delete
  "Most evenings have no Day note; that is the ordinary case" and put in its
  place: "Describe the evening only as specifically as the evidence allows."
  The brief's opening rule already says what to open on when there is no
  Day note. The Qwen xhigh "With no special note…" briefs (3 of 20) are the
  case.

### 3. Held back, each its own experiment

Run only if the fault survives v18, one at a time against the chosen v18.

- **Say the specific thing** (fable item 4): "Say the specific thing — who
  it suits, which dish, what the note said — rather than talking round it."
  Edit 1's "in what the household would notice" is meant to cover this. If
  xhigh is still vague, add it and read it against the vocabulary clause,
  since it may push low back towards stating the timing.
- **Preserve uncertainty** (astra change 4): "A past meal does not establish
  that leftovers remain; a previous delivery does not establish today's
  timing; someone absent yesterday is not thereby home tonight. Make the
  recommendation conditional when the fact is unknown." Risk: caveat
  boilerplate where the snapshot does establish the fact.
- **Tonight's context first in the Prepared input** (astra A). `leanSnapshot`
  emits `todayDayNote` through `...rest`, after catalog, tags, log and
  rejections. Move it beside `today` for the Prepared message only; AI
  search's input stays as it is. Same evidence, same fields; ordering may
  do nothing, so it needs a matched pair.
- **Names beside codes in the last seven days of Log** (astra B), anchored
  to the snapshot's day, not the wall clock. Costs input tokens; measure
  them. Not the whole history: the lean format exists to avoid that.

### 4. Everything that moves with the text

As issue 13 did:

- `lib/prepared-note.test.ts` and `lib/ai-search.test.ts` where they pin
  the prompt (`lib/prepared-notes.db.test.ts` overrides `RATIONALE_RULES`
  and should not need to change)
- `CONTEXT.md`'s **AI rationale** entry
- an ADR-0005 amendment line
- the `RATIONALE_RULES` doc comment in `lib/ai-search.ts`
- a new issue in `.issues/ai-ranking-backtest/issues/` (14) with the v17
  counts as its Why

## Harness: the counts live in the repo

Both counting reads used scripts in `/tmp` (`/tmp/v17-text/count.py`,
`/tmp/v17text/{side,stats,tics}.py`), which will not survive a reboot and
disagree in detail. Before the v18 runs, fold one set of definitions into
`scripts/backtest-compare.ts` (it already prints the per-day read and
aggregates), so v17 and v18 are counted the same way. Rows that:

- state elapsed time, including spelled-out counts and gap lists
- use a snapshot word (tag, gap, pace, cadence, rhythm, spacing)
- contain a candidate code as a word (short codes overlap English; the
  compare prints the row so the eye can discard false hits)
- write a known person's name lowercase
- open with the Option's name
- open with a stand-in ("The/This … pick/option")
- open "After a…"
- quote the household
- name a weekday

plus mean row length and, per run, usable-note coverage (so a missing day is
a coverage fact, not a prose score).

## Read

1. Let the three Strata v17 runs finish for a 20-day baseline.
2. **Free, first:** Prepared v18 on Strata at low, medium and xhigh with the
   same 40k `LOCAL_AI_MAX_TOKENS`, and Qwen 3.8 at low and xhigh, on the
   same 20 anchor days. Compare each against its own v17.
3. **Billed, after approval:** Prepared v18 on Opus 5.5 low (`--claude`,
   20 calls, ~2k output tokens each, about $3), then AI search v18 on Opus
   pithy (20 calls, about $3). Prepared first: if the shared edit fails
   there, AI search's run is not worth buying.

Days to read closely, whatever the counts say: 10-06 (swim night, low's
code-leaking brief), 10-09 (late arrivals), 10-13 (Opus ranked Aji Ichi #1
with a line arguing it belongs lower: a ranking question, noted and not
addressed here), 10-17 (quiche availability against restaurants), 10-18
(medium's code-leaking brief), 10-20 (Jen away, swim night), 10-26 (low's
timing-heavy prose; medium's missing note).

### Bars against v17 on the same model

Holds or improves everywhere:

- elapsed-time rows (Opus ≤ 3 Prepared, ≤ 6 AI search)
- weekday rows
- hit@N and mean rank within noise (Opus Prepared 11/11/16)
- coverage: no new unusable notes or omitted candidates

Local models:

- elapsed-time and snapshot-word rows down to near Opus v17's level at low
  and medium
- code leaks and lowercase names at 0
- at xhigh, quotes up from 3% / 0% and stand-in openers down from 45 / 39

Opus, both prompts:

- name openings down from 132 (Prepared) and 59 (AI search); v15's 59 / 48
  of 200 is the floor to beat
- snapshot words down from 48 / 19 towards v15's 9 / 7
- AI search mean row length near 78 characters: issue 13 showed a longer
  line comes back as restated numbers

Read by eye, which decides:

- the top fives read as concretely as Opus v17: a practical choice, a
  preference, an ordering detail, a constraint
- no invented availability, attendance or timing promises; rationale agrees
  with its placement and the brief with the ranking
- a line that keeps every rule but says less is a regression; that is how
  both xhigh runs failed
- a single run per condition does not settle a small difference; repeat an
  ambiguous pair before calling it

If one prompt passes and the other does not, the fix goes in the failing
prompt's own text, not back into the shared rules. Edits 1 and 2 run
together on Prepared, so a Prepared gain is not credited to the shared text
alone: AI search carries edit 1 by itself and is where that text is judged.
If edit 2's shorter rows lose material reasons, restore the quota and keep
the rest.

## Not proposed

- Examples or lead menus in the prompt (issue 13).
- Swapping leaked codes for names in the parser: that is the tolerant layer
  `plans/simplifications-2026-10-29.md` removes. Back only if leaks survive
  v18.
- A second model pass to rewrite the first's text.
- Removing `recentGaps` or other timing evidence, or replacing it with a
  precomputed "due" label.
- Restoring names, tags and kinds across the whole Log.
- A blacklist that grows a synonym per run.
- Raising effort as the fix for the writing; raising it as the fix for
  low-effort day counts is a separate call, made after the read.

## Order

1. Counters into `backtest-compare.ts`; re-count v17 with them.
2. Edits 1 and 2 together, both prompts to v18, tests and docs with them.
3. Free local runs; read against bars.
4. Approval, then Opus Prepared; if it passes, Opus AI search.
5. Adopt what holds. Open the held-back experiments only for faults that
   survive, one at a time.
