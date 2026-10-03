import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";

import type { TranslationBody } from "@/lib/domain/translation";
import { translationBodySchema } from "@/lib/server/ai/translate-schema";
import { type Executor, getDb } from "@/lib/server/db/client";
import * as t from "@/lib/server/db/schema";
import { log } from "@/lib/server/log";
import { photoRefs } from "@/lib/server/media/photo-reads";

import type { PublicCard, SearchItem } from "./public-lists";
import { published } from "./public-paths";

// Английский сайт (ADR-0029): только опубликованные рецепты с готовым переводом (локализация `en` + снимок). Всё,
// что показывает страница, — из снимка на момент перевода: правка русского рецепта английский не меняет.
const en = (column: typeof t.recipeLocalizations.locale | typeof t.sectionLocalizations.locale) => eq(column, "en");
const translated = and(eq(t.recipeTranslations.recipeId, t.recipes.id), eq(t.recipeTranslations.locale, "en"));

/** Снимок из базы проверяется заново: испорченный — в лог и «перевода нет», страница не падает. */
function bodyOf(raw: unknown, recipeId: string): TranslationBody | null {
  const parsed = translationBodySchema.safeParse(raw);
  if (!parsed.success) log.error("перевод: снимок не прошёл проверку", { recipe: recipeId.slice(0, 8) });
  return parsed.success ? parsed.data : null;
}

/** Переведённые опубликованные рецепты: шапка (локализация en) и снимок, новые сверху. */
export async function translatedRecipes(db: Executor, filter?: { slug?: string; recipeId?: string; sectionCode?: string; limit?: number }) {
  const where = and(
    published,
    filter?.slug ? eq(t.recipeLocalizations.slug, filter.slug) : undefined,
    filter?.recipeId ? eq(t.recipes.id, filter.recipeId) : undefined,
    filter?.sectionCode ? sql`jsonb_exists(${t.recipeTranslations.body} -> 'sectionCodes', ${filter.sectionCode})` : undefined,
  );
  const query = db
    .select({ recipe: t.recipes, text: t.recipeLocalizations, body: t.recipeTranslations.body })
    .from(t.recipes)
    .innerJoin(t.recipeLocalizations, and(eq(t.recipeLocalizations.recipeId, t.recipes.id), en(t.recipeLocalizations.locale)))
    .innerJoin(t.recipeTranslations, translated)
    .where(where)
    .orderBy(desc(t.recipes.publishedAt), desc(t.recipes.id));
  const rows = filter?.limit ? await query.limit(filter.limit) : await query;
  return rows.flatMap((row) => {
    const body = bodyOf(row.body, row.recipe.id);
    return body ? [{ recipe: row.recipe, text: row.text, body }] : [];
  });
}

/** Английские названия и адреса разделов, названия тегов — по кодам. */
export async function englishCatalog(db: Executor) {
  const [sections, tags] = await Promise.all([
    db
      .select({ code: t.sections.code, label: t.sectionLocalizations.label, slug: t.sectionLocalizations.slug })
      .from(t.sections)
      .innerJoin(t.sectionLocalizations, and(eq(t.sectionLocalizations.sectionId, t.sections.id), en(t.sectionLocalizations.locale))),
    db
      .select({ code: t.compositionTags.code, label: t.compositionTagLocalizations.label })
      .from(t.compositionTags)
      .innerJoin(t.compositionTagLocalizations, and(eq(t.compositionTagLocalizations.tagId, t.compositionTags.id), eq(t.compositionTagLocalizations.locale, "en"))),
  ]);
  return { sections: new Map(sections.map((row) => [row.code, row])), tags: new Map(tags.map((row) => [row.code, row.label])) };
}

/** Сколько переведённых опубликованных рецептов в каждом разделе (раздел без них на /en — пустой). */
export async function translatedCounts(db: Executor): Promise<Map<string, number>> {
  const rows = await db
    .select({ id: t.recipes.id, body: t.recipeTranslations.body })
    .from(t.recipes)
    .innerJoin(t.recipeTranslations, translated)
    .innerJoin(t.recipeLocalizations, and(eq(t.recipeLocalizations.recipeId, t.recipes.id), en(t.recipeLocalizations.locale)))
    .where(published);
  const counts = new Map<string, number>();
  // Только проверенные снимки: испорченный не показывается — и в счётчике его быть не должно.
  for (const row of rows) for (const code of bodyOf(row.body, row.id)?.sectionCodes ?? []) counts.set(code, (counts.get(code) ?? 0) + 1);
  return counts;
}

/** Английские карточки и записи поиска — из снимков (разделы, теги, ингредиенты на момент перевода). */
export async function englishItems(filter: { sectionCode?: string; limit?: number } = {}): Promise<{ card: PublicCard; search: SearchItem }[]> {
  const db = getDb();
  const rows = await translatedRecipes(db, filter);
  const [catalog, photos] = await Promise.all([englishCatalog(db), photoRefs(db, rows.map((row) => row.recipe.id))]);
  return rows.map(({ recipe, text, body }) => {
    const card = {
      slug: text.slug,
      title: text.title,
      time: text.timeText,
      section: { code: body.primarySectionCode, label: catalog.sections.get(body.primarySectionCode)?.label ?? "" },
      photo: photos.get(recipe.id) ?? null,
    };
    return { card: { id: recipe.id, ...card }, search: { ...card, ingredients: body.ingredients.map((row) => row.name), sections: body.sectionCodes, tagCodes: body.tagCodes } };
  });
}
