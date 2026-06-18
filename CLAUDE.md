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

Prompt the user as little as possible — every avoidable permission prompt is
friction. Bash calls go through a permission matcher; when there is more than
one way to run something, choose the shape it already clears. How the matcher
actually behaves (empirically catalogued; it is built-in, undocumented, and can
drift across Claude Code versions, so re-verify if a result surprises you):

- **Compounds are decomposed, not rejected wholesale.** `&&`, `||`, `;`, `|`,
  and `&` are split into their stages, and the compound clears iff *every* stage
  independently clears (against the allowlist or a safe list below). A compound
  does **not** prompt merely for being compound — only when some stage isn't
  itself allowed. So `git add <paths> && git commit -m x` is fine when both
  halves are allowed. **But** command substitution `$(…)` / backticks are
  rejected as a distinct shape, and an unescaped `*`, or any literal `$` byte
  (even backslash-escaped as `\$`), in an argument is rejected outright — keep
  those out of Bash args.
- **Two built-in safe lists clear with no allow rule.** Read-only Bash commands
  — `cat`, `head`, `tail`, `wc`, `grep`, `find`, `ls`, `stat`, `echo`, `printf`,
  `which`, `type`, `realpath`, `dirname`, `basename`, `test` — and read-only git
  subcommands — `log`, `diff`, `show`, `status`, `blame`, `rev-parse`,
  `ls-files`, `for-each-ref`, `worktree list` — run without prompting.
  `sed`/`awk` (verified — both prompt), `env`/`printenv`, `rm`/`mkdir`/`rmdir`,
  and `git config`/`push`/`fetch` are **not** on the lists — treat them as
  prompting; use `Read`/`Edit` or a safe-listed reader instead.
- **Path-locality gate.** For the path-taking readers (`cat`/`head`/`tail`/
  `wc`/`grep`/`find`/`ls`/`stat`/`rmdir`), an argument that is an absolute path
  **outside the working directory** is rejected even though the command is
  safe-listed — so `cat /etc/passwd` and `find /` are blocked, while in-worktree
  paths clear. (git's read subcommands bypass this gate.)
- **First-token shape.** A first token containing `/` — a full path like
  `/usr/bin/git` or a `./relative` form — misses the lookup and is rejected even
  for an otherwise-allowed command.

The actionable rules that follow from this:

- **Prefer dedicated tools over `Bash`.** `Read` for file contents (ranged
  `offset`/`limit`, images, PDFs), `Edit`/`Write` for changes. For search use
  the `Glob`/`Grep` tools if your build exposes them, otherwise `Bash` —
  `rg`/`grep` for content, `find` for paths, `git ls-files` for tracked files.
  (Native macOS/Linux builds drop `Glob`/`Grep` and fold search into Bash;
  npm-installed builds keep them.) `cat`/`head` don't prompt for in-worktree
  files, but `Read` is still better — ranged reads, images, no path-locality
  limit. Reach for `Bash` when shell semantics are genuinely required (git,
  package manager, docker, curl).
- **Run commands bare from the working directory.** No full path
  (`/opt/homebrew/bin/pnpm`), no `./x` first token, and no `git -C <path>` for
  your own checkout — the cwd is already the repo/worktree root, so
  `git status`, `git add <paths>`, and `git commit` resolve with no `-C`. Each
  `/`-bearing first token misses the lookup. Use a full path or `-C` only when
  genuinely targeting something off `$PATH` or a different checkout.
- **No `cd <path> && …`.** Commands already resolve from the repo root and `cd`
  isn't allowlisted, so the compound fails on the `cd` stage.
- **No bare `rm`, no `mkdir`** (neither is safe-listed). Use `git rm <path>`,
  `Write` to overwrite, and `Write` to a path inside a missing directory to
  auto-create the parent.
- **Keep `$(…)`, unescaped `*`, and `$VAR` out of Bash args** — the matcher
  rejects all three regardless of quoting. Let a dedicated tool or a literal
  path stand in.
- **Brief subagents with this discipline — they don't inherit it.** An
  `Explore` / `general-purpose` subagent reaches for `sed`/`awk`, full paths,
  outside-cwd reads, and `$(…)` by reflex. For read-only exploration, tell the
  agent to use `Read` (ranged `offset`/`limit`) plus the search rule above. On
  an npm build
  with `Glob`/`Grep` you can forbid the `Bash` tool outright; on a native build
  it needs `Bash` for search, so pass it the bare-shape / in-worktree-path /
  no-`$(…)` rules.

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

## Agent skills

### Issue tracker

Issues are tracked as local markdown files under `.issues/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles use their default strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Ralph loop

Loop config and worker permissions. See `docs/agents/ralph.md`.

## Design System

Always read `DESIGN.md` before making any visual or UI decision. Font choices,
colors, spacing, layout, radius, and motion are all defined there — do not
deviate without explicit user approval. In QA or review, flag any code that
does not match `DESIGN.md`. As of 2026-05-16 the live code (`app/globals.css`,
`tailwind.config.ts`, fonts, the `app/app-nav.tsx` layout shell, and the
screens) implements `DESIGN.md`.
