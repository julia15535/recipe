import "server-only";
import { z } from "zod";

import { SECTION_CODES, TAG_CODES } from "@/lib/domain/catalog";
import type { AiRecipe } from "@/lib/domain/recipe-text/ai-recipe";

// Форма ответа ИИ: JSON-схема для шлюза (strict — все поля обязательны, null вместо пропуска) и zod для
// проверки у нас. Истинность содержимого проверяет `fromAi`.
const str = (max: number) => ({ type: "string", maxLength: max });
const nullable = (max: number) => ({ type: ["string", "null"], maxLength: max });
// Число — целое, десятичное, дробь «1/2» или «1 1/2»; диапазон — два таких числа (и «1–1 1/2»).
const NUMBER = "[0-9]{1,6}([.,][0-9]{1,6})?( [0-9]{1,6}/[0-9]{1,6}|/[0-9]{1,6})?";
const AMOUNT = `^${NUMBER}( ?[–—-] ?${NUMBER})?$`;

export const RECIPE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["result_type", "title", "description", "time", "yield", "sections", "tags", "ingredients_source", "ingredients", "steps", "tips", "changes", "doubts"],
  properties: {
    result_type: { type: "string", enum: ["recipe", "not_recipe"] },
    title: str(200),
    description: nullable(1000),
    time: nullable(100),
    yield: {
      type: ["object", "null"],
      additionalProperties: false,
      required: ["amount", "word"],
      properties: { amount: str(20), word: str(30) },
    },
    sections: { type: "array", maxItems: 3, items: { type: "string", enum: [...SECTION_CODES] } },
    tags: { type: "array", maxItems: 5, items: { type: "string", enum: [...TAG_CODES] } },
    // Перед ingredients: модель сначала решает, есть ли список автора (порядок полей = порядок ответа).
    ingredients_source: { type: "string", enum: ["list", "text"] },
    ingredients: {
      type: "array",
      maxItems: 60,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "amount", "unit", "note", "is_main"],
        properties: {
          name: str(200),
          amount: { type: ["string", "null"], pattern: AMOUNT },
          unit: nullable(30),
          note: nullable(300),
          is_main: { type: "boolean" },
        },
      },
    },
    steps: { type: "array", maxItems: 40, items: str(2000) },
    tips: { type: "array", maxItems: 20, items: str(1000) },
    changes: {
      type: "array",
      maxItems: 20,
      items: { type: "object", additionalProperties: false, required: ["quote", "result"], properties: { quote: str(200), result: str(200) } },
    },
    doubts: { type: "array", maxItems: 5, items: str(300) },
  },
} as const;

const text = (max: number) => z.string().max(max);
const maybe = (max: number) => z.string().max(max).nullable();

export const aiRecipeSchema: z.ZodType<AiRecipe> = z.object({
  result_type: z.enum(["recipe", "not_recipe"]),
  title: text(200),
  description: maybe(1000),
  time: maybe(100),
  yield: z.object({ amount: text(20), word: text(30) }).nullable(),
  sections: z.array(z.enum(SECTION_CODES)).max(3),
  tags: z.array(z.enum(TAG_CODES)).max(5),
  ingredients_source: z.enum(["list", "text"]),
  ingredients: z
    .array(z.object({ name: text(200), amount: maybe(40), unit: maybe(30), note: maybe(300), is_main: z.boolean() }))
    .max(60),
  steps: z.array(text(2000)).max(40),
  tips: z.array(text(1000)).max(20),
  changes: z.array(z.object({ quote: text(200), result: text(200) })).max(20),
  doubts: z.array(text(300)).max(5),
});
