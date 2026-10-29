# 14 — The rationale rules say what goes in the line's place (prompt v18)

Status: in-progress
Type: AFK

## Parent

[Spec: Backtest the AI ranking, then decide](../PRD.md)

## Why

Seven v17 Prepared runs on the same 20 days — Opus 5.5 low, Qwen 3.8 dense
at low / medium / xhigh, Strata (`qwen3.8-flash-next`) at the same three
efforts with a 40k budget (xhigh stopped at 14 days) — and AI search v17 on
Opus, read in `plans/prompt-tweaks-v18.md`. Counted over the top-10 rows
with the harness this issue adds to `backtest-compare` (so the numbers
differ a little from issue 13's hand counts: this definition also catches
spelled-out counts, gap lists and gap ranges):

| rows of 200 | Opus | Qwen low | Qwen med | Qwen xhigh | Strata low | Strata med | Strata xhigh (140) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| states elapsed time | 8 | 166 | 158 | 0 | 154 | 133 | 0 |
| snapshot word | 48 | 139 | 141 | 79 | 149 | 148 | 58 |
| code as a word | 0 | 3 | 2 | 1 | 2 | 6 | 0 |
| lowercase name | 1 | 34 | 43 | 23 | 27 | 25 | 7 |
| opens with the name | 123 | 5 | 9 | 32 | 49 | 59 | 1 |
| opens with a stand-in | 2 | 5 | 4 | 47 | 7 | 6 | 58 |
| quotes the household | 26 | 58 | 88 | 6 | 70 | 54 | 0 |
| names a weekday | 76 | 80 | 105 | 16 | 104 | 109 | 24 |
| row length (mean chars) | 161 | 206 | 228 | 192 | 207 | 226 | 176 |

Briefs announcing no Day note: Qwen xhigh 7 of 20, Qwen low 4, Strata
xhigh 2 of 14. AI search v17 on Opus (v15 / v17): elapsed time 7 / 11,
snapshot word 22 / 24, opens with the name 11 / 50, stand-in 10 / 15, row
length 70 / 78.

Three failure shapes, one cause. `RATIONALE_RULES` says what the line must
not carry (the number, the name) but not what goes in its place. Opus fills
the gap from judgement and writes the best text ("the rice reheats easily
for the late arrivals"), with two tics: the name as the opener, and the
snapshot's words (pace, rhythm, spacing) since v16 folded away the Prepared
vocabulary bullet. The local models at low and medium fill it with the
forbidden thing — "Fifteen days sits squarely in the 12-to-29 range…", gap
lists as written — and at xhigh with nothing: stand-ins for the name ("The
frequent comfort pick has a comfortable pace"), no quotes, people as "one
person… another". On screen in every local run and never in Opus: option
codes in prose ("U is the mediterranean they actually want"), names
lowercase as typed ("Jen and helen"), tag syntax ("the helen: burger tag").

Two Prepared-only faults with no shared cause: the compulsory two or three
sentences per top-five row leaves room for filler when one fact decides a
candidate, and briefs that announce the absence of a Day note ("With no
special note…").

## What to do

- **Shared `RATIONALE_RULES`, both prompts to v18.** One paragraph, each
  guardrail paired with its positive, no lead menu, no "vary", no examples
  (issue 13: the model writes to a recipe). The timing is written in what
  the household would notice — what they had this week, who is home, what
  they said last time; the line opens on that reason, not on the name or a
  stand-in for it; it is in their words, never the snapshot's — tag, gap,
  pace, cadence, rhythm, spacing, a field name, a Log date, an Option's code
  — with Options and people called by their names, capitalised even where
  the household typed them lower case.
- **Prepared-only** (`lib/prepared-note.ts`): the top-five sentence quota
  becomes a ceiling ("up to three sentences; one is enough when there is one
  useful reason"); "Most evenings have no Day note; that is the ordinary
  case" becomes "Describe the evening only as specifically as the evidence
  allows".
- **The counts live in the repo.** The two v17 reads counted in scripts
  under `/tmp` that disagreed in detail. `scripts/backtest-compare.ts` now
  prints the text counts above for both runs, the same for the briefs, mean
  row length, and usable-note coverage per run; the code and lowercase-name
  counters print their rows for the eye.
- Tests, `CONTEXT.md`'s **AI rationale** entry, ADR-0005's amendment, the
  `RATIONALE_RULES` doc comment.

## Held back, each its own experiment

Run only if the fault survives v18, one at a time against the chosen v18:
"say the specific thing" (who it suits, which dish, what the note said);
preserve uncertainty (a past meal does not establish leftovers remain);
tonight's context first in the Prepared input; names beside codes in the
last seven days of Log.

## Read

1. **Free, first:** Prepared v18 on Strata at low, medium and xhigh with
   the same 40k `LOCAL_AI_MAX_TOKENS`, and Qwen 3.8 at low and xhigh, on
   the same 20 anchor days. Compare each against its own v17.
2. **Billed, after approval:** Prepared v18 on Opus 5.5 low (`--claude`,
   20 calls, about $3), then AI search v18 on Opus pithy (20 calls, about
   $3). Prepared first: if the shared edit fails there, AI search's run is
   not worth buying.

Days to read closely: 10-06, 10-09, 10-13, 10-17, 10-18, 10-20, 10-26.

Bars against v17 on the same model, from the plan: elapsed-time rows hold
or improve everywhere (Opus ≤ 8 Prepared, ≤ 11 AI search on the harness's
count); weekday rows; hit@N and mean rank within noise (Opus Prepared
11/11/16); no new unusable notes or omitted candidates. Local models:
elapsed-time and snapshot-word rows down to near Opus v17's level at low
and medium; code leaks and lowercase names at 0; at xhigh, quotes up from
6 / 0 and stand-in openers down from 47 / 58. Opus, both prompts: name
openings down from 123 (Prepared) and 50 (AI search), with v15's 59 / 11 as
the floor to beat; snapshot words down from 48 / 24 towards v15's 9 / 22;
AI search mean row length near 78 characters. Read by eye, which decides:
the top fives as concrete as Opus v17; no invented availability, attendance
or timing; a line that keeps every rule but says less is a regression. If
one prompt passes and the other does not, the fix goes in the failing
prompt's own text, not back into the shared rules; edits 1 and 2 run
together on Prepared, so AI search is where the shared text is judged. If
the shorter rows lose material reasons, restore the quota and keep the rest.

## Acceptance

- [x] Both prompts read the v18 `RATIONALE_RULES`; `AI_SEARCH_PROMPT_VERSION`
      and `PREPARED_PROMPT_VERSION` are "18"; the Prepared quota is a ceiling
      and the "ordinary case" sentence is gone.
- [x] `backtest-compare` prints the text counts and coverage; the v17 runs
      are re-counted with it (the table above).
- [ ] The free local v18 runs are recorded and read against the bars.
- [ ] The Opus Prepared v18 run, then the AI search v18 run, after approval,
      with their reads as comments below.
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test` pass.

## Comments

- 2026-10-29: edits 1 and 2, the harness counters, tests and docs are in.
  Nothing has been run on v18 yet; the table above is v17 as the harness
  counts it.
