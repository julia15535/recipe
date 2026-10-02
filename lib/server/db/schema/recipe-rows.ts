// Строки рецепта: ингредиенты (количество — дроби, см. lib/domain/fraction.ts) и шаги. Стабильный id
// у каждой строки — для ключей React и будущих переводов (expand без смены идентичности).
import { sql } from "drizzle-orm";
import { bigint, check, index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import type { AiDraft } from "../../../domain/recipe-text/from-ai";

import { QUANTITY_KINDS, recipes } from "./recipes";

const recipeRef = () =>
  uuid("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" });

export const recipeIngredients = pgTable(
  "recipe_ingredients",
  {
    id: uuid("id").primaryKey(),
    recipeId: recipeRef(),
    position: integer("position").notNull(),
    displayName: text("display_name").notNull(),
    quantityKind: text("quantity_kind", { enum: QUANTITY_KINDS }).notNull(),
    amountNum: bigint("amount_num", { mode: "number" }),
    amountDen: integer("amount_den"),
    amountMaxNum: bigint("amount_max_num", { mode: "number" }),
    amountMaxDen: integer("amount_max_den"),
    unit: text("unit"),
    note: text("note"),
  },
  (t) => [
    unique("recipe_ingredients_position_unique").on(t.recipeId, t.position),
    unique("recipe_ingredients_recipe_id_unique").on(t.recipeId, t.id),
    check("recipe_ingredients_position_check", sql`${t.position} >= 0`),
    check("recipe_ingredients_name_check", sql`length(${t.displayName}) between 1 and 200`),
    check("recipe_ingredients_unit_check", sql`${t.unit} is null or length(${t.unit}) between 1 and 30`),
    check("recipe_ingredients_note_check", sql`${t.note} is null or length(${t.note}) between 1 and 300`),
    check(
      "recipe_ingredients_amount_bounds_check",
      sql`coalesce(${t.amountNum}, 1) between 1 and 1000000000000000 and coalesce(${t.amountDen}, 1) between 1 and 1000000
        and coalesce(${t.amountMaxNum}, 1) between 1 and 1000000000000000 and coalesce(${t.amountMaxDen}, 1) between 1 and 1000000`,
    ),
    check(
      "recipe_ingredients_quantity_check",
      sql`(${t.quantityKind} = 'exact' and ${t.amountNum} is not null and ${t.amountDen} is not null
          and ${t.amountMaxNum} is null and ${t.amountMaxDen} is null)
        or (${t.quantityKind} = 'range' and ${t.amountNum} is not null and ${t.amountDen} is not null
          and ${t.amountMaxNum} is not null and ${t.amountMaxDen} is not null
          and ${t.amountNum}::numeric * ${t.amountMaxDen} <= ${t.amountMaxNum}::numeric * ${t.amountDen})
        or (${t.quantityKind} = 'none' and ${t.amountNum} is null and ${t.amountDen} is null
          and ${t.amountMaxNum} is null and ${t.amountMaxDen} is null)`,
    ),
  ],
);

export const recipeSteps = pgTable(
  "recipe_steps",
  {
    id: uuid("id").primaryKey(),
    recipeId: recipeRef(),
    position: integer("position").notNull(),
    text: text("text").notNull(),
  },
  (t) => [
    unique("recipe_steps_position_unique").on(t.recipeId, t.position),
    check("recipe_steps_position_check", sql`${t.position} >= 0`),
    check("recipe_steps_text_check", sql`length(${t.text}) between 1 and 2000`),
  ],
);

// Советы автора к рецепту — отдельно от шагов (владелец 02.10).
export const recipeTips = pgTable(
  "recipe_tips",
  {
    id: uuid("id").primaryKey(),
    recipeId: recipeRef(),
    position: integer("position").notNull(),
    text: text("text").notNull(),
  },
  (t) => [
    unique("recipe_tips_position_unique").on(t.recipeId, t.position),
    check("recipe_tips_position_check", sql`${t.position} >= 0`),
    check("recipe_tips_text_check", sql`length(${t.text}) between 1 and 1000`),
  ],
);

// Разбор ИИ ждёт решения владельца на сервере (сутки): сохранение получает только id, структуре из
// браузера не доверяем, а ИИ второй раз не зовём. Записи за час — лимит разборов.
export const recipeImports = pgTable(
  "recipe_imports",
  {
    id: uuid("id").primaryKey(),
    originalText: text("original_text").notNull(),
    result: jsonb("result").$type<AiDraft>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("recipe_imports_original_text_check", sql`octet_length(${t.originalText}) between 1 and 20480`),
    index("recipe_imports_created_at_idx").on(t.createdAt),
  ],
);
