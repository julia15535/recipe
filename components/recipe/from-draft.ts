import type { ParseResult } from "@/lib/domain/recipe-text/parse";

import type { CatalogLabels, RecipeView } from "./view";

/** Предпросмотр разобранного текста: id строк — по номеру строки текста (стабильны в пределах показа). */
export function draftToView({ draft, mainIndex }: ParseResult, labels: CatalogLabels): RecipeView | null {
  if (!draft.title && draft.ingredients.length === 0 && draft.steps.length === 0) return null;
  const ingredients = draft.ingredients.map((item) => ({
    id: `line-${item.line}`,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    note: item.note,
  }));
  return {
    title: draft.title || "Без названия",
    description: draft.description,
    time: draft.time,
    yield: draft.yield,
    sections: draft.sections.map((code) => ({ code, label: labels.sections.get(code) ?? code, href: null })),
    tags: draft.tags.map((code) => ({ id: code, label: labels.tags.get(code) ?? code })),
    ingredients,
    mainId: mainIndex === null ? null : (ingredients[mainIndex]?.id ?? null),
    steps: draft.steps.map((text, index) => ({ id: `step-${index}`, text })),
    tips: draft.tips.map((text, index) => ({ id: `tip-${index}`, text })),
  };
}
