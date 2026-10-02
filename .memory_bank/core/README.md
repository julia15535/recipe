# Core — Tier 1 короткие сводки

> Файлы по 2–3 KB. Читаются как первый drill-down из `INDEX.md`. Каждый имеет frontmatter
> (`topic`/`tier:1`/`scope`/`tier2`/`updated`) и финальную строку `Tier 2:` для расширения.
> Шаблон новой сводки — `_template.md`. Типовые темы: `product`, `architecture`, `data-models`,
> `flows`, `access-and-integrations` (+ домен-специфичные).

## Реестр сводок

<!-- GENERATED:core-registry START -->
<!-- Таблицу регенерирует tools/memory-audit.mjs из frontmatter. Не редактируй вручную. -->

| Файл | topic | Когда читать (scope) | Tier 2 | updated |
|------|-------|----------------------|--------|---------|
| `access-and-integrations.md` | access-and-integrations | Внешние сервисы (ИИ, STT, Telegram, хостинг) и где ключи | — | 2026-10-02 |
| `architecture.md` | architecture | Стек, слои, SEO-рендер, где ИИ, деплой — перед архитектурным решением | — | 2026-10-02 |
| `auth-publishing.md` | auth-publishing | Вход владельца через Telegram, права посетителей, публикация рецепта | `../domain/owner-auth.md` | 2026-10-02 |
| `catalog.md` | catalog | Каталог — категории по типу блюда, подкатегории, теги, правка из админки | `../domain/catalog-structure.md` | 2026-10-01 |
| `data-models.md` | data-models | Сущности — рецепт, ингредиенты, шаги, справочники, категории/теги | `../domain/recipe-model.md` | 2026-10-02 |
| `deployment.md` | deployment | CI/CD, прод, автодеплой, откат, бэкапы | — | 2026-10-02 |
| `ingredients.md` | ingredients | Справочник ингредиентов — иерархия, единицы, граммовые эквиваленты, КБЖУ | `../domain/recipe-model.md` | 2026-10-02 |
| `lessons.md` | lessons | Перед планированием — уроки; что пробовали и что НЕ сработало, отброшенные подходы | `../anti-patterns.md` | 2026-10-02 |
| `recipe-import.md` | recipe-import | Добавление рецепта — ИИ-импорт (текст, голос, фото, PDF/Word), предпросмотр | `../domain/ai-import.md` | 2026-10-01 |
| `rescaling.md` | rescaling | Пересчёт от основного ингредиента, производные порции, неизменяемый якорь, правила округления | `../domain/rounding-rules.md` | 2026-10-02 |
| `search.md` | search | Поиск — «По рецепту / По ингредиенту», иерархия, уточнение категорией и тегом | `../domain/search-spec.md` | 2026-10-02 |
| `ux.md` | ux | Экраны и mobile-first — главная, страница рецепта, работа одной рукой | `../domain/screens.md` | 2026-10-02 |
| `flows.md` | flows | Сквозные сценарии посетителя и владельца, статусы рецепта | — | 2026-09-27 |
| `seo-i18n.md` | seo-i18n | SEO публичных страниц, RU + EN, URL-схема, SEO-футер | — | 2026-10-02 |
<!-- GENERATED:core-registry END -->

> Реестр и decision tree в INDEX регенерирует `tools/memory-audit.mjs` (или `/memory-check`
> вручную, без Node). Создал сводку — проставь frontmatter и запусти аудит: он сам впишет её
> и в реестр, и в decision tree. Руками таблицы не правим.
