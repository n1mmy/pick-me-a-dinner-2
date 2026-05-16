# 10 — Dockerfile, GHCR workflow, startup schema check

Status: ready-for-agent
Type: AFK

## Parent

[PRD: Pick Me a Dinner — v1](../PRD.md)

## What to build

The deployment artifacts for self-hosting on Kubernetes (PRD §3).

A **Dockerfile** that builds the Next.js app. The container entrypoint **just
runs the app** — it does not migrate. Schema migrations are applied out of band
by the operator; the repo still version-controls the migration files.

A **GitHub Actions workflow** (`.github/workflows/build.yml`) that builds the
image and pushes it to GHCR (`ghcr.io/<owner>/pick-me-a-dinner`) on push to
`main` and on tags.

A **startup schema check**: on boot the app compares the migration files bundled
in the image against the `__drizzle_migrations` table in the DB. If the DB is
behind, it logs a loud, specific error ("DB schema N migrations behind — run
drizzle-kit migrate") and exits non-zero, so the pod crash-loops visibly instead
of serving pages that 500 on missing columns.

## Acceptance criteria

- [ ] The Dockerfile builds the app; the entrypoint runs the app only — no
      migration step
- [ ] `.github/workflows/build.yml` builds and pushes the image to GHCR on push
      to `main` and on tags
- [ ] On boot, a DB behind the bundled migrations produces a loud specific log
      message and a non-zero exit
- [ ] A DB at the current migration boots normally

## Blocked by

- Issue 01 — Walking skeleton (needs migrations to exist)
