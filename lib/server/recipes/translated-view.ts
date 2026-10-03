import "server-only";

import type { RecipeView } from "@/components/recipe/view";
import type { Executor } from "@/lib/server/db/client";
import { photoRefs } from "@/lib/server/media/photo-reads";

import { englishCatalog, type translatedRecipes } from "./public-en";
import { sectionPath } from "./public-paths";

// Модель показа английского рецепта из снимка перевода (ADR-0029): разделы и теги — английские названия по кодам,
// ингредиенты — с видом строки для округления и формами авторской единицы, фото — общее с русским.
type Translated = Awaited<ReturnType<typeof translatedRecipes>>[number];

/** Модель показа английского рецепта из снимка. */
export async function translatedView(db: Executor, { recipe, text, body }: Translated): Promise<RecipeView> {
  const [catalog, photos] = await Promise.all([englishCatalog(db), photoRefs(db, [recipe.id])]);
  const [one, other] = text.yieldForms ?? [];
  const forms: readonly [string, string] = one && other ? [one, other] : ["serving", "servings"];
  return {
    title: text.title,
    description: text.description,
    time: text.timeText,
    yield: body.yield ? { amount: body.yield, forms } : null,
    sections: body.sectionCodes.flatMap((code) => {
      const section = catalog.sections.get(code);
      return section ? [{ code, label: section.label, href: sectionPath("en", section.slug) }] : [];
    }),
    tags: body.tagCodes.flatMap((code) => (catalog.tags.has(code) ? [{ id: code, label: catalog.tags.get(code) ?? code }] : [])),
    ingredients: body.ingredients.map(({ id, name, note, quantity, unit, kind, unitForms }) => ({ id, name, note, quantity, unit, kind, unitForms })),
    mainId: body.mainId,
    steps: body.steps,
    tips: body.tips,
    photo: photos.get(recipe.id) ?? null,
  };
}

