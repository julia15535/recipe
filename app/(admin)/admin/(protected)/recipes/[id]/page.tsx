import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { AppButton } from "@/components/app-button";
import { RecipeBody } from "@/components/recipe/recipe-body";
import { RecipeIntro } from "@/components/recipe/recipe-intro";
import { requireOwner } from "@/lib/server/auth/owner";
import { getRecipe } from "@/lib/server/recipes/queries";

import { RecipeActions } from "../_components/recipe-actions";
import { StatusBadge } from "../_components/status-badge";

export const metadata: Metadata = { title: "Рецепт · Кабинет владельца" };

// Рецепт в кабинете — как будет на сайте, плюс статус и действия.
export default async function RecipePage({ params }: PageProps<"/admin/recipes/[id]">) {
  await requireOwner();
  const id = z.uuid().safeParse((await params).id);
  const recipe = id.success ? await getRecipe(id.data) : null;
  if (!recipe) notFound();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-4 py-6">
      <div className="flex flex-col gap-4 px-4">
        <AppButton color="tertiary" href="/admin" className="self-start">
          ← Мои рецепты
        </AppButton>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={recipe.status} />
          {recipe.status === "published" && (
            <p className="text-sm text-tertiary">Появится на сайте, когда откроем страницы рецептов.</p>
          )}
        </div>
        <RecipeActions id={recipe.id} status={recipe.status} />
      </div>
      <RecipeBody recipe={recipe.view}>
        <RecipeIntro recipe={recipe.view} />
      </RecipeBody>
    </main>
  );
}
