import type { CompositionTagId, SectionId } from "./demo-catalog";

// Примерный рецепт для прототипов. Первый раздел — основной (ADR-0018); main — индекс основного
// ингредиента, от которого считается пересчёт (ADR-0016); search — ключи поиска по ингредиенту.
export type DemoIngredient = { name: string; amount: number; unit: string };

export type DemoRecipe = {
  slug: string;
  title: string;
  description: string;
  sections: [SectionId, ...SectionId[]];
  composition: CompositionTagId[];
  time: string;
  servings: number;
  tone: string;
  main: number;
  ingredients: DemoIngredient[];
  search: string[];
  steps: string[];
};

export const ing = (name: string, amount: number, unit: string): DemoIngredient => ({ name, amount, unit });
