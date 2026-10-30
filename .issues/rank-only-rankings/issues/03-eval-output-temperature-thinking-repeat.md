# 03 — Rank output, temperature, thinking off and repeats in the eval

Status: ready-for-agent
Type: AFK

## Parent

[Spec: Rank-only rankings and run-to-run spread](../PRD.md) ·
[Plan](../../../plans/rank-only-rankings.md), step 3

## What to build

`scripts/prepared-note-eval.ts --backtest` can ask the local model or
Claude for a rank-only or with-text ranking, at a set temperature, with
thinking off, N times over the same days.

**`createPreparedNoteClient`** takes three optional settings. Production
passes none, so its request body is unchanged:

- **`output: "note" | "rank"`**, default `note`. With `rank` the client
  uses ticket 02's prompt, message and parser and returns
  `{ brief: "", ranking }`. `MIN_RANKED_SHARE` and the
  natural-`stop`-only rule still apply.
- **`temperature?: number`**, sent when set.
- **`thinking?: false`**, which sends
  `chat_template_kwargs: { enable_thinking: false }` and no
  `reasoning_effort`.
- **No seed** is ever sent.

**`scripts/prepared-note-eval.ts`**:

- **Flags:**
  - `--output=rank|note`;
  - `--temperature=<n>`;
  - `--thinking=off`, which overrides `LOCAL_AI_REASONING_EFFORT`.
- **The Claude path:**
  - `--thinking=off` sends `thinking: { type: "disabled" }`;
  - `--temperature` sends `temperature`, and is refused with a message
    unless thinking is off;
  - `--output=rank` uses the rank-only prompt and parser.
- **`meta` gains** `output`, `temperature` (number or `default`), and
  `thinking` (the effort, or `off`).
- **The default run file:**
  `scripts/backtest-runs/<prepared|rank>-v<version>-<model>-<thinking>[-t<temp>].json`,
  with a leading `claude-` dropped. It replaces the `strata-v…` default.
- **The header comment** says "the local model". The claim that the
  billed-call rule doesn't apply to it is replaced: a single call is a
  probe, and a sweep waits for approval (`CLAUDE.md`).

**`scripts/backtest.ts`**:

- **`--repeat=N`** is in `parseBacktestArgs` / `BacktestArgs`, and
  `runBacktest` runs the day list N times, one whole run after another:
  - into `-r1` … `-rN` files, each with its own `-reasoning/`
    directory and `meta.repeat: "i/N"`;
  - with `--resume`, a finished file is skipped and a partial one
    continued.
- **Empty reasons on a rank run:** when `meta.output` is `rank`, empty
  reasons aren't counted (`emptyTop10`) or printed.

## Acceptance criteria

- [ ] The client's request body with no new settings equals today's, in a
      mocked-`fetch` test.
- [ ] `output: "rank"`, `temperature` and `thinking: false` each add only
      their own field.
- [ ] A rank reply is parsed into a ranking with an empty brief, and a
      thin one is refused.
- [ ] `--temperature` on `--claude` without `--thinking=off` exits with a
      message.
- [ ] `--repeat` is parsed and validated, which is tested beside the
      existing `parseBacktestArgs` cases.
- [ ] The default file names come out as the plan's examples.
- [ ] Old run files without the new `meta` fields still load (`--resume`).
- [ ] The gate passes. No model is called in this ticket.

## Blocked by

02.
