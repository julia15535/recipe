---
tier: 1
topic: seo-i18n
scope: SEO публичных страниц, RU + EN, URL-схема, SEO-футер
tier2: ""
updated: 2026-10-03
importance: med
source: _intake/_processed/brief/technical_spec_recipe_book.md
status: draft
source_of_truth: supporting
last_verified: 2026-10-02
review_after: 2026-12-27
---

# SEO и языки — Tier 1 сводка

## Приоритет
SEO **вторичен** (владелец): сначала поиск, удобство при готовке, добавление, «поделиться».

## SEO (ТЗ §19)
SSR · человекочитаемые slug · title, description, Open Graph (ссылки в Instagram) · canonical · sitemap · robots ·
JSON-LD Recipe · хлебные крошки · индексируемые разделы и теги на обоих языках.

## SEO-футер (ТЗ §20)
Большой футер: основные категории, ключевые подкатегории, популярные теги, способы приготовления,
подборки. Основной интерфейс не перегружать — большая структура живёт в каталоге и футере.

## Языки (ADR-0009)
- RU — основной; EN формирует ИИ при добавлении/правке, владелец правит вручную.
- Переводить: название, описание, ингредиенты, комментарии, шаги; категории/теги — заранее
  заданные EN-эквиваленты.
- URL: всегда с префиксом `/ru/…`, `/en/…` (`i18n/routing.ts`, ADR-0011). Пока EN нет (ADR-0027): `/` всегда
  → `/ru` (`localeDetection: false`), `/en` — заглушка noindex, прочие `/en/*` — 404, кнопки языка в шапке нет.
  `www` → основной домен 301 (`next.config.ts`).
- canonical и hreflang — один источник: metadata страницы (`app/(public)/[locale]/_components/page-metadata.ts`
  → `lib/i18n/alternates.ts`), абсолютные от `SITE_URL`; hreflang — только живые языки (`LIVE_LOCALES`, сейчас
  ru; x-default — когда их больше одного); Open Graph — название, описание и кадр владельца `og.jpg` 1200×630 (ADR-0028); `Link`-заголовки next-intl выключены.
- Поисковикам закрыто (владелец 02.10: «поисковикам ничего не давай пока что, позже сделаем»):
  `SITE_INDEXABLE=false` → `app/robots.ts` Disallow + `noindex` на всех страницах. Значение и запекается при сборке
  (robots, layout), и читается при запросе (metadata разделов и рецептов) — открывать в CI И в `web.env`.
  Открытие — отдельным шагом: robots, `sitemap.xml`, JSON-LD Recipe. Проверки — `e2e/routing.spec.ts`,
  `e2e/platform.spec.ts`, `e2e/public.spec.ts`.
- Адреса: раздел `/{locale}/catalog/{slug}` (ADR-0017), рецепт `/{locale}/recipe/{slug}`, поиск — всегда `noindex`;
  slug уникален в `(locale, slug)`, история slug и 301 — позже.
