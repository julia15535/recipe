---
tier: 2
topic: articles-details
scope: Статьи подробно — разметка строк ИИ и без ИИ, метки фото, хранение, кабинет, сайт, кэш, пределы, тесты
tier1: ../core/articles.md
updated: 2026-10-06
importance: med
source: manual
status: working
source_of_truth: canonical
last_verified: 2026-10-06
review_after: 2027-01-06
---

# Статьи — детали (ADR-0034, план articles)

## Текст и разметка (`lib/domain/article-text/`)
- `lines.ts`: нормализация (LF, NFC — не NFKC, без пробелов в конце строк; смайлики, «ё», кавычки — как есть),
  метки фото — только целой строкой `[Фото XXXX]` (код из `A–Z` без I/O и `2–9`); повтор, метка внутри строки,
  > 10 фото — «Нужно решить». Пределы: 20 КБ, 300 строк, 100 блоков, 10 фото, название ≤ 120, заголовок ≤ 160,
  абзац/пункт ≤ 2000.
- Разметка `Mark` = вид (`h2`/`h3`/`p`/`bullet`/`number`) + диапазон строк. `assemble.ts` `marksValid`: каждая
  строка с текстом — ровно в одной записи, по порядку, без пустых строк и меток внутри, заголовок — одна строка;
  `assemble` копирует текст из строк (перенос внутри абзаца — пробел), убирает только «#», «-», «•», «1.»; длинное
  тире «—» — реплика, не пункт. `excerptOf` — анонс из первого абзаца (≤ 200), `photoAlts` — alt фото: подпись →
  ближайший заголовок → название.
- `parse.ts` `parseArticle`: разметка ИИ не легла — разбор без ИИ (`plain.ts`) и замечание; `titleIssue`.
- `edit.ts`: `remap` (слова те же — прежняя разметка на новых номерах строк, абзац делится меткой), `insertMarker`,
  `removeMarker`, `lastLineOf`.

## ИИ (`lib/server/ai/article-markup.ts`)
Пронумерованные строки (метки — «[ФОТО]»), ответ — `{ marks: [{ kind, from, to }] }` (json_schema strict, номера с
1), промпт 2026-10-06.2 (реплика «— …» и законченная фраза — отдельный абзац). Лимит разборов общий с рецептами
(`allow("ai-parse")` + сумма `recipe_imports` и `article_imports` за час; `app/(admin)/admin/(protected)/articles/ai-markup.ts`).
Живая проверка — `lib/server/ai/article-eval.live.test.ts`, тексты `scripts/ai-eval-articles/` (6/6).

## Хранение (миграция 0010, `lib/server/db/schema/articles.ts`)
`articles` (статус, `revision` — любое изменение, `content_revision` — текст/блоки/подписи; `body` ≤ 256 КБ CHECK),
`article_localizations` (ru; slug UNIQUE по языку, анонс), `article_photos` (код метки UNIQUE в статье, uuid —
новый при смене кадра → новый адрес файла) + `article_photo_files` (`STORAGE EXTERNAL`), `article_recipes` (≤ 20,
каскады с обеих сторон), `article_imports` (сутки). Запись — `lib/server/articles/{save,photos}.ts`, чтение —
`queries.ts` (кабинет), `public.ts` (сайт), `photo-reads.ts`.

## Кабинет (`app/(admin)/admin/(protected)/articles/`)
`actions.ts`: `parseArticleText` (метки — только на фото этой статьи; слова те же — `remap` без ИИ; иначе ИИ или без
ИИ; разметка → `article_imports`), `saveArticle` (блоки заново из импорта, `revision`), статусы, удаление черновика,
`saveRelatedRecipes`. `photo-actions.ts`: `addPhotoHere` (метку ставит сервер по текущему тексту и `revision`),
`recropArticle`, `removeArticlePhotoAction`, `captionArticlePhoto`; обработка фото — общий с рецептами лимит
(`lib/server/media/guard.ts`, ключ `photo`). Экраны: редактор, статья с «Добавить фото сюда» и кнопками фото,
«Фото без места», связанные рецепты чипами.

## Сайт
`app/(public)/[locale]/articles/{page,[slug]/page}.tsx`, `components/article/{article-body,article-card,view}.tsx`;
кэш — `lib/server/recipes/public-cache.ts` (`cachedArticle*`, тег `articles` в `PUBLIC_TAGS` — любая запись в кабинете
сбрасывает всё); фото — `app/media/article/[photoId]/[file]/route.ts` (опубликованное — всем, черновик и исходник —
владельцу); превью ссылки — первое фото. Только текст как React-узлы, без HTML. Шапка: `components/site-header.tsx`
(`articles`), лист каталога — `extra`.

## Тесты
Unit `lib/domain/article-text/article-text.test.ts`; DB `lib/server/articles/articles.db.test.ts`; e2e
`e2e/articles.spec.ts` (заглушка ИИ `e2e/support/ai-stub.ts` размечает «#»/«-»).

## Объём
Фото статьи ≈ как фото рецепта (исходник ≤ ~850 КБ + WebP + превью), 10 фото — до ~10–20 МБ на статью (предел CHECK —
5 файлов по 1 МБ на фото); бэкап — `core/deployment.md`.
