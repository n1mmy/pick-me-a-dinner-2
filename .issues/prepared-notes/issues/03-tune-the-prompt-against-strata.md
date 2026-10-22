# 03 — Tune the prompt against Strata

Status: ready-for-human
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

- [ ] The script runs for today and today+3 and prints prompt, raw reply, and
      parsed note
- [ ] Every candidate is ranked in both runs; the brief is in the word range
- [ ] Output quality and latency for both runs recorded in the commit message
- [ ] Rows land on a forced-on dev tick; a second tick skips unchanged days
- [ ] `corepack pnpm typecheck`, `lint`, `test`, `build` all green

## Blocked by

- Issues 01 and 02

## Comments

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
