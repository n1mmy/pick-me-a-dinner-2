# Starting the dev server

"Start the dev server" (no further qualifiers) means, specifically:

1. Copy `.env.k8s` into this worktree as `.env.local` (Next.js loads
   `.env.local` automatically, ahead of `.env`). Where `.env.k8s` lives
   depends on the machine: on some it is at
   `~/sync/Sync/pick-me-a-dinner-2/.env.k8s`, on others at the root of the
   main checkout. Check both; if it is in neither, ask the user rather than
   hunting through other env files.
2. `corepack pnpm install --frozen-lockfile` if `node_modules` is missing.
3. `env -u ANTHROPIC_API_KEY -u ANTHROPIC_BASE_URL -u ANTHROPIC_CUSTOM_HEADERS WATCHPACK_POLLING=true corepack pnpm exec next dev -H 0.0.0.0` — bound to `0.0.0.0`, not the
   default `localhost`, so it's reachable from outside the container.
   `WATCHPACK_POLLING=true` makes the file watcher poll instead of using
   inotify — see the inotify section below for why. The
   `env -u` strip matters when the server is launched from a Claude Code
   session routed through a model gateway: the session's shell carries
   `ANTHROPIC_BASE_URL`/`ANTHROPIC_API_KEY` for the gateway, the Anthropic SDK
   reads both from the environment, and a shell-set key shadows `.env.local` —
   so AI search silently fails (the swallowed error surfaces only as
   `outcome:"fallback"` in the log) until they're unset.

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

`next.config.ts` sets `outputFileTracingRoot: __dirname` to pin the root
to this worktree, which keeps a healthy dev server to a few dozen watches.

`ENOSPC` can still happen with the limits already raised (524288 watches,
1024 instances), because the container is a Kubernetes pod with no user
namespace (`/proc/self/uid_map` is the identity map). The inotify quota is
counted per uid across the whole node, so every uid-1000 process in every
pod on the node draws from the same pool. Processes you can't see from
inside this pod can use it up. No count you take from inside the pod will
come close to the limit, and the flood comes and goes as those other
processes do. Raising the sysctl again doesn't help.

The fix is `WATCHPACK_POLLING=true` in the start command (step 3). Next's
bundled watchpack then polls and uses zero inotify watches, so the shared
pool no longer matters. Polling this tree (about 60 directories outside
`node_modules`/`.next`) costs little CPU.
