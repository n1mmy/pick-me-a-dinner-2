import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function nextConfig(phase: string): NextConfig {
  return {
    // Emit a self-contained server bundle so the Docker image ships only the
    // traced dependencies it needs — see the Dockerfile's runner stage.
    output: "standalone",
    // The dev server writes to its own directory. Sharing `.next` with
    // `next build` (run by the verification gate) lets a build overwrite a
    // running dev server's chunks, and the page then 404s its CSS and JS.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
    // Pin the tracing/watch root to this checkout. Without it, Next finds the
    // outer repo's pnpm-lock.yaml when this project sits inside a git worktree
    // (`.claude/worktrees/<name>/`) and infers *that* as the workspace root —
    // then dev-mode watches the whole outer tree, sibling worktrees included,
    // which can exhaust the container's inotify watch/instance limits.
    outputFileTracingRoot: __dirname,
  };
}
