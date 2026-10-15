# Community v0.1: deliberately localhost-only at the host port mapping layer.
# Uses published multi-architecture Node images; no GitHub token or Redis is needed.
FROM node:22.16.0-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22.16.0-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run typecheck && NEXUS_SELF_HOSTED_BUILD=1 npm run build

FROM node:22.16.0-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
# No build toolchain, .env, node_modules tree, tests or Git metadata in runtime.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/LICENSE ./LICENSE
USER node
EXPOSE 3000
CMD ["node", "server.js"]
