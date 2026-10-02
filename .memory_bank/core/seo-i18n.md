---
tier: 1
topic: seo-i18n
scope: SEO публичных страниц, RU + EN, URL-схема, SEO-футер
tier2: ""
updated: 2026-10-02
importance: med
source: _intake/_processed/brief/technical_spec_recipe_book.md
status: draft
source_of_truth: supporting
last_verified: 2026-10-02
review_after: 2026-12-27
---

# SEO и языки — Tier 1 сводка

## Приоритет
SEO в списке MVP, но по решению владельца **вторичен**: сначала быстрый поиск, удобство при готовке,
быстрое добавление, удобство делиться.

## SEO (ТЗ §19)
SSR/SSG · уникальный URL рецепта · человекочитаемые slug · title · meta description · Open Graph
(важно для ссылок в Instagram и мессенджерах) · canonical · sitemap.xml · robots.txt ·
Schema.org Recipe (JSON-LD) · хлебные крошки · индексируемые страницы категорий, подкатегорий,
тегов — на обоих языках.

## SEO-футер (ТЗ §20)
Большой футер: основные категории, ключевые подкатегории, популярные теги, способы приготовления,
подборки. Основной интерфейс не перегружать — большая структура живёт в каталоге и футере.

## Языки (ADR-0009)
- RU — основной; EN формирует ИИ при добавлении/правке, владелец правит вручную.
- Переводить: название, описание, ингредиенты, комментарии, шаги; категории/теги — заранее
  заданные EN-эквиваленты.
- URL: всегда с префиксом `/ru/…`, `/en/…` (`i18n/routing.ts`, ADR-0011); `/` → язык из cookie
  `NEXT_LOCALE` / Accept-Language, иначе `/ru` (`proxy.ts`). `www` → основной домен 301 (`next.config.ts`).
- canonical и hreflang (ru, en, x-default → путь без локали) — один источник: metadata страницы через
  `lib/i18n/alternates.ts`, абсолютные от `SITE_URL`; `Link`-заголовки next-intl выключены.
- До запуска закрыто от индексации: `SITE_INDEXABLE=false` → `app/robots.ts` Disallow + `noindex`
  (значение запекается при сборке). Проверки — `e2e/routing.spec.ts`, `e2e/platform.spec.ts`.
- Публичный пользователь переключает язык (ссылка на другую локаль, cookie сессионная).
- Slug по локалям (уникальность `(locale, slug)`, старые slug → 301) — в плане схемы БД.
- Каталог — плоский `/{locale}/catalog/{slug}` (иерархия — хлебными крошками), язык переключается
  через ID категории; поиск `/{locale}/search` — всегда `noindex` (ADR-0017).
