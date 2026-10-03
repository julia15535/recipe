import "server-only";
import { and, asc, count, eq } from "drizzle-orm";

import type { RecipeView } from "@/components/recipe/view";
import { getDb } from "@/lib/server/db/client";
import { guarded } from "@/lib/server/db/errors";
import * as t from "@/lib/server/db/schema";

import { type Locale, published, sectionPath } from "./public-paths";
import { translatedCounts, translatedRecipes } from "./public-en";
import { translatedView } from "./translated-view";
import { buildView } from "./view";

// Публичный сайт (план public-pages, ADR-0027): ТОЛЬКО опубликованные рецепты — условие `published` в каждом
// запросе; без исходного текста, ревизий и черновиков. Списки и индекс поиска — `public-lists.ts`, кэш — `public-cache.ts`.
export { type Locale, published, recipePath, sectionPath } from "./public-paths";
export type PublicSection = { code: string; label: string; slug: string; recipes: number };
export type PublicTag = { code: string; label: string };
/** `otherSlug` — адрес того же рецепта на другом языке (кнопка RU/EN, hreflang); null — перевода нет. */
export type PublicRecipe = { id: string; slug: string; otherSlug: string | null; view: RecipeView; updatedAt: string };


/** 11 разделов по порядку с числом опубликованных рецептов и теги состава — для шапки, поиска, разделов. */
export function readCatalog(locale: Locale): Promise<{ sections: PublicSection[]; tags: PublicTag[] }> {
  return guarded("сайт", async () => {
    const db = getDb();
    const counts = db
      .select({ sectionId: t.recipeSections.sectionId, n: count().as("n") })
      .from(t.recipeSections)
      .innerJoin(t.recipes, and(eq(t.recipes.id, t.recipeSections.recipeId), published))
      .groupBy(t.recipeSections.sectionId)
      .as("counts");
    const [sections, tags] = await Promise.all([
      db
        .select({ code: t.sections.code, label: t.sectionLocalizations.label, slug: t.sectionLocalizations.slug, n: counts.n })
        .from(t.sections)
        .innerJoin(t.sectionLocalizations, and(eq(t.sectionLocalizations.sectionId, t.sections.id), eq(t.sectionLocalizations.locale, locale)))
        .leftJoin(counts, eq(counts.sectionId, t.sections.id))
        .orderBy(asc(t.sections.position)),
      db
        .select({ code: t.compositionTags.code, label: t.compositionTagLocalizations.label })
        .from(t.compositionTags)
        .innerJoin(
          t.compositionTagLocalizations,
          and(eq(t.compositionTagLocalizations.tagId, t.compositionTags.id), eq(t.compositionTagLocalizations.locale, locale)),
        )
        .orderBy(asc(t.compositionTags.position)),
    ]);
    // На английском раздел «живой» только с переведёнными рецептами.
    const english = locale === "en" ? await translatedCounts(db) : null;
    return { sections: sections.map(({ n, ...rest }) => ({ ...rest, recipes: english ? (english.get(rest.code) ?? 0) : Number(n ?? 0) })), tags };
  });
}

/** Опубликованный рецепт по адресу; черновик, снятый, неизвестный — null. */
export function readPublicRecipe(locale: Locale, slug: string): Promise<PublicRecipe | null> {
  return guarded("сайт", async () => {
    const db = getDb();
    if (locale === "en") {
      const [row] = await translatedRecipes(db, { slug });
      if (!row) return null;
      const [ru] = await db.select({ slug: t.recipeLocalizations.slug }).from(t.recipeLocalizations).where(and(eq(t.recipeLocalizations.recipeId, row.recipe.id), eq(t.recipeLocalizations.locale, "ru")));
      return { id: row.recipe.id, slug, otherSlug: ru?.slug ?? null, view: await translatedView(db, row), updatedAt: row.recipe.updatedAt.toISOString() };
    }
    const [head] = await db
      .select({ recipe: t.recipes, text: t.recipeLocalizations })
      .from(t.recipes)
      .innerJoin(t.recipeLocalizations, eq(t.recipeLocalizations.recipeId, t.recipes.id))
      .where(and(published, eq(t.recipeLocalizations.locale, locale), eq(t.recipeLocalizations.slug, slug)));
    if (!head) return null;
    const view = await buildView(db, head, (sectionSlug) => sectionPath(locale, sectionSlug));
    const [english] = await translatedRecipes(db, { recipeId: head.recipe.id });
    return { id: head.recipe.id, slug, otherSlug: english?.text.slug ?? null, view, updatedAt: head.recipe.updatedAt.toISOString() };
  });
}
