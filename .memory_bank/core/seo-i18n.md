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
last_verified: 2026-10-03
review_after: 2026-12-27
---

# SEO и языки — Tier 1 сводка

## Приоритет
SEO **вторичен** (владелец): сначала поиск, удобство при готовке, добавление, «поделиться».

## SEO (ТЗ §19)
SSR · человекочитаемые slug · title, description, Open Graph (ссылки в Instagram) · canonical · sitemap · robots ·
JSON-LD Recipe · хлебные крошки · индексируемые разделы и теги на обоих языках.

## SEO-футер (ТЗ §20)
Категории, подкатегории, теги, подборки — в футере, не в основном интерфейсе (позже).

## Языки (ADR-0009, ADR-0029)
- RU — основной; EN — перевод ИИ, разделы и теги — заранее заданные EN-названия (миграция 0008).
- URL: всегда с префиксом `/ru/…`, `/en/…` (`i18n/routing.ts`, ADR-0011). `/` — по языку браузера и cookie выбора
  `NEXT_LOCALE` (на год; пишет и `components/i18n/locale-cookie.tsx` — кнопка RU/EN переходит без перезагрузки),
  ответ `no-store` + `Vary` (`proxy.ts`, ADR-0029). `www` → основной домен 301 (`next.config.ts`).
- Английская версия (ADR-0029): ИИ переводит рецепт после публикации, на `/en` — только переведённые; адреса разделов и
  рецептов по-английски свои; кнопка языка — на ту же страницу (рецепт без перевода — на `/en`, поиск — без запроса).
- canonical и hreflang — один источник: metadata (`app/(public)/[locale]/_components/page-metadata.ts` →
  `lib/i18n/alternates.ts`): пары адресов языков, у рецепта без перевода — только ru, x-default — только у главной;
  Open Graph — название и описание (`ru_RU` / `en_GB`); у рецепта с фото — кадр `og.jpg` (ADR-0028).
- Поисковикам закрыто (владелец 02.10: «поисковикам ничего не давай пока что, позже сделаем»):
  `SITE_INDEXABLE=false` → `app/robots.ts` Disallow + `noindex` на всех страницах. Значение и запекается при сборке
  (robots, layout), и читается при запросе (metadata разделов и рецептов) — открывать в CI И в `web.env`.
  Открытие — отдельным шагом: robots, `sitemap.xml`, JSON-LD Recipe. Проверки — `e2e/routing.spec.ts`, `e2e/public.spec.ts`.
- Адреса: раздел `/{locale}/catalog/{slug}` (ADR-0017), рецепт `/{locale}/recipe/{slug}`, поиск — всегда `noindex`;
  slug уникален в `(locale, slug)`, история slug и 301 — позже.
