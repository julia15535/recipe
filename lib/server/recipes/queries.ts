import "server-only";
import { and, desc, eq } from "drizzle-orm";

import type { RecipeView } from "@/components/recipe/view";
import { getDb } from "@/lib/server/db/client";
import { guarded } from "@/lib/server/db/errors";
import * as t from "@/lib/server/db/schema";

import { buildView } from "./view";

// Чтение рецептов для кабинета — любые статусы, с исходным текстом; без проверки владельца (её делают страницы
// и действия кабинета, requireOwner). Публичный сайт читает только опубликованное — `public.ts`.
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
      .select({ recipe: t.recipes, text: t.recipeLocalizations })
      .from(t.recipes)
      .innerJoin(t.recipeLocalizations, eq(t.recipeLocalizations.recipeId, t.recipes.id))
      .where(and(eq(t.recipes.id, id), eq(t.recipeLocalizations.locale, "ru")));
    if (!head) return null;
    const view = await buildView(db, head, null);
    const { recipe, text } = head;
    return { id, status: recipe.status, revision: recipe.revision, sourceText: recipe.sourceText, slug: text.slug, view };
  });
}
