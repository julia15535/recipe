import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { AppButton } from "@/components/app-button";
import { requireOwner } from "@/lib/server/auth/owner";
import { getAiConfig } from "@/lib/server/env";
import { getRecipe } from "@/lib/server/recipes/queries";

import { RecipeEditor } from "../../_components/recipe-editor";

export const metadata: Metadata = { title: "Изменить рецепт · Кабинет владельца" };

// Правка = новая версия текста целиком: адрес и статус рецепта не меняются (решение владельца 02.10).
export default async function EditRecipePage({ params }: PageProps<"/admin/recipes/[id]/edit">) {
  await requireOwner();
  const id = z.uuid().safeParse((await params).id);
  const recipe = id.success ? await getRecipe(id.data) : null;
  if (!recipe) notFound();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 py-6">
      <AppButton color="tertiary" href={`/admin/recipes/${recipe.id}`} className="self-start">
        ← К рецепту
      </AppButton>
      <h1 className="font-display text-display-xs break-words text-primary">Изменить: {recipe.view.title}</h1>
      <RecipeEditor initialText={recipe.sourceText} recipe={{ id: recipe.id, revision: recipe.revision }} aiEnabled={getAiConfig() !== null} />
    </main>
  );
}
