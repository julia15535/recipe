# syntax=docker/dockerfile:1.7
# Прод-образ книги рецептов (ADR-0014). Собирается ТОЛЬКО в CI; этот же образ проходит e2e и уходит в
# прод по digest. На сервере сборок нет (1 vCPU делится с соседними сервисами).

FROM node:26-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Публичная конфигурация запекается в HTML при сборке; секреты рантайма сюда не передаются.
ARG SITE_URL
ARG SITE_INDEXABLE=false
ARG GIT_SHA=unknown
ENV NEXT_TELEMETRY_DISABLED=1 \
    SITE_URL=$SITE_URL \
    SITE_INDEXABLE=$SITE_INDEXABLE \
    GIT_SHA=$GIT_SHA
RUN pnpm build && pnpm build:migrator

FROM node:26-alpine AS run
WORKDIR /app
ARG GIT_SHA=unknown
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    GIT_SHA=$GIT_SHA
LABEL org.opencontainers.image.source="https://github.com/julia15535/recipe" \
      org.opencontainers.image.revision=$GIT_SHA
RUN addgroup -S -g 10001 app && adduser -S -u 10001 -G app app
# Код принадлежит root и только читается; писать приложение может лишь в tmpfs (.next/cache, /tmp).
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/migrator ./migrator
COPY --from=build /app/drizzle ./drizzle
RUN mkdir -p .next/cache && chown app:app .next/cache
USER 10001
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
