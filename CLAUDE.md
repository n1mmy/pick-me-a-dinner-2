# pick-me-a-dinner-2

Helps decide what's for dinner: a small Next.js + Drizzle/Postgres app. What
it's for: `PRODUCT.md`. Domain language: `CONTEXT.md`.

This file is the single source of project instructions: it is self-contained
and does not assume any global `~/.claude/CLAUDE.md` is present. Project
`CLAUDE.md` is the highest-precedence instruction source — it wins over
heuristic auto-memory entries when they conflict.

## Skill workflows run end-to-end

When the user invokes a skill (`/ship`, `/review`, `/qa`, `/investigate`,
etc.), execute the **entire** documented workflow. The only authorized skips
are the skill's own skip predicates — phrases inside the skill body like
"skip if no PR exists", "skip if no prompt files changed", "if X is
unavailable, continue". Anything else is the model inventing efficiency.

If a step genuinely seems wasteful, ask in one sentence before skipping
("I'd skip step X because Y — confirm?") and then wait for a reply.

**Stop means stop the tool calls, not stop and narrate.** When a skill says
STOP, the next message must contain no tool calls that advance the workflow.
Announcing a deviation and then running the next step in the same turn is a
violation, not a heads-up. Asking requires waiting for the user's answer
before the next tool call.

## Skill routing

When a request matches a skill, invoke it via the Skill tool as the FIRST
action — don't answer directly or pre-explore. When in doubt, invoke;
over-invoking is cheap, under-invoking ships unreviewed work.

- Product ideas, "is this worth building", brainstorming → `/office-hours`
- Strategy, scope, "think bigger" → `/plan-ceo-review`
- Architecture, "lock in the plan" → `/plan-eng-review`
- Design system, brand guidelines, DESIGN.md authoring → `/design-consultation`
- Plan-stage design review (before code) → `/plan-design-review`
- Live-site visual audit, "polish this" → `/design-review`
- Bugs, errors, "why is this broken", stack traces → `/investigate`
- QA, "test the site", find bugs and fix → `/qa` (report only → `/qa-only`)
- Code review, "check my diff", pre-landing review → `/review`
- Ship, deploy, push, create PR → `/ship`
- Land and deploy after `/ship` → `/land-and-deploy`
- Cross-model second opinion → Paseo (see *Agents in other models*)
- Security audit, threat model → `/cso`

Workflow skills (installed globally from `~/.agents/skills/`):

- Stress-test / "grill me" on a plan → `/grilling`
- Throwaway prototype to flesh out a design before committing → `/prototype`
- Test-first feature work, red-green-refactor → `/tdd`
- Hard bug or performance regression, disciplined root-cause loop →
  `/diagnosing-bugs` (gstack's `/investigate` is the equivalent — prefer
  whichever the user names)
- Module design, deepening, refactor / consolidation → `/codebase-design`
- Writing a skill, `CLAUDE.md`, or another agent-facing doc →
  `/writing-for-agents`

These are user-only (`disable-model-invocation`): when the work matches,
suggest the user run them.

- Grill a plan with ADRs and glossary updated inline → `/grill-with-docs`
- Turn the conversation into a spec → `/to-spec`; break a plan into tracker
  tickets → `/to-tickets`
- Triage incoming bugs / feature requests → `/triage`
- Scan for architecture deepening opportunities →
  `/improve-codebase-architecture`
- Compact this conversation into a handoff doc for another agent →
  `/handoff`
- Find or install a skill for a capability → `/find-skills`

`/ship` and `/land-and-deploy` are user-triggered and billed; only invoke
them when explicitly asked. Other skills may be proactively suggested when
the work matches. If the user types `/<name>` you don't recognize, ask which
skill they mean — don't guess.

## Billed-call rule

The billed-call rule extends past skills: anything that spends money against
an external service is user-triggered too. The standing example is
`scripts/ai-search-eval.ts` — one run sends the full dinner snapshot to the
metered model API and can burn the whole 90s timeout. State the cost shape
(one call vs a sweep, rough size) and wait for approval before running. A
tiny placeholder-body probe (a 64-token curl that never touches the real
snapshot) is fine without asking; a full run is not. Strata, the local model
behind `LOCAL_AI_*` and `scripts/prepared-note-eval.ts`, is free: the rule
doesn't apply to it.

