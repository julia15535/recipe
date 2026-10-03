import "server-only";
import { z } from "zod";

import { KINDS } from "@/lib/domain/rounding";

// Форма ответа ИИ-переводчика (strict JSON-схема для шлюза + zod у нас) и снимков в БД (zod при записи и чтении:
// jsonb из базы — тоже внешний вход). Числа ИИ не возвращает — только тексты с метками (lib/domain/translation.ts).
const str = (max: number) => ({ type: "string", maxLength: max });
const nullable = (max: number) => ({ type: ["string", "null"], maxLength: max });
const pair = { type: ["array", "null"], minItems: 2, maxItems: 2, items: str(40) };
const rows = (max: number) => ({
  type: "array",
  maxItems: 60,
  items: { type: "object", additionalProperties: false, required: ["id", "text"], properties: { id: str(80), text: str(max) } },
});

export const TRANSLATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "description", "time", "yieldForms", "ingredients", "steps", "tips"],
  properties: {
    // Как у русского названия в БД: до 120 символов.
    title: str(120),
    description: nullable(1000),
    time: nullable(100),
    yieldForms: pair,
    ingredients: {
      type: "array",
      maxItems: 60,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "note", "unitForms"],
        properties: { id: str(80), name: str(200), note: nullable(300), unitForms: pair },
      },
    },
    steps: rows(2000),
    tips: rows(1000),
  },
} as const;

const text = (max: number) => z.string().max(max).refine((value) => !/[\u0000-\u0008\u000b-\u001f\u007f]/.test(value), "control");
const forms = z.tuple([text(40), text(40)]).nullable();
const row = (max: number) => z.object({ id: z.string().max(80), text: text(max) });

export const aiTranslationSchema = z.object({
  title: text(120).refine((value) => value.trim() !== "", "empty"),
  description: text(1000).nullable(),
  time: text(100).nullable(),
  yieldForms: forms,
  ingredients: z.array(z.object({ id: z.string().max(80), name: text(200), note: text(300).nullable(), unitForms: forms })).max(60),
  steps: z.array(row(2000)).max(60),
  tips: z.array(row(1000)).max(60),
});

const fractionSchema = z.object({ num: z.number().int().nonnegative(), den: z.number().int().positive() });
const quantitySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("exact"), amount: fractionSchema }),
  z.object({ kind: z.literal("range"), min: fractionSchema, max: fractionSchema }),
  z.object({ kind: z.literal("none") }),
]);
const codes = z.array(z.string().regex(/^[a-z0-9-]{1,40}$/)).max(20);
const base = {
  schemaVersion: z.literal(1),
  sectionCodes: codes,
  primarySectionCode: z.string().regex(/^[a-z0-9-]{1,40}$/),
  tagCodes: codes,
  mainId: z.string().max(80).nullable(),
  steps: z.array(row(2000)).max(60),
  tips: z.array(row(1000)).max(60),
};
const ingredient = { id: z.string().max(80), name: text(200), note: text(300).nullable(), quantity: quantitySchema, unit: z.string().max(30).nullable(), kind: z.enum(KINDS) };

/** Вход задания — снимок русского рецепта. */
export const sourceRecipeSchema = z.object({
  ...base,
  title: text(200),
  description: text(1000).nullable(),
  time: text(100).nullable(),
  yield: z.object({ amount: fractionSchema, forms: z.array(text(40)).min(2).max(3) }).nullable(),
  ingredients: z.array(z.object(ingredient)).max(60),
});

/** Готовый снимок перевода в `recipe_translations.body`. */
export const translationBodySchema = z.object({
  ...base,
  yield: fractionSchema.nullable(),
  ingredients: z.array(z.object({ ...ingredient, unitForms: z.tuple([text(40), text(40)]).nullable() })).max(60),
});
