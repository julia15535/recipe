---
tier: 1
topic: architecture
scope: Стек, слои, SEO-рендер, где ИИ, деплой — перед архитектурным решением
tier2: ""
updated: 2026-10-02
importance: high
source: manual
status: working
source_of_truth: supporting
last_verified: 2026-10-02
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
- `app/(admin)/admin/` — кабинет: свой root layout, RU, `noindex`, полностью динамический; открыт только
  `login/`, остальное — группа `(protected)` с пробными экранами `ui/` (ADR-0022, `domain/owner-auth.md`).
- `proxy.ts` — next-intl для публичных путей; `/admin` — CSP с nonce и 307 на вход без cookie сессии;
  `www` → apex — `redirects()` в `next.config.ts`.
- API: `health/live`, `health/ready` (БД + `GIT_SHA` — по нему деплой сверяет релиз), `telegram/webhook`, `auth/status`.

## Слои кода
- `lib/domain/` — чистые функции без IO (ESLint `eslint.config.mjs`): дроби, пересчёт, разбор текста рецепта
  (`lib/domain/recipe-text/`), коды каталога.
- `lib/server/` — `server-only`: env, БД (`lib/server/db/client.ts`), логгер с маскированием (`log.ts`), вход
  (`lib/server/auth/`, `requireOwner()`), рецепты (`lib/server/recipes/`); без него намеренно — `env-schema.ts`, схема БД и чистые модули входа.
  UI в БД не ходит.
- Env: публичное (`SITE_URL`, `SITE_INDEXABLE`) запекается при сборке; секреты (`DATABASE_URL`)
  лениво; прод без них не стартует (`instrumentation-node.ts`).
- Миграции: `drizzle-kit generate` → `scripts/migrate.mjs` (advisory lock); роли —
  `deploy/recipe-roles.sql`.

## Направления для следующих планов
- Кэш публичных страниц: `"use cache"` + `cacheTag` (`recipe:{id}`, `recipes`, `category:{id}`,
  `tag:{id}`, `catalog`), правка владельцем → `updateTag` (ADR-0013).
- Импорт: очередь-таблица в Postgres (`FOR UPDATE SKIP LOCKED`), воркер — контейнер из того же образа;
  загрузки — потоковый Route Handler с лимитами.
- ИИ на входе — `lib/server/ai/` (fetch-клиент Vercel AI Gateway, ADR-0024); фото и голос — тем же путём.
- Критический CVE Next/React — обновление в тот же день.

**Деплой и прод:** `core/deployment.md`.
