---
tier: 1
topic: access-and-integrations
scope: Внешние сервисы (ИИ, STT, Telegram, хостинг) и где ключи
tier2: ""
updated: 2026-09-27
importance: high
source: manual
status: draft
source_of_truth: supporting
last_verified: 2026-09-27
review_after: 2026-10-27
---

# Доступы и интеграции — Tier 1 сводка

> Реестр интеграций (anti-rediscovery): перед подключением сервиса — сверься здесь. Значения
> ключей — только в `.memory_bank/_secrets/ACCESS.md` (вне git); в остальной памяти — указатели.

## Состояние на 27.09.2026
Ни одна интеграция не подключена, ключей нет.

| Нужно | Для чего | Статус |
|-------|----------|--------|
| LLM (текст + vision) | структурирование рецепта, фото/скриншоты, нормализация единиц, перевод RU→EN | провайдер не выбран; у владельца в sup2 — Vercel AI Gateway |
| Speech-to-Text | голосовой рецепт с телефона | не выбран |
| Извлечение текста | PDF (текстовый слой / OCR), DOC/DOCX, TXT | библиотеки не выбраны |
| Telegram-бот | вход владельца по телефону | бот не заведён; образец — sup2 (D10) |
| Хостинг + домен | прод | домен `mycoruja.food`; сервер — общий зарубежный хост владельца за общим `nginx-proxy` (детали — `_secrets/ACCESS.md`) |
| Хранилище файлов | фото блюд, исходники импорта | не выбрано |
| Git-remote | репозиторий | `github.com/julia15535/recipe` (публичный); push по SSH ключом владельца; `gh` агента — `igortsk123` (collaborator, Write) |
| GHCR | образ прода | `ghcr.io/julia15535/recipe` — публикует CI `GITHUB_TOKEN` (`.github/workflows/ci.yml`), сервер тянет анонимно (`core/deployment.md`) |
| Codex CLI | независимый советник, read-only | доступен локально (`codex exec`) |

## Правило
Подключил сервис → строка здесь (эндпоинт, где ключ, клиент в коде) + ключ в `_secrets/ACCESS.md`.
