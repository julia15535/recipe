import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { AppButton } from "@/components/app-button";
import { RecipeBody } from "@/components/recipe/recipe-body";
import { RecipeIntro } from "@/components/recipe/recipe-intro";
import { isTagCode } from "@/lib/domain/catalog";
import { requireOwner } from "@/lib/server/auth/owner";
import { editablePhoto } from "@/lib/server/media/photo-reads";
import { getCatalog } from "@/lib/server/recipes/catalog";
import { recipePath } from "@/lib/server/recipes/public";
import { getRecipe } from "@/lib/server/recipes/queries";
import { translationState } from "@/lib/server/recipes/translation-queue";

import { PhotoBlock } from "../_components/photo-block";
import { RecipeActions } from "../_components/recipe-actions";
import { TranslationBlock } from "../_components/translation-block";
import { StatusBadge } from "../_components/status-badge";
import { TagsBlock } from "../_components/tags-block";

export const metadata: Metadata = { title: "Рецепт · Кабинет владельца" };

// Рецепт в кабинете — как будет на сайте, плюс статус и действия.
export default async function RecipePage({ params }: PageProps<"/admin/recipes/[id]">) {
  await requireOwner();
  const id = z.uuid().safeParse((await params).id);
  const [recipe, editable, translation, catalog] = id.success
    ? await Promise.all([getRecipe(id.data), editablePhoto(id.data), translationState(id.data), getCatalog()])
    : [null, null, null, null];
  if (!recipe || !catalog) notFound();
  const tags = catalog.tags.flatMap(({ code, label }) => (isTagCode(code) ? [{ code, label }] : []));
  const photo = recipe.view.photo && editable?.id === recipe.view.photo.id ? { ...recipe.view.photo, size: editable.size, crop: editable.crop } : null;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-4 py-6">
      <div className="flex flex-col gap-4 px-4">
        <AppButton color="tertiary" href="/admin" className="self-start">
          ← Мои рецепты
        </AppButton>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={recipe.status} />
        </div>
        <RecipeActions id={recipe.id} status={recipe.status} siteHref={recipePath("ru", recipe.slug)} />
        <PhotoBlock recipeId={recipe.id} title={recipe.view.title} photo={photo} />
        <TagsBlock recipeId={recipe.id} revision={recipe.revision} tags={tags} current={recipe.view.tags.map((tag) => tag.id).filter(isTagCode)} />
        {translation && <TranslationBlock id={recipe.id} published={recipe.status === "published"} state={translation} />}
      </div>
      <RecipeBody recipe={recipe.view}>
        <RecipeIntro recipe={recipe.view} />
      </RecipeBody>
    </main>
  );
}
