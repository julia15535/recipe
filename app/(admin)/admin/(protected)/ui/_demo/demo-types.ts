import type { CompositionTagId, SectionId } from "./demo-catalog";

// Примерный рецепт для прототипов. Первый раздел — основной (ADR-0018); main — индекс основного
// ингредиента, от которого считается пересчёт (ADR-0016); search — ключи поиска по ингредиенту.

// Количество — точное, диапазон («½–1 ч. л.») или нет; отдельно от пометки («по желанию») и единицы,
// чтобы было выразимо и «зелень — 10 г, по желанию». Правила: числа > 0, от ≤ до, основной ингредиент —
// только точное число (проверка — demo-recipes.test.ts). В будущей БД — десятичные числа, не float.
export type DemoQuantity = { kind: "exact"; value: number } | { kind: "range"; min: number; max: number } | { kind: "none" };

/** `style` — запись числа у автора («1/2» — fraction), как на сайте (ADR-0032); нет — десятичная. */
export type DemoIngredient = { name: string; quantity: DemoQuantity; unit?: string; note?: string; style?: "fraction" | "decimal" };

// Выход: число и изделие с формами слова («вафля / вафли / вафель»); по умолчанию — порции. Показ — «~ N»
// (владелец 01.10: «~ 4 порции»). Необязателен: у вафель «абстрактно, зависит от граммов на вафлю» (02.10).
export type DemoYield = { amount: number; forms?: readonly [one: string, few: string, many: string] };

export type DemoRecipe = {
  slug: string;
  title: string;
  description?: string;
  sections: [SectionId, ...SectionId[]];
  composition: CompositionTagId[];
  time?: string;
  yield?: DemoYield;
  tone: string;
  main: number;
  ingredients: DemoIngredient[];
  search: string[];
  steps: string[];
};

export const ing = (name: string, value: number, unit: string): DemoIngredient => ({ name, quantity: { kind: "exact", value }, unit });

export const range = (name: string, min: number, max: number, unit: string): DemoIngredient => ({
  name,
  quantity: { kind: "range", min, max },
  unit,
});

export const optional = (name: string, note = "по желанию"): DemoIngredient => ({ name, quantity: { kind: "none" }, note });
