import type { RecipeView } from "@/components/recipe/view";
import { fraction, parseDecimal } from "@/lib/domain/fraction";
import type { Quantity } from "@/lib/domain/quantity";

import { PROTOTYPE, compositionTags, sectionLabel } from "./demo-catalog";
import type { DemoQuantity, DemoRecipe } from "./demo-types";

// Адаптер прототипов: примерный рецепт → общая модель показа (components/recipe). Числа демо — десятичные
// (0,5; 1,5) и переводятся в дроби точно.
const toFraction = (value: number) => parseDecimal(String(value)) ?? fraction(Math.round(value * 1000), 1000);

function quantity(value: DemoQuantity): Quantity {
  if (value.kind === "exact") return { kind: "exact", amount: toFraction(value.value) };
  if (value.kind === "range") return { kind: "range", min: toFraction(value.min), max: toFraction(value.max) };
  return { kind: "none" };
}

export function demoToView(recipe: DemoRecipe): RecipeView {
  const ingredients = recipe.ingredients.map((item, index) => ({
    id: `${recipe.slug}-${index}`,
    name: item.name,
    quantity: quantity(item.quantity),
    unit: item.unit ?? null,
    note: item.note ?? null,
    ...(item.style ? { amountStyle: item.style } : {}),
  }));
  return {
    title: recipe.title,
    description: recipe.description ?? null,
    time: recipe.time ?? null,
    yield: recipe.yield ? { amount: toFraction(recipe.yield.amount), forms: recipe.yield.forms ?? ["порция", "порции", "порций"] } : null,
    sections: recipe.sections.map((id) => ({ code: id, label: sectionLabel(id), href: PROTOTYPE.section(id) })),
    tags: compositionTags(recipe.composition),
    ingredients,
    mainId: ingredients[recipe.main]?.id ?? null,
    steps: recipe.steps.map((text, index) => ({ id: `${recipe.slug}-step-${index}`, text })),
    tips: [],
    photo: null,
    tone: recipe.tone,
  };
}
