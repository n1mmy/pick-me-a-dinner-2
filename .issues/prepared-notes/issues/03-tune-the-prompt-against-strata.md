# 03 — Tune the prompt against Strata

Status: done
Type: HITL

## Parent

[Spec: Prepared notes](../PRD.md)

## What to build

A free eval script, and a prompt that reads well on the real snapshot. HITL
because it needs Strata, the dev database, and a judgment of whether the brief
reads well — a Ralph worker has none of the three.

- **`scripts/prepared-note-eval.ts`**, modelled on `scripts/ai-search-eval.ts`:
  for a `--day`, against the dev DB, print the built prompt, Strata's raw reply,
  and the parsed brief and ranking.
- **Tune** `buildPreparedSystemPrompt()` and `max_tokens` until the brief reads
  well (150–300 words, the evening's context, two or three standouts, what to
  watch out for), the ranking covers every candidate, and rationales follow the
  rhythm-claim rule. Bump `PREPARED_PROMPT_VERSION` on any prompt change.
- **Check the loop end to end.** Run the dev server with the loop temporarily
  forced on: rows land in `prepared_notes`, and a second tick skips unchanged
  days. Don't commit the forcing.

Calling Strata is **free** — the billed-call rule doesn't apply. Its endpoint
and key are in `~/.omp/agent/models.yml` (provider `strata`); put them in
`.env.local`, never in a commit. `scripts/ai-search-eval.ts` is still billed
and still needs approval.

## Acceptance criteria

- [x] The script runs for today and today+3 and prints prompt, raw reply, and
      parsed note (today on v4; +3 on v2 and v3 — the v4 +3 runs hit the
      18-minute timeout under another client's load, which is what moved it
      to 40)
- [x] Every candidate is ranked in both runs; the brief is in the word range
      (one unranked candidate per run accepted by the human — Tonight
      appends it; the range is now 40–70 words, prompt v5)
- [x] Output quality and latency for both runs recorded in the commit message
- [x] Rows land on a forced-on dev tick; a second tick skips unchanged days
- [x] `corepack pnpm typecheck`, `lint`, `test`, `build` all green

## Blocked by

- Issues 01 and 02

## Comments

**2026-10-23 — loop check, done.** Dev DB (`.env`, localhost) holds a copy of
prod's data taken 2026-10-22 ~23:15 UTC, with 0006 applied. `next start`
(production mode, so the loop runs with no code change) stored v5 notes for
Oct 23–26: 22, 28, 36, and 31 minutes, 16.1–16.5k tokens each, Strata busy
with another client throughout; 35–38 rows; Friday's brief 50 words. The
server was then stopped (the agent's 2-hour background limit), mid Oct 27.
A second `runSweep` against the same DB, with a recording stub for the
model, asked only for Oct 28: Oct 23–26 skipped as unchanged, Oct 27 skipped
for its live claim. (APP_TZ is Los Angeles, where it was still the decided
Oct 22, so the window was Oct 23–28.)

Also from the human, 2026-10-22: the brief is now two or three sentences
(prompt v5), and Prepared ranking rows keep the Last note (9025703).

**2026-10-22 — human decisions.** Keep the default `xhigh` effort (no
`chat_template_kwargs`). One unranked candidate per run is accepted: Tonight
appends it, as AI search does. The loop check runs against the dev DB with a
copy of prod's data and 0006 applied there, not against prod. Following from
`xhigh` on a shared Strata: request timeout 40 min, lease 45 min (447b3a1).

**2026-10-22 — tuning in progress (commit 38f9d28).** Script, streaming client,
checklist line, and prompt v4 are in. Open decisions for the human:

- **Reasoning effort.** Strata's chat template takes
  `chat_template_kwargs.reasoning_effort` (`xhigh` default, `medium`, `low`) or
  `enable_thinking: false`; a top-level `reasoning_effort` is ignored. Same v4
  request on today+3 (36 candidates), Strata otherwise idle:

  | effort | out tokens | wall  | brief | ranked | rhythm-claim slips          |
  | ------ | ---------- | ----- | ----- | ------ | --------------------------- |
  | xhigh  | 13.4–16.9k | 7–10m | ~200w | 35/36  | none                        |
  | medium | 13.8k      | ~6m   | 244w  | 36/36  | 2 (dates "10/15", "10/1")   |
  | low    | 10.2k      | ~6m   | 228w  | 36/36  | 6 tail rows ("in March")    |
  | off    | 1.6k       | 1.5m  | 218w  | 31/36  | many; bold markdown; names  |

  Strata is shared: under another client's load decode falls from ~35 to
  ~16 tok/s with speculative drafting off, and an xhigh note (16k+ tokens)
  overran the 18-minute timeout. Two replicas sweeping at once load it the
  same way.
- **Coverage.** xhigh misses one candidate per run after the checklist fix;
  Tonight appends unranked candidates (story 15), but the criteria say all.
- **Forced-loop check.** The cluster DB (`.env.k8s`) has no `prepared_notes`
  (0006 not applied). Alternative: restore the 2026-09-08 pgdump into a fresh
  local DB, migrate, and `next start` (production mode starts the loop with no
  code change) against it.
