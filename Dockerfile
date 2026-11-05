# syntax=docker/dockerfile:1
# ITDash — multi-stage build → small runtime image with Next.js standalone output.
# Build:  docker build -t itdash .
# Multi-arch (Mac mini arm64 + Linux server amd64):
#   docker buildx build --platform linux/arm64,linux/amd64 -t <registry>/itdash:<tag> --push .

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat

# 1) dependencies (cached until package*.json changes)
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 2) build
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT=standalone
RUN npm run build

# 3) runtime — no source, no dev dependencies, non-root user
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 itdash && adduser -S -u 1001 -G itdash itdash
COPY --from=build --chown=itdash:itdash /app/.next/standalone ./
COPY --from=build --chown=itdash:itdash /app/.next/static ./.next/static
COPY --from=build --chown=itdash:itdash /app/public ./public
USER itdash
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health > /dev/null || exit 1
CMD ["node", "server.js"]
