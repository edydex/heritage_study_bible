# syntax=docker/dockerfile:1.7

FROM node:24.15-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

FROM base AS builder
ENV NODE_ENV=production
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

# This target retains the Payload CLI and TypeScript sources for explicit
# maintenance commands such as `docker compose run --rm migrate`.
FROM base AS migrations
ENV NODE_ENV=production \
    HOME=/tmp \
    XDG_CACHE_HOME=/tmp/.cache
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json next.config.ts tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
USER node
CMD ["npm", "run", "migrate"]

FROM base AS runner
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    HOME=/tmp \
    XDG_CACHE_HOME=/tmp/.cache

RUN addgroup -S -g 1001 nodejs \
  && adduser -S -D -H -u 1001 -G nodejs nextjs \
  && mkdir -p /app/media /app/.next/cache \
  && chown -R nextjs:nodejs /app/media /app/.next

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
