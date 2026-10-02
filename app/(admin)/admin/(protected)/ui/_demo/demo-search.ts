import type { CompositionTagId, SectionId } from "./demo-catalog";
import type { DemoRecipe } from "./demo-types";

// Демо-поиск прототипа: только чтобы показать экран. Настоящий поиск — индекс в БД с иерархией
// ингредиентов, без ИИ (ADR-0002), отдельный план.
export type DemoQuery = {
  mode: "recipe" | "ingredient";
  text: string;
  ingredients: string[];
  section: SectionId | null;
  tags: CompositionTagId[];
};

export function ingredientChips(recipes: DemoRecipe[]): string[] {
  return [...new Set(recipes.flatMap((recipe) => recipe.search))];
}

export function hasCriteria(query: DemoQuery): boolean {
  const main = query.mode === "recipe" ? query.text.trim() !== "" : query.ingredients.length > 0;
  return main || query.section !== null || query.tags.length > 0;
}

export function searchDemo(query: DemoQuery, recipes: DemoRecipe[]): DemoRecipe[] {
  const text = query.text.trim().toLowerCase();
  return recipes.filter(
    (recipe) =>
      (query.mode !== "recipe" || recipe.title.toLowerCase().includes(text)) &&
      (query.mode !== "ingredient" || query.ingredients.every((name) => recipe.search.includes(name))) &&
      (query.section === null || recipe.sections.includes(query.section)) &&
      query.tags.every((tag) => recipe.composition.includes(tag)),
  );
}
