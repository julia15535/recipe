import "server-only";
import { and, asc, count, eq } from "drizzle-orm";

import type { RecipeView } from "@/components/recipe/view";
import { getDb } from "@/lib/server/db/client";
import { guarded } from "@/lib/server/db/errors";
import * as t from "@/lib/server/db/schema";

import { buildView } from "./view";

// Публичный сайт (план public-pages, ADR-0027): ТОЛЬКО опубликованные рецепты — условие `published` в каждом
// запросе; без исходного текста, ревизий и черновиков. Списки и индекс поиска — `public-lists.ts`, кэш — `public-cache.ts`.
export type Locale = "ru";
export type PublicSection = { code: string; label: string; slug: string; recipes: number };
export type PublicTag = { code: string; label: string };
export type PublicRecipe = { id: string; slug: string; view: RecipeView; updatedAt: string };

export const published = eq(t.recipes.status, "published");
export const sectionPath = (locale: Locale, slug: string) => `/${locale}/catalog/${slug}`;
export const recipePath = (locale: Locale, slug: string) => `/${locale}/recipe/${slug}`;

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
    return { sections: sections.map(({ n, ...rest }) => ({ ...rest, recipes: Number(n ?? 0) })), tags };
  });
}

/** Опубликованный рецепт по адресу; черновик, снятый, неизвестный — null. */
export function readPublicRecipe(locale: Locale, slug: string): Promise<PublicRecipe | null> {
  return guarded("сайт", async () => {
    const db = getDb();
    const [head] = await db
      .select({ recipe: t.recipes, text: t.recipeLocalizations })
      .from(t.recipes)
      .innerJoin(t.recipeLocalizations, eq(t.recipeLocalizations.recipeId, t.recipes.id))
      .where(and(published, eq(t.recipeLocalizations.locale, locale), eq(t.recipeLocalizations.slug, slug)));
    if (!head) return null;
    const view = await buildView(db, head, (sectionSlug) => sectionPath(locale, sectionSlug));
    return { id: head.recipe.id, slug, view, updatedAt: head.recipe.updatedAt.toISOString() };
  });
}
