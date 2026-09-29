---
tier: 1
topic: deployment
scope: CI/CD, прод, автодеплой, откат, бэкапы
tier2: ""
updated: 2026-09-29
importance: high
source: manual
status: working
source_of_truth: supporting
last_verified: 2026-09-29
review_after: 2026-10-29
---

# Деплой и прод — Tier 1 сводка (ADR-0014)

## Путь релиза
1. PR / push в `main` → GitHub Actions `.github/workflows/ci.yml`: `check` (lint, typecheck, test,
   миграции) → `image` (образ собирается **один раз**, на нём миграции, тесты БД, e2e, отказы) →
   `publish` (только текущий HEAD `main`, только если менялся код): `ghcr.io/julia15535/recipe:<sha>`,
   затем `:stable`. Docs-only коммиты образ не собирают; «менялся ли код» на main считается от
   ревизии, опубликованной в `:stable` (`scripts/ci/published-revision.sh`).
2. Сервер сам забирает `:stable` каждые 5 минут (`deploy/recipe-deploy.sh` + `.timer`): точка отката
   фиксируется до pull → миграция одноразовым контейнером → кандидат во внутренней сети → swap →
   smoke по SHA. Сбои: миграция — прод на прежней версии, повтор на следующем тике; кандидат не
   поднялся — прод не трогаем, образ в карантин (`/opt/recipe/state/failed-images`); smoke после
   swap — откат (при нужде pull из GHCR) и карантин. Таблица и разовая настройка — `deploy/README.md`.
3. Модель — sup2 (грабли: `9>&-` у docker run, `KillMode=process`), но на сервере ничего не
   собирается: 1 vCPU общий с соседними сервисами.

## Прод
- Домен `mycoruja.food` (+ `www` → 301). Сервер — общий хост владельца за общим `nginx-proxy` +
  `acme-companion` (сеть `webproxy`); детали хоста — только `_secrets/ACCESS.md` (репо публичный).
- `recipe-web` (read-only, без capabilities) и `recipe-db` (Postgres 17) — с лимитами CPU/RAM и
  OOM-приоритетом; как создан `recipe-db` — `deploy/README.md`.
  Секреты: `/opt/recipe/web.env` (только `recipe_app`) и `/opt/recipe/migrate.env` (отдельно).
- До запуска сайт закрыт: `SITE_INDEXABLE=false` → `robots.txt` Disallow + `noindex`.

## Бэкап (решение владельца 29.09)
Сервер: `deploy/recipe-db-backup.sh` раз в сутки, `pg_dump -Fc`, ≤ 7 дней. Локально у владельца:
`deploy/local/recipe-backup-pull.sh` (user-таймер, ≤ 7 дней + проверки ready/свежести/диска) и
еженедельное восстановление `deploy/local/recipe-restore-drill.sh`.

## Открыто
Канал алертов (Telegram) — пока итоги проверок только в журнале.
