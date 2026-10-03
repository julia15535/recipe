import type { CardData } from "@/components/recipe/recipe-card";
import type { SearchEntry } from "@/components/search/recipe-search";

import { COMPOSITION_TAGS, compositionTags, PROTOTYPE, SECTIONS, sectionLabel } from "./demo-catalog";
import { RECIPES } from "./demo-recipes";
import { recipesInSection } from "./demo-selection";
import type { DemoRecipe } from "./demo-types";

// Адаптер демо-рецептов к общим компонентам сайта (карточка, поиск): прототипы показывают те же экраны,
// что и `/ru`, только на примерных данных и со своими адресами.
export function demoCard(recipe: DemoRecipe): CardData {
  const [main] = recipe.sections;
  // Первый тег — в порядке автора рецепта (как на сайте), не каталога.
  const [tag = null] = compositionTags(recipe.composition);
  return { href: PROTOTYPE.recipe(recipe.slug), title: recipe.title, time: recipe.time ?? null, section: { code: main, label: sectionLabel(main) }, tag, tone: recipe.tone };
}

export function demoCards(recipes: DemoRecipe[]): CardData[] {
  return recipes.map(demoCard);
}

export function demoSearch(): { items: SearchEntry[]; sections: { code: string; label: string; recipes: number }[]; tags: { code: string; label: string }[] } {
  return {
    items: RECIPES.map((recipe) => ({ ...demoCard(recipe), ingredients: recipe.search, sections: recipe.sections, tagCodes: recipe.composition })),
    sections: SECTIONS.map(({ id, label }) => ({ code: id, label, recipes: recipesInSection(id).length })),
    tags: COMPOSITION_TAGS.map(({ id, label }) => ({ code: id, label })),
  };
}
