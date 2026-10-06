// Статьи (план articles, ADR-0034): свободный текст владельца с фото между абзацами и связанными рецептами.
// `source_text` — её текст с метками фото (источник для «Изменить»), `body` — проверенные блоки (Zod-схема с версией,
// `lib/server/articles/body-schema.ts`); фото — свои таблицы по образцу рецепта, у фото постоянный код метки (`key`),
// а uuid строки меняется при каждой смене кадра (адрес файла — новый, кэш не мешает). Байты — `STORAGE EXTERNAL`
// (ручная часть миграции 0010).
import { sql } from "drizzle-orm";
import { check, customType, index, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import type { ArticleBody, Mark } from "../../../domain/article-text/types";

import { LOCALES } from "./catalog";
import { PHOTO_FILES } from "./photos";
import { recipes } from "./recipes";

export const ARTICLE_STATUSES = ["draft", "published"] as const;
const at = (name: string) => timestamp(name, { withTimezone: true });
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });
const articleRef = () =>
  uuid("article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "cascade" });

export const articles = pgTable(
  "articles",
  {
    id: uuid("id").primaryKey(),
    status: text("status", { enum: ARTICLE_STATUSES }).notNull().default("draft"),
    sourceText: text("source_text").notNull(),
    body: jsonb("body").$type<ArticleBody>().notNull(),
    // Защита от устаревшей вкладки — растёт при любом изменении статьи.
    revision: integer("revision").notNull().default(1),
    // Для будущего перевода: растёт только при смене текста, блоков и подписей фото — не при публикации и кадре.
    contentRevision: integer("content_revision").notNull().default(1),
    createdAt: at("created_at").notNull().defaultNow(),
    updatedAt: at("updated_at").notNull().defaultNow(),
    publishedAt: at("published_at"),
  },
  (t) => [
    check("articles_status_check", sql`${t.status} in ('draft', 'published')`),
    check("articles_source_text_check", sql`octet_length(${t.sourceText}) between 1 and 20480`),
    check("articles_body_check", sql`jsonb_typeof(${t.body}) = 'object' and octet_length(${t.body}::text) <= 262144`),
    check("articles_revision_check", sql`${t.revision} >= 1 and ${t.contentRevision} >= 1`),
    check("articles_published_at_check", sql`${t.status} <> 'published' or ${t.publishedAt} is not null`),
    index("articles_status_published_idx").on(t.status, t.publishedAt),
  ],
);

export const articleLocalizations = pgTable(
  "article_localizations",
  {
    articleId: articleRef(),
    locale: text("locale", { enum: LOCALES }).notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    // Анонс для карточки и превью ссылки — первый абзац (`excerptOf`), ИИ его не пишет.
    excerpt: text("excerpt"),
  },
  (t) => [
    primaryKey({ columns: [t.articleId, t.locale] }),
    unique("article_localizations_locale_slug_unique").on(t.locale, t.slug),
    check("article_localizations_locale_check", sql`${t.locale} in ('ru', 'en')`),
    check("article_localizations_slug_check", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(${t.slug}) <= 80`),
    check("article_localizations_title_check", sql`length(${t.title}) between 1 and 120`),
    check("article_localizations_excerpt_check", sql`${t.excerpt} is null or length(${t.excerpt}) between 1 and 300`),
  ],
);

export const articlePhotos = pgTable(
  "article_photos",
  {
    id: uuid("id").primaryKey(),
    articleId: articleRef(),
    key: text("key").notNull(),
    caption: text("caption"),
    sourceWidth: integer("source_width").notNull(),
    sourceHeight: integer("source_height").notNull(),
    cropLeft: integer("crop_left").notNull(),
    cropTop: integer("crop_top").notNull(),
    cropWidth: integer("crop_width").notNull(),
    cropHeight: integer("crop_height").notNull(),
    createdAt: at("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("article_photos_article_key_unique").on(t.articleId, t.key),
    check("article_photos_key_check", sql`${t.key} ~ '^[A-HJ-NP-Z2-9]{4}$'`),
    check("article_photos_caption_check", sql`${t.caption} is null or length(${t.caption}) between 1 and 300`),
    check("article_photos_source_check", sql`${t.sourceWidth} between 1 and 4096 and ${t.sourceHeight} between 1 and 4096`),
    check(
      "article_photos_crop_check",
      sql`${t.cropLeft} >= 0 and ${t.cropTop} >= 0 and ${t.cropWidth} >= 1 and ${t.cropHeight} >= 1
        and ${t.cropLeft} + ${t.cropWidth} <= ${t.sourceWidth} and ${t.cropTop} + ${t.cropHeight} <= ${t.sourceHeight}
        and abs(${t.cropWidth} * 3 - ${t.cropHeight} * 4) <= 4`,
    ),
  ],
);

export const articlePhotoFiles = pgTable(
  "article_photo_files",
  {
    photoId: uuid("photo_id")
      .notNull()
      .references(() => articlePhotos.id, { onDelete: "cascade" }),
    name: text("name", { enum: PHOTO_FILES }).notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    contentType: text("content_type").notNull(),
    bytes: bytea("bytes").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.photoId, t.name] }),
    check("article_photo_files_name_check", sql`${t.name} in ('source', 'w480', 'w960', 'w1600', 'og')`),
    check("article_photo_files_type_check", sql`${t.contentType} in ('image/jpeg', 'image/webp')`),
    check("article_photo_files_size_check", sql`${t.width} between 1 and 4096 and ${t.height} between 1 and 4096`),
    check("article_photo_files_bytes_check", sql`octet_length(${t.bytes}) between 1 and 1048576`),
  ],
);

/** Связанные рецепты: удаление рецепта убирает только связь; снятый рецепт на сайте не показывается, связь остаётся. */
export const articleRecipes = pgTable(
  "article_recipes",
  {
    articleId: articleRef(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.articleId, t.recipeId] }),
    unique("article_recipes_position_unique").on(t.articleId, t.position),
    check("article_recipes_position_check", sql`${t.position} between 0 and 19`),
    index("article_recipes_recipe_idx").on(t.recipeId),
  ],
);

// Разметка ИИ ждёт «Сохранить» на сервере (сутки), как `recipe_imports`: браузеру готовые блоки не доверяем.
export const articleImports = pgTable(
  "article_imports",
  {
    id: uuid("id").primaryKey(),
    sourceText: text("source_text").notNull(),
    marks: jsonb("marks").$type<Mark[]>().notNull(),
    createdAt: at("created_at").notNull().defaultNow(),
  },
  (t) => [
    check("article_imports_source_text_check", sql`octet_length(${t.sourceText}) between 1 and 20480`),
    index("article_imports_created_at_idx").on(t.createdAt),
  ],
);
