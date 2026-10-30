# 05 — The six probe calls, then a sweep proposal

Status: ready-for-agent
Type: HITL

## Parent

[Spec: Rank-only rankings and run-to-run spread](../PRD.md) ·
[Plan](../../../plans/rank-only-rankings.md), step 5

## What to build

Run the six single-day probes the user approved on 2026-10-30, record
what they show, and propose the first sweep.

- **Where:** in an interactive session, not the Ralph loop. The calls
  reach the local model and the billed Anthropic API.
- **Nothing beyond these six** is approved.

| Arm | Local model (Qwen 3.8 dense, `.env.backtest.qwen`) | Opus 5.5 (`--claude`) |
|---|---|---|
| rank, low | `--output=rank`, `LOCAL_AI_REASONING_EFFORT=low` | `--output=rank --effort=low` |
| rank, thinking off | `--output=rank --thinking=off` | `--output=rank --thinking=off` |
| rank, thinking off, temperature 0 | `--output=rank --thinking=off --temperature=0` | the same |

- **Every probe** is `--backtest --days=2026-10-22`, with
  `--json=<default name>-probe.json --reasoning`.
- **For each probe, record** in the run list in
  `scripts/backtest-runs/README.md`:
  - latency;
  - output tokens;
  - reasoning length;
  - rows ranked against candidates;
  - the Pick's rank;
  - for the local model, whether thinking off actually came back with no
    reasoning.
- **Then propose the first sweep, and don't run it:**
  - the arms, N, and the 20 standard days;
  - hours on the local model, dollars on Opus;
  - chunks that each fit under the two-hour background limit.
- **Separately,** propose running the with-text prompt N times, which is
  needed to compare its spread with rank-only. It is about 8 hours on the
  local model at N=5.
- **Wait for approval** before any of it runs.

## Acceptance criteria

- [ ] Six probe files exist, and the README run list has a line for each
      with the numbers above.
- [ ] The local model's thinking-off behaviour is recorded as confirmed
      or not. If not, that arm is dropped on the local model and the
      README says so.
- [ ] A sweep proposal with hours and cost is in front of the user, and
      no sweep has started.

## Blocked by

03. Ticket 04 should land before the sweep, but not before the probes.
