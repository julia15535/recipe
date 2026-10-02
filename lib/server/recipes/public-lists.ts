import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/lib/server/db/client";
import { guarded } from "@/lib/server/db/errors";
import * as t from "@/lib/server/db/schema";

import { type Locale, published } from "./public";

// Списки опубликованных рецептов для сайта (ADR-0027): карточки (главная, раздел) и компактный индекс поиска.
// Агрегированными запросами — без запроса на каждую карточку; черновики не попадают (`published`).
export type PublicCard = { id: string; slug: string; title: string; time: string | null; section: { code: string; label: string } };
export type SearchItem = Omit<PublicCard, "id"> & { ingredients: string[]; sections: string[]; tagCodes: string[] };

/** Карточки: новые сверху (по дате первой публикации), опционально — одного раздела (и где он не основной). */
export function readCards(locale: Locale, options: { sectionCode?: string; limit?: number } = {}): Promise<PublicCard[]> {
  return guarded("сайт", async () => {
    const inSection = options.sectionCode
      ? sql`exists (select 1 from ${t.recipeSections} rs join ${t.sections} s on s.id = rs.section_id
          where rs.recipe_id = ${t.recipes.id} and s.code = ${options.sectionCode})`
      : undefined;
    const query = getDb()
      .select({
        id: t.recipes.id,
        slug: t.recipeLocalizations.slug,
        title: t.recipeLocalizations.title,
        time: t.recipeLocalizations.timeText,
        code: t.sections.code,
        label: t.sectionLocalizations.label,
      })
      .from(t.recipes)
      .innerJoin(t.recipeLocalizations, and(eq(t.recipeLocalizations.recipeId, t.recipes.id), eq(t.recipeLocalizations.locale, locale)))
      .innerJoin(t.sections, eq(t.sections.id, t.recipes.primarySectionId))
      .innerJoin(t.sectionLocalizations, and(eq(t.sectionLocalizations.sectionId, t.sections.id), eq(t.sectionLocalizations.locale, locale)))
      .where(and(published, inSection))
      .orderBy(desc(t.recipes.publishedAt), desc(t.recipes.id));
    const rows = options.limit ? await query.limit(options.limit) : await query;
    return rows.map(({ code, label, ...card }) => ({ ...card, section: { code, label } }));
  });
}

/** Компактный индекс поиска: карточка + названия ингредиентов, коды разделов и тегов (без шагов и пометок). */
export function readSearchIndex(locale: Locale): Promise<SearchItem[]> {
  return guarded("сайт", async () => {
    const db = getDb();
    const cards = await readCards(locale);
    if (cards.length === 0) return [];
    const ids = cards.map((card) => card.id);
    const [ingredients, sections, tags] = await Promise.all([
      db
        .select({ recipeId: t.recipeIngredients.recipeId, name: t.recipeIngredients.displayName })
        .from(t.recipeIngredients)
        .where(inArray(t.recipeIngredients.recipeId, ids)),
      db
        .select({ recipeId: t.recipeSections.recipeId, name: t.sections.code })
        .from(t.recipeSections)
        .innerJoin(t.sections, eq(t.sections.id, t.recipeSections.sectionId))
        .where(inArray(t.recipeSections.recipeId, ids)),
      db
        .select({ recipeId: t.recipeCompositionTags.recipeId, name: t.compositionTags.code })
        .from(t.recipeCompositionTags)
        .innerJoin(t.compositionTags, eq(t.compositionTags.id, t.recipeCompositionTags.tagId))
        .where(inArray(t.recipeCompositionTags.recipeId, ids)),
    ]);
    const [byIngredient, bySection, byTag] = [ingredients, sections, tags].map(group);
    return cards.map(({ id, ...card }) => ({
      ...card,
      ingredients: byIngredient?.get(id) ?? [],
      sections: bySection?.get(id) ?? [],
      tagCodes: byTag?.get(id) ?? [],
    }));
  });
}

function group(rows: { recipeId: string; name: string }[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const row of rows) map.set(row.recipeId, [...(map.get(row.recipeId) ?? []), row.name]);
  return map;
}
