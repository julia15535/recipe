import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";

import type { RecipeView } from "@/components/recipe/view";
import { fraction } from "@/lib/domain/fraction";
import type { Quantity } from "@/lib/domain/quantity";
import type { WordForms } from "@/lib/domain/rescale";
import { getDb } from "@/lib/server/db/client";
import { guarded } from "@/lib/server/db/errors";
import * as t from "@/lib/server/db/schema";

// Чтение рецептов без проверки владельца: проверяют страницы и действия кабинета (requireOwner),
// а публичному сайту (следующий план) понадобятся те же запросы с условием `status = published`.
export type RecipeListItem = { id: string; title: string; status: "draft" | "published"; updatedAt: Date };
export type StoredRecipe = { id: string; status: "draft" | "published"; revision: number; sourceText: string; slug: string; view: RecipeView };

export function listRecipes(): Promise<RecipeListItem[]> {
  return guarded("рецепты", () =>
    getDb()
      .select({ id: t.recipes.id, title: t.recipeLocalizations.title, status: t.recipes.status, updatedAt: t.recipes.updatedAt })
      .from(t.recipes)
      .innerJoin(t.recipeLocalizations, eq(t.recipeLocalizations.recipeId, t.recipes.id))
      .where(eq(t.recipeLocalizations.locale, "ru"))
      .orderBy(desc(t.recipes.updatedAt)),
  );
}

export function getRecipe(id: string): Promise<StoredRecipe | null> {
  return guarded("рецепты", async () => {
    const db = getDb();
    const [head] = await db
      .select()
      .from(t.recipes)
      .innerJoin(t.recipeLocalizations, eq(t.recipeLocalizations.recipeId, t.recipes.id))
      .where(and(eq(t.recipes.id, id), eq(t.recipeLocalizations.locale, "ru")));
    if (!head) return null;
    const [sections, tags, ingredients, steps, tips] = await Promise.all([
      db
        .select({ code: t.sections.code, label: t.sectionLocalizations.label })
        .from(t.recipeSections)
        .innerJoin(t.sections, eq(t.sections.id, t.recipeSections.sectionId))
        .innerJoin(t.sectionLocalizations, eq(t.sectionLocalizations.sectionId, t.sections.id))
        .where(and(eq(t.recipeSections.recipeId, id), eq(t.sectionLocalizations.locale, "ru")))
        .orderBy(asc(t.recipeSections.position)),
      db
        .select({ id: t.compositionTags.code, label: t.compositionTagLocalizations.label })
        .from(t.recipeCompositionTags)
        .innerJoin(t.compositionTags, eq(t.compositionTags.id, t.recipeCompositionTags.tagId))
        .innerJoin(t.compositionTagLocalizations, eq(t.compositionTagLocalizations.tagId, t.compositionTags.id))
        .where(and(eq(t.recipeCompositionTags.recipeId, id), eq(t.compositionTagLocalizations.locale, "ru")))
        .orderBy(asc(t.recipeCompositionTags.position)),
      db.select().from(t.recipeIngredients).where(eq(t.recipeIngredients.recipeId, id)).orderBy(asc(t.recipeIngredients.position)),
      db.select().from(t.recipeSteps).where(eq(t.recipeSteps.recipeId, id)).orderBy(asc(t.recipeSteps.position)),
      db.select().from(t.recipeTips).where(eq(t.recipeTips.recipeId, id)).orderBy(asc(t.recipeTips.position)),
    ]);
    const { recipes: recipe, recipe_localizations: text } = head;
    const view: RecipeView = {
      title: text.title,
      description: text.description,
      time: text.timeText,
      yield: recipe.yieldNum && recipe.yieldDen ? { amount: fraction(recipe.yieldNum, recipe.yieldDen), forms: forms(text.yieldForms) } : null,
      sections: sections.map((item) => ({ ...item, href: null })),
      tags,
      ingredients: ingredients.map((row) => ({ id: row.id, name: row.displayName, quantity: quantityOf(row), unit: row.unit, note: row.note })),
      mainId: recipe.mainIngredientId,
      steps: steps.map((row) => ({ id: row.id, text: row.text })),
      tips: tips.map((row) => ({ id: row.id, text: row.text })),
    };
    return { id, status: recipe.status, revision: recipe.revision, sourceText: recipe.sourceText, slug: text.slug, view };
  });
}

function quantityOf(row: typeof t.recipeIngredients.$inferSelect): Quantity {
  const { quantityKind: kind, amountNum: num, amountDen: den, amountMaxNum: maxNum, amountMaxDen: maxDen } = row;
  if (kind === "exact" && num && den) return { kind, amount: fraction(num, den) };
  if (kind === "range" && num && den && maxNum && maxDen) return { kind, min: fraction(num, den), max: fraction(maxNum, maxDen) };
  return { kind: "none" };
}

const forms = (value: string[] | null): WordForms => {
  const [one = "порция", few = "порции", many = "порций"] = value ?? [];
  return [one, few, many];
};
