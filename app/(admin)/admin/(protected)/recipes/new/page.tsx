import type { Metadata } from "next";

import { AppButton } from "@/components/app-button";
import { requireOwner } from "@/lib/server/auth/owner";

import { RecipeEditor } from "../_components/recipe-editor";

export const metadata: Metadata = { title: "Новый рецепт · Кабинет владельца" };

export default async function NewRecipePage() {
  await requireOwner();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 py-6">
      <AppButton color="tertiary" href="/admin" className="self-start">
        ← Мои рецепты
      </AppButton>
      <h1 className="font-display text-display-xs text-primary">Новый рецепт</h1>
      <RecipeEditor />
    </main>
  );
}
