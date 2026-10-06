import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

import type { ArticleView } from "@/components/article/view";
import type { CardData } from "@/components/recipe/recipe-card";
import type { PhotoRef } from "@/lib/domain/photo";
import { getDb } from "@/lib/server/db/client";
import { guarded } from "@/lib/server/db/errors";
import * as t from "@/lib/server/db/schema";
import { readCards } from "@/lib/server/recipes/public-lists";
import { type Locale, recipePath } from "@/lib/server/recipes/public-paths";

import { articlePhotos } from "./photo-reads";
import { bodyOf } from "./queries";
import { coverOf, toArticleView } from "./view";

// Статьи на сайте (ADR-0034): только опубликованные — и сами статьи, и связанные рецепты; английских статей пока
// нет (план articles-en) — на /en пусто. Возвращаем простые объекты: результат идёт в кэш страниц (`"use cache"`).
export type PublicArticleCard = { id: string; slug: string; title: string; excerpt: string | null; photo: PhotoRef | null };
export type PublicArticle = { id: string; slug: string; excerpt: string | null; cover: PhotoRef | null; view: ArticleView; updatedAt: string };

export const articlePath = (locale: Locale, slug: string) => `/${locale}/articles/${slug}`;
const published = eq(t.articles.status, "published");
const ru = and(eq(t.articleLocalizations.articleId, t.articles.id), eq(t.articleLocalizations.locale, "ru"));

async function cards(filter: { ids?: string[]; limit?: number }): Promise<PublicArticleCard[]> {
  const db = getDb();
  const query = db
    .select({ id: t.articles.id, body: t.articles.body, slug: t.articleLocalizations.slug, title: t.articleLocalizations.title, excerpt: t.articleLocalizations.excerpt })
    .from(t.articles)
    .innerJoin(t.articleLocalizations, ru)
    .where(and(published, filter.ids ? inArray(t.articles.id, filter.ids) : undefined))
    .orderBy(desc(t.articles.publishedAt), desc(t.articles.id));
  const rows = filter.limit ? await query.limit(filter.limit) : await query;
  const photos = await articlePhotos(db, rows.map((row) => row.id));
  return rows.flatMap(({ body: raw, ...row }) => {
    const body = bodyOf(raw, row.id);
    return body ? [{ ...row, photo: coverOf(body, photos.get(row.id))?.ref ?? null }] : [];
  });
}

export function readArticleCards(locale: Locale, options: { limit?: number } = {}): Promise<PublicArticleCard[]> {
  if (locale !== "ru") return Promise.resolve([]);
  return guarded("сайт", () => cards(options));
}

/** Статьи, связанные с рецептом, — блок «Связанные статьи» на странице рецепта. */
export function readRecipeArticles(locale: Locale, recipeId: string): Promise<PublicArticleCard[]> {
  if (locale !== "ru") return Promise.resolve([]);
  return guarded("сайт", async () => {
    const links = await getDb().select({ id: t.articleRecipes.articleId }).from(t.articleRecipes).where(eq(t.articleRecipes.recipeId, recipeId));
    return links.length ? cards({ ids: links.map((link) => link.id) }) : [];
  });
}

export function readPublicArticle(locale: Locale, slug: string): Promise<PublicArticle | null> {
  if (locale !== "ru") return Promise.resolve(null);
  return guarded("сайт", async () => {
    const db = getDb();
    const [head] = await db
      .select({ article: t.articles, text: t.articleLocalizations })
      .from(t.articles)
      .innerJoin(t.articleLocalizations, ru)
      .where(and(published, eq(t.articleLocalizations.slug, slug)));
    const body = head ? bodyOf(head.article.body, head.article.id) : null;
    if (!head || !body) return null;
    const id = head.article.id;
    const [photos, links, recipes] = await Promise.all([
      articlePhotos(db, [id]),
      db.select({ id: t.articleRecipes.recipeId }).from(t.articleRecipes).where(eq(t.articleRecipes.articleId, id)).orderBy(asc(t.articleRecipes.position)),
      readCards(locale),
    ]);
    // Связанные — только опубликованные рецепты (снятый пропадает, связь остаётся), в порядке, выбранном владельцем.
    const byId = new Map(recipes.map((card) => [card.id, card]));
    const related: CardData[] = links.flatMap(({ id: recipeId }) => {
      const card = byId.get(recipeId);
      return card ? [{ href: recipePath(locale, card.slug), title: card.title, time: card.time, section: card.section, photo: card.photo, tag: card.tag }] : [];
    });
    const own = photos.get(id) ?? new Map();
    return {
      id,
      slug: head.text.slug,
      excerpt: head.text.excerpt,
      cover: coverOf(body, own)?.ref ?? null,
      view: toArticleView(head.text.title, body, own, related),
      updatedAt: head.article.updatedAt.toISOString(),
    };
  });
}
