import "server-only";
import { randomUUID } from "node:crypto";

import type { RecipeDraft } from "@/lib/domain/recipe-text/parse";

import type { Catalog } from "./catalog";

// Разобранный текст → строки таблиц. id строк создаются здесь: основной ингредиент нужен рецепту
// до вставки строк (отложенный FK `recipes_main_ingredient_fk`).
export type RecipeRows = ReturnType<typeof buildRows>;

export function buildRows(recipeId: string, draft: RecipeDraft, mainIndex: number, catalog: Catalog) {
  const sectionId = (code: string) => idOf(catalog.sections, code, "раздел");
  const tagId = (code: string) => idOf(catalog.tags, code, "тег");
  const ingredients = draft.ingredients.map((item, position) => {
    const quantity = item.quantity;
    return {
      id: randomUUID(),
      recipeId,
      position,
      displayName: item.name,
      quantityKind: quantity.kind,
      amountNum: quantity.kind === "exact" ? quantity.amount.num : quantity.kind === "range" ? quantity.min.num : null,
      amountDen: quantity.kind === "exact" ? quantity.amount.den : quantity.kind === "range" ? quantity.min.den : null,
      amountMaxNum: quantity.kind === "range" ? quantity.max.num : null,
      amountMaxDen: quantity.kind === "range" ? quantity.max.den : null,
      unit: item.unit,
      note: item.note,
    };
  });
  const main = ingredients[mainIndex];
  const primary = draft.sections[0];
  if (!main || !primary) throw new Error("рецепт без основного ингредиента или раздела — разбор не пропустил бы");
  return {
    recipe: {
      mainIngredientId: main.id,
      primarySectionId: sectionId(primary),
      yieldNum: draft.yield?.amount.num ?? null,
      yieldDen: draft.yield?.amount.den ?? null,
    },
    localization: {
      title: draft.title,
      description: draft.description,
      timeText: draft.time,
      yieldForms: draft.yield ? [...draft.yield.forms] : null,
    },
    sections: draft.sections.map((code, position) => ({ recipeId, sectionId: sectionId(code), position })),
    tags: draft.tags.map((code, position) => ({ recipeId, tagId: tagId(code), position })),
    ingredients,
    steps: draft.steps.map((text, position) => ({ id: randomUUID(), recipeId, position, text })),
  };
}

function idOf(items: Catalog["sections"], code: string, kind: string): string {
  const found = items.find((item) => item.code === code);
  if (!found) throw new Error(`в БД нет кода «${code}» (${kind}) — проверьте миграцию каталога`);
  return found.id;
}
