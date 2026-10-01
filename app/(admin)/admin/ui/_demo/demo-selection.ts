import { type DemoRecipe, RECIPES } from "./demo-recipes";

// Подборки главной: «Подборку недели» выбирает владелец (название и рецепты), «Популярное» — потом
// по счётчику открытий; здесь — примеры. Пустая подборка на странице не показывается.
export const WEEKLY = { title: "Тёплое и домашнее на выходные", slugs: ["mushroom-soup", "grechka", "chicken", "sharlotka"] };

export const POPULAR = ["syrniki", "bliny", "hummus", "pumpkin-salad"];

export function findRecipe(slug: string): DemoRecipe | undefined {
  return RECIPES.find((recipe) => recipe.slug === slug);
}

export function pickRecipes(slugs: string[]): DemoRecipe[] {
  return slugs.map(findRecipe).filter((recipe): recipe is DemoRecipe => recipe !== undefined);
}
