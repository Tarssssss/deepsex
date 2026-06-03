# DeepSex — container image.
#
# Runs `next start` as a single long-lived process with a real shell and a
# writable workspace, so the coding-agent tools (write_file / edit_file /
# run_command) actually work — unlike serverless, where the FS is read-only
# and each request may hit a different instance.

# ---- build stage ----
FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime stage ----
FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# The sandbox the agent reads/writes/runs inside. Mount a volume here for
# persistence across deploys (otherwise the workspace resets on each deploy).
ENV AGENT_WORKSPACE=/app/workspace

# git + ca-certs so run_command can do common things (clone, https). Add more
# tools here (e.g. python3) if your agent needs them.
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Bring over the built app, dependencies, and the seeded demo workspace.
COPY --from=build /app ./

EXPOSE 3000
# next start honours the PORT env var and binds 0.0.0.0 by default.
CMD ["npm", "run", "start"]
