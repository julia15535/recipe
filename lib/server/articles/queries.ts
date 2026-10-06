import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";

import type { ArticleBody } from "@/lib/domain/article-text/types";
import { getDb } from "@/lib/server/db/client";
import { guarded } from "@/lib/server/db/errors";
import * as t from "@/lib/server/db/schema";
import { log } from "@/lib/server/log";

import { articleBodySchema } from "./body-schema";
import { type ArticlePhoto, articlePhotos } from "./photo-reads";

// Статьи для кабинета — любые статусы, с текстом и всеми фото (в том числе «без места»); проверка владельца — на
// страницах и в действиях (requireOwner). Сайт читает только опубликованное — `public.ts`.
export type ArticleListItem = { id: string; title: string; status: "draft" | "published"; updatedAt: Date };
export type StoredArticle = {
  id: string;
  status: "draft" | "published";
  revision: number;
  title: string;
  slug: string;
  sourceText: string;
  body: ArticleBody;
  photos: Map<string, ArticlePhoto>;
  recipes: { id: string; title: string; status: "draft" | "published" }[];
};

/** Документ из БД через Zod: битый — в лог и null (страница не падает). */
export function bodyOf(raw: unknown, id: string): ArticleBody | null {
  const parsed = articleBodySchema.safeParse(raw);
  if (!parsed.success) log.error("статья: документ не прошёл проверку", { article: id.slice(0, 8) });
  return parsed.success ? parsed.data : null;
}

export function listArticles(): Promise<ArticleListItem[]> {
  return guarded("статьи", () =>
    getDb()
      .select({ id: t.articles.id, title: t.articleLocalizations.title, status: t.articles.status, updatedAt: t.articles.updatedAt })
      .from(t.articles)
      .innerJoin(t.articleLocalizations, and(eq(t.articleLocalizations.articleId, t.articles.id), eq(t.articleLocalizations.locale, "ru")))
      .orderBy(desc(t.articles.updatedAt)),
  );
}

export function getArticle(id: string): Promise<StoredArticle | null> {
  return guarded("статьи", async () => {
    const db = getDb();
    const [head] = await db
      .select({ article: t.articles, text: t.articleLocalizations })
      .from(t.articles)
      .innerJoin(t.articleLocalizations, and(eq(t.articleLocalizations.articleId, t.articles.id), eq(t.articleLocalizations.locale, "ru")))
      .where(eq(t.articles.id, id));
    const body = head ? bodyOf(head.article.body, id) : null;
    if (!head || !body) return null;
    const [photos, recipes] = await Promise.all([
      articlePhotos(db, [id]),
      db
        .select({ id: t.recipes.id, title: t.recipeLocalizations.title, status: t.recipes.status })
        .from(t.articleRecipes)
        .innerJoin(t.recipes, eq(t.recipes.id, t.articleRecipes.recipeId))
        .innerJoin(t.recipeLocalizations, and(eq(t.recipeLocalizations.recipeId, t.recipes.id), eq(t.recipeLocalizations.locale, "ru")))
        .where(eq(t.articleRecipes.articleId, id))
        .orderBy(asc(t.articleRecipes.position)),
    ]);
    const { article, text } = head;
    return {
      id,
      status: article.status,
      revision: article.revision,
      title: text.title,
      slug: text.slug,
      sourceText: article.sourceText,
      body,
      photos: photos.get(id) ?? new Map(),
      recipes,
    };
  });
}

/** Коды фото статьи — метки в тексте должны ссылаться только на них. */
export function photoKeys(articleId: string): Promise<Set<string>> {
  return guarded("статьи", async () => {
    const rows = await getDb().select({ key: t.articlePhotos.key }).from(t.articlePhotos).where(eq(t.articlePhotos.articleId, articleId));
    return new Set(rows.map((row) => row.key));
  });
}
