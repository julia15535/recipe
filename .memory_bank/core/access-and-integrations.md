---
tier: 1
topic: access-and-integrations
scope: Внешние сервисы (ИИ, STT, Telegram, хостинг) и где ключи
tier2: ""
updated: 2026-10-02
importance: high
source: manual
status: draft
source_of_truth: supporting
last_verified: 2026-10-02
review_after: 2026-10-27
---

# Доступы и интеграции — Tier 1 сводка

> Реестр интеграций (anti-rediscovery): перед подключением сервиса — сверься здесь. Значения
> ключей — только в `.memory_bank/_secrets/ACCESS.md` (вне git); в остальной памяти — указатели.

## Состояние на 29.09.2026
Подключены: GitHub (репо + Actions), GHCR, прод-хостинг с доменом и Let's Encrypt. ИИ, STT,
Хранилище файлов — ещё нет; Telegram-бот — вход владельца в кабинет (02.10).

| Нужно | Для чего | Статус |
|-------|----------|--------|
| LLM (текст + vision) | структурирование рецепта, фото/скриншоты, нормализация единиц, перевод RU→EN | провайдер не выбран; у владельца в sup2 — Vercel AI Gateway |
| Speech-to-Text | голосовой рецепт с телефона | не выбран |
| Извлечение текста | PDF (текстовый слой / OCR), DOC/DOCX, TXT | библиотеки не выбраны |
| Telegram-бот | вход владельца (ADR-0022), позже уведомления | `@mycoruja_recipes_bot` («Книга рецептов», владелец 02.10). Webhook `POST /api/telegram/webhook` (заголовок-секрет), ответы — Bot API `sendMessage`/`editMessageText`/`answerCallbackQuery` (`lib/server/auth/telegram.ts`); включение — `scripts/telegram-webhook.mjs`. Env на сервере (`web.env`): `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, `OWNER_TELEGRAM_ID`; значения — `_secrets/ACCESS.md` |
| Хостинг + домен | прод | домен `mycoruja.food`; сервер — общий зарубежный хост владельца за общим `nginx-proxy` (детали — `_secrets/ACCESS.md`) |
| Хранилище файлов | фото блюд, исходники импорта | не выбрано |
| Git-remote | репозиторий | `github.com/julia15535/recipe` (публичный); push по SSH ключом владельца; `gh` агента — `igortsk123` (приглашён с Write, приглашение принять в браузере; fine-grained токен не открывает PR в чужих репо) |
| GHCR | образ прода | `ghcr.io/julia15535/recipe` — публикует CI `GITHUB_TOKEN` (`.github/workflows/ci.yml`), сервер тянет анонимно (`core/deployment.md`) |
| Codex CLI | независимый советник, read-only | доступен локально (`codex exec`) |

## Правило
Подключил сервис → строка здесь (эндпоинт, где ключ, клиент в коде) + ключ в `_secrets/ACCESS.md`.
