# pick-me-a-dinner-2

Helps decide what's for dinner. Early-stage — the repo currently holds only
this file and a README; code, stack, and architecture are not yet decided.

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
("I'd skip step X because Y — confirm?") and then wait for a reply. Never
auto-decide.

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
- Cross-model second opinion → `/codex`
- Security audit, threat model → `/cso`

Workflow skills (installed globally from `~/.agents/skills/`):

- Stress-test / "grill me" on a plan → `/grill-me`; same but checked against
  the domain model with docs updated inline → `/grill-with-docs`
- Turn the conversation into a PRD → `/to-prd`; break a plan into
  independently-grabbable tracker issues → `/to-issues`
- Triage incoming bugs / feature requests → `/triage`
- Throwaway prototype to flesh out a design before committing → `/prototype`
- Test-first feature work, red-green-refactor → `/tdd`
- Hard bug or performance regression, disciplined root-cause loop →
  `/diagnose` (gstack's `/investigate` is the equivalent — prefer whichever
  the user names)
- Improve architecture, find refactor / consolidation opportunities →
  `/improve-codebase-architecture`
- Unfamiliar code, "give me the bigger picture" → `/zoom-out`
- Compact this conversation into a handoff doc for another agent →
  `/handoff`
- Create a new skill → `/write-a-skill`; find or install a skill for a
  capability → `/find-skills`
- Ultra-compressed replies → `/caveman`

`/ship` and `/land-and-deploy` are user-triggered and billed; only invoke
them when explicitly asked. Other skills may be proactively suggested when
the work matches. If the user types `/<name>` you don't recognize, ask which
skill they mean — don't guess.

## Browser tooling

Use `/browse` for all web browsing. Never use `mcp__claude-in-chrome__*`
tools.

## Tool & permissions discipline

Bash calls go through a permission matcher that prompts (or, in an automated
loop, denies) unfamiliar command shapes. The matcher treats compound shell
expressions as separate patterns from their constituents, so a compound
prompts even when each piece is allowlisted.

- **Prefer dedicated tools over `Bash`.** `Read` for file contents (it takes
  `offset`/`limit` for ranged reads), `Glob` for path patterns, `Grep` for
  content searches, `Edit`/`Write` for changes. Reach for `Bash` only when
  shell semantics are actually required (git, package manager, docker, curl).
  `cat`/`ls`/`grep`/`find` from Bash prompt where the dedicated tool would
  not.
- **No compound shell in `Bash` calls** — no `&&`, `||`, `|`, `;`,
  subshells, or redirects (`>`, `>>`, `<`, `2>&1`). Split into separate
  `Bash` tool uses in the same message (they run in parallel) rather than
  chaining. Don't pipe build/test output through `tail`/`head`; run the bare
  command.
- **No `cd <path> && …`.** Commands resolve from the repo root. Prefixing
  with `cd` turns an allowed command into a denied compound.
- **No bare `rm`, no `mkdir`.** Use `git rm <path>` for tracked files,
  `Write` to overwrite, and `Write` to a path inside a missing directory to
  auto-create the parent.
- **Never run `find /`.** The container filesystem is large and the probe
  takes minutes. To locate a binary use `which`/`command -v`/`type`, or
  check known install dirs (`~/.local/bin`, `/usr/local/bin`, `/usr/bin`,
  `/opt/homebrew/bin`). If a tool isn't on `PATH`, treat it as not
  installed.
- **Brief subagents with this discipline — they don't inherit it.** An
  `Explore` / `general-purpose` subagent reaches for `sed`, `grep`, `cat`,
  `find` by reflex, and each prompts the user from inside the run. For
  read-only exploration, tell the agent to use only `Read`/`Glob`/`Grep`,
  note that `Read` takes `offset`/`limit` for ranged reads, and forbid the
  `Bash` tool outright. If a subagent genuinely needs Bash, still pass the
  no-compound-shell / no-`cd` rules.

Widening the allowlist in `.claude/settings.local.json` is the user's call,
not Claude's.

## Stay in your worktree

If running inside a worktree (path like `.../.claude/worktrees/<name>/`),
that directory is the workspace. Do not edit, write to, or run commands that
modify files outside it — the main checkout and sibling worktrees may hold
uncommitted or in-progress work from parallel agents. Read-only git queries
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
