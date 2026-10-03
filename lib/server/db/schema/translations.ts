// Перевод рецепта (план english-version, ADR-0029). Готовый перевод — агрегат: строка `recipe_localizations` (slug,
// название, описание, время, формы выхода на языке) + снимок `recipe_translations` (всё остальное, что показывает
// страница, на момент перевода: правка русского рецепта перевод не трогает — решение владельца 03.10). Задания —
// `recipe_translation_jobs`: входной снимок русского, аренда и token (перевод идёт после ответа владельцу).
import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { recipeLocalizations, recipes } from "./recipes";

export const TRANSLATION_LOCALES = ["en"] as const;
export const JOB_STATUSES = ["queued", "running", "done", "failed"] as const;
const at = (name: string) => timestamp(name, { withTimezone: true });
const MAX_JSON_BYTES = 262144;

export const recipeTranslations = pgTable(
  "recipe_translations",
  {
    recipeId: uuid("recipe_id").notNull(),
    locale: text("locale", { enum: TRANSLATION_LOCALES }).notNull(),
    body: jsonb("body").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    sourceContentRevision: integer("source_content_revision").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    translatedAt: at("translated_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.recipeId, t.locale] }),
    foreignKey({ columns: [t.recipeId, t.locale], foreignColumns: [recipeLocalizations.recipeId, recipeLocalizations.locale] }).onDelete("cascade"),
    check("recipe_translations_locale_check", sql`${t.locale} = 'en'`),
    check("recipe_translations_body_check", sql`jsonb_typeof(${t.body}) = 'object' and pg_column_size(${t.body}) <= ${sql.raw(String(MAX_JSON_BYTES))}`),
    check("recipe_translations_revision_check", sql`${t.sourceContentRevision} >= 1 and ${t.schemaVersion} >= 1`),
  ],
);

export const recipeTranslationJobs = pgTable(
  "recipe_translation_jobs",
  {
    id: uuid("id").primaryKey(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
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
    check("recipe_translation_jobs_locale_check", sql`${t.locale} = 'en'`),
    check("recipe_translation_jobs_status_check", sql`${t.status} in ('queued', 'running', 'done', 'failed')`),
    check("recipe_translation_jobs_input_check", sql`jsonb_typeof(${t.input}) = 'object' and pg_column_size(${t.input}) <= ${sql.raw(String(MAX_JSON_BYTES))}`),
    check("recipe_translation_jobs_error_check", sql`${t.error} is null or length(${t.error}) <= 200`),
    // Одно активное задание на рецепт и язык: повторная публикация не ставит дубль.
    uniqueIndex("recipe_translation_jobs_active_unique").on(t.recipeId, t.locale).where(sql`${t.status} in ('queued', 'running')`),
    index("recipe_translation_jobs_pick_idx").on(t.status, t.leaseUntil),
  ],
);