## Browser tooling

Use `/browse` for all web browsing. Never use `mcp__claude-in-chrome__*`
tools.

## Agents in other models

Consider Paseo (`paseo`, on `$PATH`) whenever an agent in another model would
help — an outside voice on a review or plan, a cross-model second opinion. For
OpenAI models go through the omp harness, which holds the login — not the
`codex` harness, which isn't logged in here:
`paseo run --provider omp --model openai/<model> --mode write --title "<title>" "<prompt>"`
(omp modes: `full`, `write`, `ask`). In `write` mode the agent stalls on
approval prompts (shell commands included) that show only as `OMP select`
with no detail: `paseo wait` returns while it's still `running`, so check
`paseo permit ls` and answer with `paseo permit allow|deny <agent> <req>`.
List omp's models with
`omp models find <pattern>`; `paseo provider ls` lists the other providers.
gstack's own `codex exec` can't start its sandbox in this container, so Paseo
is also the route for a skill's Codex outside-voice step. A run against a
metered provider falls under the billed-call rule above.

## Bash shapes

Bash calls go through a permission matcher, and each prompt it raises is
friction for the user. Run Bash in the shape it already clears:

- a bare first token from the cwd: `git status`, `pnpm test`
- literal args, with no `$`, `$(…)`, backticks, or unescaped `*`
- `cat`/`grep`/`find`/`ls` on in-worktree paths, or `Read`
- `git rm` to delete; `Write` a file to create its directory

Chains clear when every stage does. When a shape prompts unexpectedly, read
`docs/agents/permissions.md`. Widening the allowlist in
`.claude/settings.local.json` is the user's call.

## Stay in your worktree

When the working directory is a git worktree (any location —
`.claude/worktrees/`, `paseo-worktrees/`, …), that directory is the
workspace. Do not edit, write to, or run commands that modify files outside
it — the main checkout and sibling worktrees may hold uncommitted or
in-progress work from parallel agents. Read-only git queries
and reading shared config are fine; mutations are not. If a task genuinely
needs changes outside the worktree, stop and ask first.

## Asking the user

Prefer posing choices in plan text — lay out the options inline with the
trade-off for each and a recommended default, so the user can read, react,
and reframe. Reach for `AskUserQuestion` only when a decision genuinely
blocks all progress and the options are mutually exclusive with no sensible
default. For anything you can pick a reasonable default for, pick it, name
it, and proceed.

## Scope

This is a small personal app. Don't add features, abstractions, or
defensive machinery beyond what a task requires — no speculative concurrency
control, rate limiting, or idempotency layers for load that won't exist. If
you find yourself reaching for that kind of complexity, stop and ask first.

## Agent skills

### Issue tracker

Filing, updating, or closing an issue or PRD: they are local markdown files
under `.issues/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Setting an issue's `Status:` triage role: the five canonical roles use their
default strings. See `docs/agents/triage-labels.md`.

### Domain docs

Exploring an area, naming a domain concept, or writing an ADR: single-context,
one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Ralph loop

Running or changing the Ralph loop, or checking the verification gate every
change must pass: loop config and worker permissions. See
`docs/agents/ralph.md`.

### Dev server

"Start the dev server" means: `.env.k8s` copied in as `.env.local`, bound to
`0.0.0.0`. See `docs/agents/dev-server.md`.

## Design System

Always read `DESIGN.md` before making any visual or UI decision. Font choices,
colors, spacing, layout, radius, and motion are all defined there — do not
deviate without explicit user approval. In QA or review, flag any code that
does not match `DESIGN.md`.

When a design decision changes, update `DESIGN.md` in the same commit. Keep it
a statement of the current system: rewrite the affected rule in place with its
reason, and leave dates, superseded states, and change narrative to the commit
message — git history is the decision log.
