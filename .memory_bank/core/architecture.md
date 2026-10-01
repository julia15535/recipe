---
tier: 1
topic: architecture
scope: Стек, слои, SEO-рендер, где ИИ, деплой — перед архитектурным решением
tier2: ""
updated: 2026-10-01
importance: high
source: manual
status: working
source_of_truth: supporting
last_verified: 2026-10-01
review_after: 2026-10-29
---

# Архитектура — Tier 1 сводка

## Стек (утверждён, ADR-0011…0014)
Node 24 · pnpm 12 · Next.js 16.3 App Router (`output: "standalone"`, `cacheComponents`) · React 19 ·
TypeScript 6 strict · Tailwind 4 + Untitled UI React (ADR-0015) · Zod 4 · next-intl 4 · Drizzle + PostgreSQL 17 ·
Vitest 4 + Playwright.

## Маршруты
- `app/(public)/[locale]/` — публичный сайт, `/ru` `/en` статические (`next/root-params` в
  `i18n/request.ts`); неизвестный путь → локализованная 404 (`app/(public)/[locale]/[...rest]/page.tsx`), вне
  локалей — `app/not-found.tsx`.
- `app/(admin)/admin/` — админка, свой root layout, только RU, `noindex`.
- `proxy.ts` — один на приложение: next-intl для публичных путей, `/admin` мимо; `www` → apex —
  `redirects()` в `next.config.ts` (покрывает и файлы, и `/api`).
- `app/api/health/live` (без БД), `app/api/health/ready` (БД + `GIT_SHA`) — по нему деплой сверяет релиз.

## Слои кода
- `lib/domain/` — будущий слой чистых функций без IO (пересчёт, округление); папки пока нет, правило
  ESLint на импорты фреймворка/БД уже действует (`eslint.config.mjs`).
- `lib/server/` — `server-only`: env (`env.ts`), БД (`lib/server/db/client.ts`), логгер с маскированием
  (`log.ts`); без `server-only` намеренно — `env-schema.ts` (его берут instrumentation и тесты) и
  `lib/server/db/schema/index.ts`. UI в БД не ходит.
- Env: публичное (`SITE_URL`, `SITE_INDEXABLE`) запекается при сборке; секреты (`DATABASE_URL`)
  лениво; прод без них не стартует (`instrumentation-node.ts`).
- Миграции: `drizzle-kit generate` → `scripts/migrate.mjs` (advisory lock); роли —
  `deploy/recipe-roles.sql`.

## Направления для следующих планов
- Кэш публичных страниц: `"use cache"` + `cacheTag` (`recipe:{id}`, `recipes`, `category:{id}`,
  `tag:{id}`, `catalog`), правка владельцем → `updateTag` (ADR-0013).
- Фоновые задачи импорта: очередь-таблица в Postgres (`FOR UPDATE SKIP LOCKED`), воркер — отдельный
  контейнер из того же образа. Загрузки — потоковый Route Handler с лимитами, не Server Actions.
- Вход — порт sup2 D10; ИИ — fetch-клиент через Vercel AI Gateway (как sup2).
- Rate limit входа и импорта — прокси + лимит в Postgres. Slug по локалям — в плане схемы БД.
- Критический CVE Next/React — обновление в тот же день.

**Деплой и прод:** `core/deployment.md`.
