# Starting the dev server

"Start the dev server" (no further qualifiers) means, specifically:

1. Copy `.env.k8s` from the main checkout into this worktree as `.env.local`
   (Next.js loads `.env.local` automatically, ahead of `.env`).
2. `corepack pnpm install --frozen-lockfile` if `node_modules` is missing.
3. `corepack pnpm exec next dev -H 0.0.0.0` — bound to `0.0.0.0`, not the
   default `localhost`, so it's reachable from outside the container.

Run it in the background and check the log for `✓ Ready` (and an HTTP
request actually returning a response) before reporting it started — a
silent hang is not a running server.

## Known container issue: inotify watcher limits

Running from a git worktree nested under the main checkout
(`.claude/worktrees/<name>/`), Next.js can find the *outer* repo's
`pnpm-lock.yaml` while walking up looking for a workspace root and infer
that as the project root instead of the worktree itself. In dev mode this
makes it watch the whole outer tree — every sibling worktree included —
which can exhaust the container's `fs.inotify` limits (`ENOSPC: System
limit for number of file watchers reached`, spamming the log forever
instead of ever reaching `✓ Ready`).

Both parts of the fix are already in place:

- `next.config.ts` sets `outputFileTracingRoot: __dirname` to pin the root
  to this worktree.
- The container's inotify limits were raised:
  `sudo sysctl fs.inotify.max_user_watches=524288
  fs.inotify.max_user_instances=1024` (machine-wide, resets on reboot).

If a fresh container still hits `ENOSPC`, the sysctl bump is the part that
doesn't persist — re-run it.
