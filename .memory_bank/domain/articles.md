---
tier: 2
topic: articles-details
scope: Статьи подробно — разметка строк ИИ и без ИИ, метки фото, хранение, кабинет, сайт, кэш, пределы, тесты
tier1: ../core/articles.md
updated: 2026-10-11
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
  строка с текстом — ровно в одной записи, по порядку, без пустых строк и меток внутри, заголовок — одна строка,
  номера строк — в пределах текста; `assemble` копирует текст из строк (перенос внутри абзаца — пробел; пробелы и
  неразрывные пробелы внутри строки — как есть), убирает только начало строки: «#» у заголовка, «-», «•», «*», «●»,
  «▪» и «1.», «1)» у пункта; длинное тире «—» — реплика, не пункт; нумерованный список начинается с номера автора
  (`start`, «3.» после фото). `excerptOf` — анонс из первого абзаца (≤ 200), `photoAlts` — alt фото: подпись →
  ближайший заголовок → название; оба — без знаков оформления (`plainText`).
- `inline.ts` (ADR-0037): `inlineRuns` — `**жирный**`, `*курсив*`, `***оба***` и вложенность разного вида («*а **б** в*»);
  подряд идущие `*` — один знак (1–3, `****` — текст; «***» делится между вложенными парами); открывает — справа не
  пробел и не «,.;:!?)»», закрывает — слева не пробел и не «(«»; между двумя буквами/цифрами не действует («5*3*2»);
  пары по стеку — непарная звёздочка остаётся звёздочкой и не мешает другим парам; `\*` — звёздочка; `pairsOf` —
  позиции пар; `plainText`. Знаки хранятся в тексте блоков (схема та же). `format-edit.ts` `toggleStyle` — «Ж»/«К»:
  выделение — до целых слов, без пробелов, звёздочек и «,»/«(» по краям; служебное начало строки («# », «- », «1. ») и
  строка-метка фото не оборачиваются; внутри куска того же стиля — снимает со всего куска; пересекающиеся и вплотную
  стоящие пары поглощаются, такие же внутри — убираются; одиночная звёздочка вплотную экранируется `\*`; без выделения —
  пара знаков (повтор убирает); несколько строк — каждая отдельно. Тест-«нажималка»: 100 серий × 200 случайных нажатий —
  видимый текст не меняется (`format-edit.test.ts`).
- `parse.ts` `parseArticle`: разметка ИИ не легла — разбор без ИИ (`plain.ts`) и замечание; возвращает и разметку, по
  которой собраны блоки (её хранит `article_imports`); `titleIssue`.
- `edit.ts`: `remap` (слова те же — по тексту без знаков оформления, «Ж»/«К» ИИ не зовут; прежняя разметка на новых
  номерах строк, абзац делится меткой), `insertMarker`,
  `removeMarker`, `lastLineOf`.

## ИИ (`lib/server/ai/article-markup.ts`)
Пронумерованные строки (метки — «[ФОТО]»), ответ — `{ marks: [{ kind, from, to }] }` (json_schema strict, номера с
1 до предела строк — иначе «ответ непонятный»), промпт 2026-10-11.1 (реплика «— …» и законченная фраза — отдельный
абзац; пункт — значок с пробелом, `*слово*` в начале строки — оформление, не пункт). Лимит разборов общий с рецептами в обе стороны: `allow("ai-parse")` + сумма `recipe_imports` и
`article_imports` за час (в сумму входят и разборы статей без ИИ — лимит строже); `app/(admin)/admin/(protected)/articles/ai-markup.ts`,
`app/(admin)/admin/(protected)/recipes/ai-actions.ts`. До ИИ — пустой, > 20 КБ, > 300 строк, ошибки меток: ИИ не зовём. Живая проверка —
`lib/server/ai/article-eval.live.test.ts`, тексты `scripts/ai-eval-articles/` (8/8, есть длинный и с оформлением).

## Хранение (миграция 0010, `lib/server/db/schema/articles.ts`)
`articles` (статус, `revision` — любое изменение, `content_revision` — текст/блоки/подписи; `body` ≤ 256 КБ CHECK),
`article_localizations` (ru; slug UNIQUE по языку, анонс), `article_photos` (код метки UNIQUE в статье, uuid —
новый при смене кадра → новый адрес файла) + `article_photo_files` (`STORAGE EXTERNAL`), `article_recipes` (≤ 20,
каскады с обеих сторон), `article_imports` (сутки). Запись — `lib/server/articles/{save,photos}.ts`, чтение —
`queries.ts` (кабинет), `public.ts` (сайт), `photo-reads.ts`.

## Перевод на английский (ADR-0038)
- Домен `lib/domain/article-text/translation.ts`: `articleUnits` — название, заголовок/абзац по id, пункт `b4:0`, подпись
  `photo:KEY` (заголовки и подписи — `plainText`); `toTagged`/`fromTagged` — звёздочки ⇄ ⟪b⟫/⟪i⟫/⟪*⟫ (выделения,
  что длятся дольше, — снаружи; пробелы по краям выносятся; не разбирается как задумано — текст без оформления);
  `composeArticle` — те же id по порядку, та же последовательность меток, структура из русского снимка.
- ИИ `lib/server/ai/translate-article.ts`: промпт 2026-10-11.2, json_schema `article_translation`, числа ⟦n⟧ (`unmaskNumbers`
  с `ownDigits`: свои цифры можно, Фаренгейт/° /% проверяются), 16 000 токенов, 90 с. Живая проверка —
  `lib/server/ai/article-translate.live.test.ts` (8 текстов + статья у 20 КБ: 9/9, ~27 с).
- Хранение и очередь: `lib/server/db/schema/article-translations.ts`, миграция 0012; `lib/server/articles/translation-jobs.ts`
  (аренда 180 с, token, ≤ 3 захвата), `-queue.ts` (`pendingArticleWork` по одному, `neverTranslated` — опубликованные без
  заданий, `articleTranslationState` одним запросом), `-run.ts` (`serially` и лимит `recipe-translate` — общие с
  рецептами; `pickupArticleTranslations` — из `app/api/jobs/translations` при < 60 с от начала), `-store.ts` (локализация
  en: slug не меняется, название ≤ 120, анонс `excerptOf`; снимок `{schemaVersion, article}`), `-schema.ts` (Zod: вход,
  снимок с запасом длины ×2), `translate-later.ts` (`after()`).
- Сайт: `lib/server/articles/public.ts` + `public-content.ts` — `contentOf` (ru — статья, en — снимок), подписи из снимка,
  `otherSlug` (пара на английском — только при снимке), связанные — `readCards(locale)`.
- Кабинет: перевод — при публикации (`actions.ts` `saveArticle` новой опубликованной и `changeArticleStatus`), «Перевести»
  (`translation-actions.ts`), блок — `app/(admin)/admin/(protected)/recipes/_components/translation-block.tsx` (общий, `action`/`enPath`/`subject`).
- Тесты: `lib/domain/article-text/translation.test.ts` (в т. ч. 50 серий случайного оформления туда-обратно),
  `lib/server/articles/translations.db.test.ts`, `e2e/articles-en.spec.ts` (заглушка `article_translation` — «EN »).

## Кабинет (`app/(admin)/admin/(protected)/articles/`)
`actions.ts`: `parseArticleText` (метки — только на фото этой статьи; слова те же — `remap` без ИИ; иначе ИИ или без
ИИ; фото без метки — замечание «без места»; разметка → `article_imports`), `saveArticle` (блоки заново из импорта,
проверка той же Zod-схемой, что при чтении — `lib/server/articles/storable.ts`, `revision`), статусы, удаление черновика,
`saveRelatedRecipes`. `content_revision` растёт, только если текст, название, блоки или подпись правда изменились. `photo-actions.ts`: `addPhotoHere` (метку ставит сервер по текущему тексту и `revision`),
`recropArticle`, `removeArticlePhotoAction`, `captionArticlePhoto`; обработка фото — общий с рецептами лимит
(`lib/server/media/guard.ts`, ключ `photo`). Экраны: редактор (над полем текста — группа «Ж» / «К», `app/(admin)/admin/(protected)/articles/_components/format-toolbar.tsx`:
`execCommand("insertText")` — работает «Отменить», иначе новое значение поля; Ctrl+B/I, на Mac ⌘, по `event.code`, без
Shift и при наборе иероглифов — нет), статья с «Добавить фото сюда» и кнопками фото,
«Фото без места», связанные рецепты чипами.

## Сайт
`app/(public)/[locale]/articles/{page,[slug]/page}.tsx`, `components/article/{article-body.tsx,article-card.tsx,view.ts}`;
кэш — `lib/server/recipes/public-cache.ts` (`cachedArticle*`, тег `articles` в `PUBLIC_TAGS` — любая запись в кабинете
сбрасывает всё); фото — `app/media/article/[photoId]/[file]/route.ts` (опубликованное — всем, черновик и исходник —
владельцу); превью ссылки — первое фото. Только текст как React-узлы, без HTML; жирный/курсив — в абзацах и пунктах
(`components/article/article-body.tsx` `Inline`), в заголовках (Prata — одно начертание) и подписях знаки убираются. Шапка: `components/site-header.tsx`
(`articles`), лист каталога — `extra`.

## Тесты
Unit `lib/domain/article-text/{article-text,inline,format-edit}.test.ts`; DB `lib/server/articles/articles.db.test.ts` (в т. ч. `content_revision`,
черновик не в «Статьи по рецепту», фото черновика не опубликовано); e2e `e2e/articles.spec.ts` (заглушка ИИ
`e2e/support/ai-stub.ts` размечает «#»/«-»; статья 320 / 375 / 1280, axe в кабинете, на рецепте, на главной; перенос
метки без ИИ; стёртая метка → «Фото без места» → убрать; «Ж»/«К»/Ctrl+B → `<strong>` (Manrope 700) / `<em>` (курсив
наклоняет браузер — у Manrope его нет), анонс и description без звёздочек). Бэкап: `deploy/local/recipe-restore-drill.sh` проверяет и
`article_photo_files`.

## Объём
Фото статьи ≈ как фото рецепта (исходник ≤ ~850 КБ + WebP + превью), 10 фото — до ~10–20 МБ на статью (предел CHECK —
5 файлов по 1 МБ на фото); бэкап — `core/deployment.md`.
