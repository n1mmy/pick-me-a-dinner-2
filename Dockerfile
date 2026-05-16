# syntax=docker/dockerfile:1
#
# Image for self-hosting on Kubernetes (plan §3). Multi-stage: install, build,
# then a slim runner that ships only the traced Next.js standalone bundle.
# The runner CMD just runs the app — it never migrates. Schema migrations are
# applied out of band by the operator; the image only bundles the migration
# files so the startup schema check can compare them against the DB.

# --- deps: install dependencies with pnpm -------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm@10
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# --- builder: compile the Next.js app ----------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@10
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# --- runner: run the app only — no migration step ----------------------------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# Next.js standalone output: a minimal server with only the traced deps.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Migration files bundled in the image — the startup schema check compares
# these against the DB's __drizzle_migrations table. The entrypoint never
# applies them; migrating is an out-of-band operator step (plan §3).
COPY --from=builder /app/drizzle ./drizzle

USER nextjs
EXPOSE 3000
# Entrypoint runs the app only — it does not migrate.
CMD ["node", "server.js"]
