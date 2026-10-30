# pick-me-a-dinner-2

Helps decide what's for dinner: a small Next.js + Drizzle/Postgres app. What
it's for: `PRODUCT.md`. Domain language: `CONTEXT.md`.

This file is the single, self-contained source of project instructions. It
wins over auto-memory entries when they conflict.

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

Skills are suggested, and the user runs them. When a request matches a skill
below, name it in your reply with a one-line reason ("`/investigate` fits —
run it for the full root-cause loop"), then carry on with the request as
asked. Call the Skill tool only after the user types `/<name>` or says yes to
the suggestion. This overrides the default of invoking a matching skill
first.

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
  `/diagnosing-bugs` (or `/investigate` — whichever the user names)
- Module design, deepening, refactor / consolidation → `/codebase-design`
- Writing a skill, `CLAUDE.md`, or another agent-facing doc →
  `/writing-for-agents`
- Grill a plan with ADRs and glossary updated inline → `/grill-with-docs`
- Turn the conversation into a spec → `/to-spec`; break a plan into tracker
  tickets → `/to-tickets`
- Triage incoming bugs / feature requests → `/triage`
- Scan for architecture deepening opportunities →
  `/improve-codebase-architecture`
- Compact this conversation into a handoff doc for another agent →
  `/handoff`
- Find or install a skill for a capability → `/find-skills`

`/ship` and `/land-and-deploy` are billed: say so when suggesting them. If
the user types `/<name>` you don't recognize, ask which skill they mean.

## Billed-call rule

Anything that spends money against an external service, or occupies a
shared one, is user-triggered: state the shape (one call vs a sweep, rough
size and duration) and wait for approval. `scripts/ai-search-eval.ts` and
`scripts/prepared-note-eval.ts --claude` send the full dinner snapshot to a
metered Claude model, so they fall under the rule; a 64-token placeholder
probe that never touches the real snapshot does not. The local model behind
`LOCAL_AI_*`, whichever server hosts it, is not metered but is a shared
resource: a backtest sweep on it ties it up for an hour or more, so it is
approved the same way. A single probe call is not.

## Browser tooling

Use `/browse` for all web browsing. Never use `mcp__claude-in-chrome__*`
tools.

## Agents in other models

Consider Paseo (`paseo`, on `$PATH`) whenever an agent in another model would
help — an outside voice on a review or plan, a cross-model second opinion, or
a skill's Codex step (gstack's own `codex exec` cannot start its sandbox
here). Running an OpenAI model and answering its approval prompts:
`docs/agents/paseo.md`. A run against a metered provider falls under the
billed-call rule.

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
