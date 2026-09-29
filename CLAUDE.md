# Книга рецептов (recipe)

Личная авторская книга рецептов с публичным доступом: быстрый поиск, пересчёт с КБЖУ, ИИ-импорт
рецепта в черновик с публикацией только владельцем; RU + EN, SEO, mobile-first.
Стек: Next.js 16.3 + TypeScript 6 + Drizzle/PostgreSQL 17 + next-intl, Node 24, pnpm 12 (ADR-0011…0014,
`core/architecture.md`). Прод: https://mycoruja.food, деплой — `core/deployment.md`.
Стадия: каркас (план `stack-and-skeleton`); дальше — правила округления (`project-state.md`).

## Память
Tier 0 (всегда): этот файл + INDEX + `.claude/rules/*.md`. Остальное — по decision tree в INDEX.
Сначала читай `source-of-truth.md` (истина при конфликте) и `project-state.md` (где проект сейчас).

@.memory_bank/INDEX.md

## Критично
- **План first, code second** — `.claude/rules/agent-workflow.md`. Без явного «деплой» код не пишем.
- **Конец задачи = `/memory-check`**; план не `completed`, пока audit не «чисто».
- **Канон требований** — ТЗ + продуктовые решения владельца (`_intake/_processed/brief/`); при
  расхождении побеждают продуктовые решения (они позже) — `source-of-truth.md`.
- **ИИ — только на входе** (импорт, распознавание, перевод); поиск, пересчёт, округление, КБЖУ —
  обычный код (ADR-0008). ИИ создаёт черновик, публикует только владелец (ADR-0006).
- **Source of truth кода:** текущий codebase + `project-state.md`.
- Общение с владельцем и интерфейс — по-русски (EN — вторая языковая версия сайта).

## Команды
Node 24 (`.nvmrc`); старт: `cp .env.example .env.local && pnpm install && pnpm db:up` (Postgres :5434).
`pnpm dev` (:3010) · `lint` · `typecheck` · `test` · `test:db` · `db:generate` · `db:migrate` · `build` ·
`e2e` (`E2E_BASE_URL=…`). Next 16 — сверяйся с `node_modules/next/dist/docs/`.

## Компакция
Сохранять: активный план (slug, статус), изменённые файлы, команды build/test, next steps,
содержимое `.memory_bank/_intake/session-scratch.md`.

## Правила (.claude/rules/)
Всегда: `agent-workflow.md` (план→деплой), `memory-discipline.md` (память), `codex-adviser.md`
(когда обязателен совет Codex). По файлам: `code-standards.md` (TS/Zod), `ui-rules.md` (mobile-first UI).
