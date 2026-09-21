import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle so the Docker image ships only the
  // traced dependencies it needs — see the Dockerfile's runner stage.
  output: "standalone",
  // Pin the tracing/watch root to this checkout. Without it, Next finds the
  // outer repo's pnpm-lock.yaml when this project sits inside a git worktree
  // (`.claude/worktrees/<name>/`) and infers *that* as the workspace root —
  // then dev-mode watches the whole outer tree, sibling worktrees included,
  // which can exhaust the container's inotify watch/instance limits.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
