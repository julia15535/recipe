// Перевод статьи (план articles-en, ADR-0038) — по образцу рецептов (ADR-0029): английская `article_localizations(en)`
// (адрес, название, анонс) + снимок `article_translations` (английские блоки и подписи фото на момент перевода) +
// очередь `article_translation_jobs` (вход — снимок русской статьи, аренда и token). Правка русской статьи перевод
// не трогает — «устарел» по `articles.content_revision`.
import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { articleLocalizations, articles } from "./articles";
import { JOB_STATUSES, TRANSLATION_LOCALES } from "./translations";

const at = (name: string) => timestamp(name, { withTimezone: true });
const MAX_JSON_BYTES = 262144;

export const articleTranslations = pgTable(
  "article_translations",
  {
    articleId: uuid("article_id").notNull(),
    locale: text("locale", { enum: TRANSLATION_LOCALES }).notNull(),
    body: jsonb("body").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    sourceContentRevision: integer("source_content_revision").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    translatedAt: at("translated_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.articleId, t.locale] }),
    foreignKey({ columns: [t.articleId, t.locale], foreignColumns: [articleLocalizations.articleId, articleLocalizations.locale] }).onDelete("cascade"),
    check("article_translations_locale_check", sql`${t.locale} = 'en'`),
    check("article_translations_body_check", sql`jsonb_typeof(${t.body}) = 'object' and octet_length(${t.body}::text) <= ${sql.raw(String(MAX_JSON_BYTES))}`),
    check("article_translations_revision_check", sql`${t.sourceContentRevision} >= 1 and ${t.schemaVersion} >= 1`),
    check("article_translations_meta_check", sql`length(${t.model}) between 1 and 100 and length(${t.promptVersion}) between 1 and 40`),
  ],
);

export const articleTranslationJobs = pgTable(
  "article_translation_jobs",
  {
    id: uuid("id").primaryKey(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    locale: text("locale", { enum: TRANSLATION_LOCALES }).notNull(),
    status: text("status", { enum: JOB_STATUSES }).notNull().default("queued"),
    token: uuid("token"),
    leaseUntil: at("lease_until"),
    attempts: integer("attempts").notNull().default(0),
    input: jsonb("input").notNull(),
    sourceContentRevision: integer("source_content_revision").notNull(),
    error: text("error"),
    createdAt: at("created_at").notNull().defaultNow(),
    finishedAt: at("finished_at"),
    revalidatedAt: at("revalidated_at"),
  },
  (t) => [
    check("article_translation_jobs_locale_check", sql`${t.locale} = 'en'`),
    check("article_translation_jobs_status_check", sql`${t.status} in ('queued', 'running', 'done', 'failed')`),
    check("article_translation_jobs_attempts_check", sql`${t.attempts} between 0 and 3 and ${t.sourceContentRevision} >= 1`),
    check("article_translation_jobs_running_check", sql`${t.status} <> 'running' or (${t.token} is not null and ${t.leaseUntil} is not null)`),
    check("article_translation_jobs_input_check", sql`jsonb_typeof(${t.input}) = 'object' and octet_length(${t.input}::text) <= ${sql.raw(String(MAX_JSON_BYTES))}`),
    check("article_translation_jobs_error_check", sql`${t.error} is null or length(${t.error}) <= 200`),
    // Одно активное задание на статью и язык: повторная публикация не ставит дубль.
    uniqueIndex("article_translation_jobs_active_unique").on(t.articleId, t.locale).where(sql`${t.status} in ('queued', 'running')`),
    index("article_translation_jobs_pick_idx").on(t.status, t.leaseUntil),
    index("article_translation_jobs_last_idx").on(t.articleId, t.locale, t.createdAt),
  ],
);
