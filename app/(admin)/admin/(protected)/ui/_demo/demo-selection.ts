import type { ComponentProps } from "react";

import type { SiteHeader } from "@/components/site-header";

import { HEADER, type SectionId, catalogFor } from "./demo-catalog";
import { RECIPES } from "./demo-recipes";
import type { DemoRecipe } from "./demo-types";

// Подборки главной: «Подборку недели» выбирает владелец (название и рецепты), «Популярное» — потом
// по счётчику открытий; здесь — примеры. Пустая подборка на странице не показывается.
export const WEEKLY = { title: "Тёплое и домашнее на выходные", slugs: ["mushroom-soup", "grechka", "chicken", "sharlotka"] };

export const POPULAR = ["syrniki", "bliny", "hummus", "pumpkin-salad"];

// Раздел активен, если в нём есть хотя бы один рецепт.
export function activeSections(recipes: DemoRecipe[] = RECIPES): ReadonlySet<SectionId> {
  return new Set(recipes.flatMap((recipe) => recipe.sections));
}

export function recipesInSection(section: SectionId, from: DemoRecipe[] = RECIPES): DemoRecipe[] {
  return from.filter((recipe) => recipe.sections.includes(section));
}

// Пропсы шапки прототипа: строка + каталог (11 мест, пустые бледные, текущий раздел выделен).
export function headerProps(current?: SectionId): ComponentProps<typeof SiteHeader> {
  return { ...HEADER, catalog: { sections: catalogFor(activeSections(), current), label: "Каталог", closeLabel: "Закрыть" } };
}

export function findRecipe(slug: string): DemoRecipe | undefined {
  return RECIPES.find((recipe) => recipe.slug === slug);
}

export function pickRecipes(slugs: string[], from: DemoRecipe[] = RECIPES): DemoRecipe[] {
  return slugs.map((slug) => from.find((recipe) => recipe.slug === slug)).filter((recipe): recipe is DemoRecipe => recipe !== undefined);
}
