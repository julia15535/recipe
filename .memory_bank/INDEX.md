# Memory Bank — Index (Tier 0)

Книга рецептов (recipe) — личная книга рецептов с публичным доступом: быстрый поиск, пересчёт с КБЖУ,
ИИ-импорт в черновик, RU + EN. Стадия: каркас в проде (mycoruja.food), доменного кода ещё нет.

## Минимум правил (всегда)
- **План first** — задача → план-файл → ждать «деплой» (`.claude/rules/agent-workflow.md`).
- **Иди по decision tree ниже** — только нужный Tier 1/Tier 2, не сканируй всё.
- **Не дублируй память** — один факт в одном месте; сводка ≤3 KB со ссылкой на Tier 2.
- **Меняешь архитектуру/контракты → обнови память** (`.claude/rules/memory-discipline.md`).

## Decision tree — что читать

Идём: **Tier 1 (`core/<тема>.md`, сводки)** → drill-down в Tier 2 (`<area>/`, `guides/`) при нехватке.

<!-- GENERATED:decision-tree START -->
<!-- Таблицу регенерирует tools/memory-audit.mjs из frontmatter. Не редактируй вручную. -->

| Задача (scope) | Tier 1 | Tier 2 |
|----------------|--------|--------|
| Внешние сервисы (ИИ, STT, Telegram, хостинг) и где ключи | `core/access-and-integrations.md` | — |
| Стек, слои, SEO-рендер, где ИИ, деплой — перед архитектурным решением | `core/architecture.md` | — |
| Вход владельца через Telegram, права посетителей, публикация рецепта | `core/auth-publishing.md` | `domain/owner-auth.md` |
| Каталог — категории по типу блюда, подкатегории, теги, правка из админки | `core/catalog.md` | `domain/catalog-structure.md` |
| Сущности — рецепт, ингредиенты, шаги, справочники, категории/теги | `core/data-models.md` | `domain/recipe-model.md` |
| CI/CD, прод, автодеплой, откат, бэкапы | `core/deployment.md` | — |
| Справочник ингредиентов — иерархия, единицы, граммовые эквиваленты, КБЖУ | `core/ingredients.md` | `domain/recipe-model.md` |
| Перед планированием — уроки; что пробовали и что НЕ сработало, отброшенные подходы | `core/lessons.md` | `anti-patterns.md` |
| Бизнес-контекст — зачем продукт, для кого, что в scope, критерии успеха | `product_brief.md` | — |
| Добавление рецепта — ИИ-импорт (текст, голос, фото, PDF/Word), предпросмотр | `core/recipe-import.md` | `domain/ai-import.md` |
| Пересчёт от основного ингредиента, производные порции, неизменяемый якорь, правила округления | `core/rescaling.md` | `domain/rounding-rules.md` |
| Поиск — «По рецепту / По ингредиенту», иерархия, уточнение категорией и тегом | `core/search.md` | `domain/search-spec.md` |
| Экраны и mobile-first — главная, страница рецепта, работа одной рукой | `core/ux.md` | `domain/screens.md` |
| Сквозные сценарии посетителя и владельца, статусы рецепта | `core/flows.md` | — |
| SEO публичных страниц, RU + EN, URL-схема, SEO-футер | `core/seo-i18n.md` | — |
<!-- GENERATED:decision-tree END -->

**Правило:** сначала `core/<тема>.md`. Не хватает данных — drill в Tier 2 (указан в конце сводки).

## Always-on docs (Tier 0/1)
- `source-of-truth.md` — разрешение конфликтов источников.
- `project-state.md` — снимок «где проект сейчас» (обновлять после крупных изменений).
- `decisions.md` — ADR-лог архитектурных решений.

## Слои памяти
Канон — этот `.memory_bank/` (в git). Авто-память харнесса — только per-user; мост — `/memory-check`.

## Планы и обслуживание
- Планы: `plans/<slug>.md` (`draft`) → «деплой» → `completed` → `completed_plans/`; шаблон `plans/_template.md`.
- Карта: `core/` — сводки, `domain/` — детали, `guides/` — процесс, `archive/` — устаревшее,
  `changelog/` — история, `_secrets/` — доступы вне git.
- Гигиена: `/memory-check` (или `node tools/memory-audit.mjs`), глубоко — `/memory-cleanup`.
