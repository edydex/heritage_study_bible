# syntax=docker/dockerfile:1.7

FROM node:24.15-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

FROM base AS builder
ARG TRANSLATION_PROCESSOR_URL=http://translation-processor:4310
ENV TRANSLATION_PROCESSOR_URL=$TRANSLATION_PROCESSOR_URL
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
# Both migrations and sermon-media maintenance use this image. Match the
# runtime's 1001:1001 identity, including when Compose selects that user for
# private recording access. Installer source is private (umask 077), so its
# copied files must belong to the identity that runs these commands.
RUN addgroup -S -g 1001 nodejs \
  && adduser -S -D -H -u 1001 -G nodejs nextjs
COPY --from=dependencies --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs package.json package-lock.json next.config.ts tsconfig.json ./
COPY --chown=nextjs:nodejs packages ./packages
COPY --chown=nextjs:nodejs src ./src
COPY --chown=nextjs:nodejs scripts ./scripts
USER nextjs
CMD ["npm", "run", "migrate"]

FROM base AS runner
ARG TRANSLATION_PROCESSOR_URL=http://translation-processor:4310
ENV TRANSLATION_PROCESSOR_URL=$TRANSLATION_PROCESSOR_URL
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    HOME=/tmp \
    XDG_CACHE_HOME=/tmp/.cache

RUN addgroup -S -g 1001 nodejs \
  && adduser -S -D -H -u 1001 -G nodejs nextjs \
  && mkdir -p \
    /app/media \
    /app/private/sermon-media/staging \
    /app/private/sermon-media/objects \
    /app/.next/cache \
  && chown -R nextjs:nodejs /app/media /app/private /app/.next \
  && chmod 0700 \
    /app/private \
    /app/private/sermon-media \
    /app/private/sermon-media/staging \
    /app/private/sermon-media/objects

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
