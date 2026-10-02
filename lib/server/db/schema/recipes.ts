// Рецепты (план recipe-upload): одна актуальная версия (ADR-0007), количества — точные дроби
// (числитель/знаменатель), локализации — отдельно (сейчас только ru). Ровно один основной ингредиент и
// основной раздел — отложенные составные FK в ручной миграции 0003 (Drizzle их не выражает).
import { sql } from "drizzle-orm";
import { bigint, check, index, integer, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { compositionTags, LOCALES, sections } from "./catalog";

export const RECIPE_STATUSES = ["draft", "published"] as const;
export const QUANTITY_KINDS = ["exact", "range", "none"] as const;
const at = (name: string) => timestamp(name, { withTimezone: true });
const recipeRef = () =>
  uuid("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" });

export const recipes = pgTable(
  "recipes",
  {
    id: uuid("id").primaryKey(),
    status: text("status", { enum: RECIPE_STATUSES }).notNull().default("draft"),
    sourceText: text("source_text").notNull(),
    // Последний вставленный «как есть» текст, из которого ИИ собрал рецепт (план recipe-ai-parse).
    originalText: text("original_text"),
    revision: integer("revision").notNull().default(1),
    mainIngredientId: uuid("main_ingredient_id").notNull(),
    primarySectionId: uuid("primary_section_id").notNull(),
    yieldNum: bigint("yield_num", { mode: "number" }),
    yieldDen: integer("yield_den"),
    createdAt: at("created_at").notNull().defaultNow(),
    updatedAt: at("updated_at").notNull().defaultNow(),
    publishedAt: at("published_at"),
  },
  (t) => [
    check("recipes_status_check", sql`${t.status} in ('draft', 'published')`),
    check("recipes_source_text_check", sql`octet_length(${t.sourceText}) between 1 and 20480`),
    check("recipes_original_text_check", sql`${t.originalText} is null or octet_length(${t.originalText}) between 1 and 20480`),
    check("recipes_revision_check", sql`${t.revision} >= 1`),
    check(
      "recipes_yield_check",
      sql`(${t.yieldNum} is null and ${t.yieldDen} is null) or (${t.yieldNum} > 0 and ${t.yieldDen} between 1 and 1000000)`,
    ),
    check("recipes_published_at_check", sql`${t.status} <> 'published' or ${t.publishedAt} is not null`),
    index("recipes_status_updated_idx").on(t.status, t.updatedAt),
  ],
);

export const recipeLocalizations = pgTable(
  "recipe_localizations",
  {
    recipeId: recipeRef(),
    locale: text("locale", { enum: LOCALES }).notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    timeText: text("time_text"),
    yieldForms: text("yield_forms").array(),
  },
  (t) => [
    primaryKey({ columns: [t.recipeId, t.locale] }),
    unique("recipe_localizations_locale_slug_unique").on(t.locale, t.slug),
    check("recipe_localizations_locale_check", sql`${t.locale} in ('ru', 'en')`),
    check("recipe_localizations_slug_check", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(${t.slug}) <= 80`),
    check("recipe_localizations_title_check", sql`length(${t.title}) between 1 and 120`),
    check("recipe_localizations_yield_forms_check", sql`${t.yieldForms} is null or cardinality(${t.yieldForms}) = 3`),
  ],
);

const position = () => integer("position").notNull();
const positionCheck = (name: string, column: unknown) => check(name, sql`${column} >= 0`);

export const recipeSections = pgTable(
  "recipe_sections",
  {
    recipeId: recipeRef(),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => sections.id),
    position: position(),
  },
  (t) => [
    primaryKey({ columns: [t.recipeId, t.sectionId] }),
    unique("recipe_sections_position_unique").on(t.recipeId, t.position),
    index("recipe_sections_section_idx").on(t.sectionId),
    positionCheck("recipe_sections_position_check", t.position),
  ],
);

export const recipeCompositionTags = pgTable(
  "recipe_composition_tags",
  {
    recipeId: recipeRef(),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => compositionTags.id),
    position: position(),
  },
  (t) => [
    primaryKey({ columns: [t.recipeId, t.tagId] }),
    unique("recipe_composition_tags_position_unique").on(t.recipeId, t.position),
    index("recipe_composition_tags_tag_idx").on(t.tagId),
    positionCheck("recipe_composition_tags_position_check", t.position),
  ],
);
