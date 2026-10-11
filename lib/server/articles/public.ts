import "server-only";
import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";

import type { ArticleView } from "@/components/article/view";
import type { CardData } from "@/components/recipe/recipe-card";
import type { PhotoRef } from "@/lib/domain/photo";
import { getDb } from "@/lib/server/db/client";
import { guarded } from "@/lib/server/db/errors";
import * as t from "@/lib/server/db/schema";
import { readCards } from "@/lib/server/recipes/public-lists";
import { type Locale, recipePath } from "@/lib/server/recipes/public-paths";

import { articlePhotos } from "./photo-reads";
import { contentOf, withCaptions } from "./public-content";
import { coverOf, toArticleView } from "./view";

// Статьи на сайте (ADR-0034, ADR-0038): только опубликованные — и сами статьи, и связанные рецепты. Английская статья
// есть, если есть английская локализация и снимок перевода проходит проверку (испорченный — в лог, статьи нет);
// её текст и подписи — из снимка, фото — общие. Возвращаем простые объекты: результат идёт в кэш (`"use cache"`).
export type PublicArticleCard = { id: string; slug: string; title: string; excerpt: string | null; photo: PhotoRef | null };
export type PublicArticle = {
  id: string;
  slug: string;
  /** Адрес пары на другом языке (нет перевода — null). */
  otherSlug: string | null;
  excerpt: string | null;
  cover: PhotoRef | null;
  view: ArticleView;
  updatedAt: string;
};

export const articlePath = (locale: Locale, slug: string) => `/${locale}/articles/${slug}`;
const published = eq(t.articles.status, "published");
const localized = (locale: Locale) => and(eq(t.articleLocalizations.articleId, t.articles.id), eq(t.articleLocalizations.locale, locale));
const translated = and(eq(t.articleTranslations.articleId, t.articles.id), eq(t.articleTranslations.locale, "en"));

async function cards(locale: Locale, filter: { ids?: string[]; limit?: number }): Promise<PublicArticleCard[]> {
  const db = getDb();
  const base = db
    .select({ id: t.articles.id, body: t.articles.body, english: t.articleTranslations.body, slug: t.articleLocalizations.slug, title: t.articleLocalizations.title, excerpt: t.articleLocalizations.excerpt })
    .from(t.articles)
    .innerJoin(t.articleLocalizations, localized(locale))
    .leftJoin(t.articleTranslations, translated)
    .where(and(published, locale === "en" ? isNotNull(t.articleTranslations.articleId) : undefined, filter.ids ? inArray(t.articles.id, filter.ids) : undefined))
    .orderBy(desc(t.articles.publishedAt), desc(t.articles.id));
  const rows = filter.limit ? await base.limit(filter.limit) : await base;
  const photos = await articlePhotos(db, rows.map((row) => row.id));
  return rows.flatMap(({ body, english, ...row }) => {
    const content = contentOf(locale, { id: row.id, body, english });
    return content ? [{ ...row, photo: coverOf(content.body, photos.get(row.id))?.ref ?? null }] : [];
  });
}

export function readArticleCards(locale: Locale, options: { limit?: number } = {}): Promise<PublicArticleCard[]> {
  return guarded("сайт", () => cards(locale, options));
}

/** Статьи, связанные с рецептом, — блок «Статьи по рецепту» на странице рецепта. */
export function readRecipeArticles(locale: Locale, recipeId: string): Promise<PublicArticleCard[]> {
  return guarded("сайт", async () => {
    const links = await getDb().select({ id: t.articleRecipes.articleId }).from(t.articleRecipes).where(eq(t.articleRecipes.recipeId, recipeId));
    return links.length ? cards(locale, { ids: links.map((link) => link.id) }) : [];
  });
}

export function readPublicArticle(locale: Locale, slug: string): Promise<PublicArticle | null> {
  return guarded("сайт", async () => {
    const db = getDb();
    const [head] = await db
      .select({ article: t.articles, text: t.articleLocalizations, english: t.articleTranslations.body })
      .from(t.articles)
      .innerJoin(t.articleLocalizations, localized(locale))
      .leftJoin(t.articleTranslations, translated)
      .where(and(published, eq(t.articleLocalizations.slug, slug)));
    const content = head ? contentOf(locale, { id: head.article.id, body: head.article.body, english: head.english }) : null;
    if (!head || !content) return null;
    const id = head.article.id;
    const other = locale === "ru" ? "en" : "ru";
    const [photos, links, recipes, [pair]] = await Promise.all([
      articlePhotos(db, [id]),
      db.select({ id: t.articleRecipes.recipeId }).from(t.articleRecipes).where(eq(t.articleRecipes.articleId, id)).orderBy(asc(t.articleRecipes.position)),
      readCards(locale),
      db
        .select({ slug: t.articleLocalizations.slug, english: t.articleTranslations.articleId })
        .from(t.articleLocalizations)
        .leftJoin(t.articleTranslations, and(eq(t.articleTranslations.articleId, t.articleLocalizations.articleId), eq(t.articleTranslations.locale, "en")))
        .where(and(eq(t.articleLocalizations.articleId, id), eq(t.articleLocalizations.locale, other))),
    ]);
    // Связанные — только опубликованные (на /en — только переведённые) рецепты, в порядке, выбранном владельцем.
    const byId = new Map(recipes.map((card) => [card.id, card]));
    const related: CardData[] = links.flatMap(({ id: recipeId }) => {
      const card = byId.get(recipeId);
      return card ? [{ href: recipePath(locale, card.slug), title: card.title, time: card.time, section: card.section, photo: card.photo, tag: card.tag }] : [];
    });
    const own = withCaptions(photos.get(id), content.captions);
    return {
      id,
      slug: head.text.slug,
      // Пара на английском есть, только если есть и снимок перевода.
      otherSlug: pair && (other === "ru" || pair.english) ? pair.slug : null,
      excerpt: head.text.excerpt,
      cover: coverOf(content.body, own)?.ref ?? null,
      view: toArticleView(head.text.title, content.body, own, related),
      updatedAt: head.article.updatedAt.toISOString(),
    };
  });
}
