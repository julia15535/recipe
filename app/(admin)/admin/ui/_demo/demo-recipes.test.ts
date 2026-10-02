import { describe, expect, it } from "vitest";

import { RECIPES } from "./demo-recipes";

// Правила демо-модели (план first-owner-recipe): числа > 0, от ≤ до, основной ингредиент — только
// точное число, без количества — обязательно пометка («по желанию»), выход > 0.
describe("примерные рецепты прототипа", () => {
  it.each(RECIPES.map((recipe) => [recipe.slug, recipe] as const))("%s — модель согласована", (_, recipe) => {
    expect(recipe.yield.amount).toBeGreaterThan(0);
    expect(recipe.ingredients[recipe.main]?.quantity.kind).toBe("exact");
    for (const { quantity, note } of recipe.ingredients) {
      if (quantity.kind === "exact") expect(quantity.value).toBeGreaterThan(0);
      if (quantity.kind === "range") {
        expect(quantity.min).toBeGreaterThan(0);
        expect(quantity.min).toBeLessThanOrEqual(quantity.max);
      }
      if (quantity.kind === "none") expect(note).toBeTruthy();
    }
  });
});
