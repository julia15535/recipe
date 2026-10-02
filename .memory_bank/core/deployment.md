---
tier: 1
topic: deployment
scope: CI/CD, прод, автодеплой, откат, бэкапы
tier2: ""
updated: 2026-10-02
importance: high
source: manual
status: working
source_of_truth: supporting
last_verified: 2026-10-02
review_after: 2026-10-29
---

# Деплой и прод — Tier 1 сводка (ADR-0014)

## Путь релиза
1. PR / push в `main`, `feature/**` → GitHub Actions `.github/workflows/ci.yml`:
   `check` (lint, typecheck, test, миграции) → `image` (образ собирается **один раз**, до запуска БД — ADR-0027; на нём миграции,
   тесты БД, e2e с фальшивым ботом, отказы) → `publish` (только `main` с новым кодом):
   `ghcr.io/julia15535/recipe:<sha>`, затем `:stable`. «Менялся ли код» на main — от ревизии в `:stable`
   (`scripts/ci/published-revision.sh`), docs-only образ не собирают.
2. Сервер сам забирает `:stable` каждые 5 минут (`deploy/recipe-deploy.sh` + `.timer`): точка отката
   фиксируется до pull → миграция одноразовым контейнером → кандидат во внутренней сети → swap →
   smoke по SHA. Сбои: миграция — прод на прежней версии, повтор на следующем тике; кандидат не
   поднялся — прод не трогаем, образ в карантин (`/opt/recipe/state/failed-images`); smoke после
   swap — откат (при нужде pull из GHCR) и карантин. Таблица и разовая настройка — `deploy/README.md`.
3. Модель — sup2 (грабли: `9>&-` у docker run, `KillMode=process`); на сервере ничего не собирается.

## Прод
- Домен `mycoruja.food` (+ `www` → 301). Сервер — общий хост владельца за общим `nginx-proxy` +
  `acme-companion` (сеть `webproxy`); детали хоста — только `_secrets/ACCESS.md` (репо публичный).
- `recipe-web` (read-only, без capabilities) и `recipe-db` (Postgres 17) — с лимитами CPU/RAM и
  OOM-приоритетом; как создан `recipe-db` — `deploy/README.md`.
  Секреты: `/opt/recipe/web.env` (`recipe_app`, бот входа, ключ ИИ) и `/opt/recipe/migrate.env`; новый `web.env` —
  через `recipe-deploy.sh --force`; webhook, смена токена, отзыв сессий — `deploy/README.md`.

## Бэкап (решение владельца 29.09)
Сервер: `deploy/recipe-db-backup.sh` раз в сутки, `pg_dump -Fc`, ≤ 7 дней. Локально у владельца:
`deploy/local/recipe-backup-pull.sh` (user-таймер, ≤ 7 дней + проверки ready/свежести/диска) и
еженедельное восстановление `deploy/local/recipe-restore-drill.sh`.

## Открыто
Канал алертов (Telegram) — пока итоги проверок только в журнале.
