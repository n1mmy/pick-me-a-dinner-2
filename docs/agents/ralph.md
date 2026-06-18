# Ralph loop configuration

Project-specific configuration for the Ralph orchestrator (the
`orchestrate-ralph` skill). Written by `setup-ralph`; edit by hand any time.

The orchestrator and its workers read this file at the start of every run.

## Verification gate

The ordered list of commands every change must pass. A worker runs the gate
before committing; the orchestrator re-runs it on the integration branch after
each round. Every command must exit zero. Order matters — cheap checks first.

```
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm build
```

Invoked through `corepack pnpm`, not bare `pnpm`: on the Linux container a
worktree shell has no `pnpm` on `$PATH`. `test` is the unit suite (`vitest
run`) only — `test:db` is deliberately excluded, since a fresh worker worktree
has no live Postgres. The whole gate passes with no `.env` (verified): the
build needs no env vars (see `lib/check-env.ts`), and the unit tests touch no
database.

## Env bootstrap

```
corepack pnpm install --frozen-lockfile
```

A fresh git worktree checks out only tracked files, so it has no `node_modules`
(gitignored) and the gate's `tsc` / `next` / `vitest` binaries are absent until
this runs. No `.env` is materialised — the gate is env-free, so a worker needs
none. (If a future gate command starts reading env, copy the committed,
secret-free `.env.ralph`: `cp .env.ralph .env`.)

## Parallelism

`parallel-safe: false`

The local-markdown tracker exposes no machine-readable dependency relation (no
`Blocked by:` line — see the "Ralph loop" section of
`docs/agents/issue-tracker.md`), so the orchestrator cannot order issues and
parallel waves are unsafe. Run serially.

## Protected paths

Never modified by a worker or the orchestrator:

- `.ralph/` — the orchestrator's worker settings.
- `docs/agents/ralph.md` — this file.
