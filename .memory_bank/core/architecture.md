---
tier: 1
topic: architecture
scope: Стек, слои, SEO-рендер, где ИИ, деплой — перед архитектурным решением
tier2: ""
updated: 2026-10-06
importance: high
source: manual
status: working
source_of_truth: supporting
last_verified: 2026-10-03
review_after: 2026-10-29
---

# Архитектура — Tier 1 сводка

## Стек (утверждён, ADR-0011…0014)
Node 24 · pnpm 12 · Next.js 16.3 App Router (`output: "standalone"`, `cacheComponents`) · React 19 ·
TypeScript 6 strict · Tailwind 4 + Untitled UI React (ADR-0015) · Zod 4 · next-intl 4 · Drizzle + PostgreSQL 17 ·
Vitest 4 + Playwright.

## Маршруты
- `app/(public)/[locale]/` — сайт ru/en (ADR-0027, ADR-0029): главная, `catalog/[slug]`, `recipe/[slug]`, `search`, `articles` (ADR-0034, пока RU);
  данные — под `<Suspense>` после `io()` из `"use cache"` (`public-cache.ts`), сборка без БД; локаль — `next/root-params`.
- `app/(admin)/admin/` — кабинет: свой root layout, RU, `noindex`, полностью динамический; открыт только
  `login/`, остальное — группа `(protected)`: рецепты (`recipes/…`, фото), статьи (`articles/…`), пробные экраны `ui/` (ADR-0022).
- `proxy.ts` — next-intl (`/` по языку браузера); `/admin` — CSP с nonce и 307 на вход; `www` → apex — `next.config.ts`.
- API: `health/live`, `health/ready` (БД + `GIT_SHA`), `telegram/webhook`, `auth/status`; фото —
  `app/media/{recipe,article}/[photoId]/[file]/route.ts` (ADR-0028, ADR-0034; мимо proxy — адрес с точкой); подборщик переводов —
  `/api/jobs/translations` (только сам процесс, секрет в памяти; ADR-0029).

## Слои кода
- `lib/domain/` — чистые функции без IO (ESLint `eslint.config.mjs`): дроби, пересчёт, разбор текста рецепта
  (`lib/domain/recipe-text/`), коды каталога, кадр фото (`lib/domain/photo.ts`).
- `lib/server/` — `server-only`: env, БД (`lib/server/db/client.ts`), логгер с маскированием (`log.ts`), вход
  (`lib/server/auth/`, `requireOwner()`), рецепты (`lib/server/recipes/`), фото (`lib/server/media/`); UI в БД не ходит.
- Env: обязательны `SITE_URL`, `DATABASE_URL`, `GIT_SHA`; вход (Telegram) — все переменные или ни одной, ключ ИИ —
  по желанию; заданное наполовину или с ошибкой — прод не стартует (`instrumentation-node.ts`).
- Миграции: `drizzle-kit generate` → `scripts/migrate.mjs` (advisory lock); роли —
  `deploy/recipe-roles.sql`.

## Направления для следующих планов
- Импорт файлов: очередь-таблица в Postgres (`SKIP LOCKED`), воркер из того же образа, потоковый Route Handler.
- ИИ на входе — `lib/server/ai/` (ADR-0024); распознавание и голос — тем же путём.
- Критический CVE Next/React — обновление в тот же день.

**Деплой и прод:** `core/deployment.md`.
