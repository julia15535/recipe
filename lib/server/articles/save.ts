import "server-only";
import { randomUUID } from "node:crypto";

import { and, eq, ne, sql } from "drizzle-orm";

import { excerptOf } from "@/lib/domain/article-text/assemble";
import type { ArticleBody } from "@/lib/domain/article-text/types";
import { slugify } from "@/lib/domain/recipe-text/slug";
import { type Executor, getDb } from "@/lib/server/db/client";
import { guarded, isUniqueViolation } from "@/lib/server/db/errors";
import { articleLocalizations, articleRecipes, articles } from "@/lib/server/db/schema";

// Запись статей (ADR-0034): новая — одной транзакцией с адресом из названия (`-2`, `-3`… при совпадении); замена
// текста — по `revision` (устаревшая вкладка — конфликт), адрес и статус не меняются. Проверенные блоки собирает
// действие кабинета из разбора на сервере (`article_imports`), сюда приходят уже они.
export type ArticleDraft = { title: string; sourceText: string; body: ArticleBody };
export type ArticleOutcome = { ok: true; id: string; revision: number } | { ok: false; reason: "conflict" | "not-found" };

const texts = (draft: ArticleDraft) => ({ title: draft.title.trim(), excerpt: excerptOf(draft.body) });

export function createArticle(draft: ArticleDraft, status: "draft" | "published"): Promise<ArticleOutcome> {
  const id = randomUUID();
  return guarded("статьи", () =>
    getDb().transaction(async (tx) => {
      const publishedAt = status === "published" ? sql`now()` : null;
      await tx.insert(articles).values({ id, status, sourceText: draft.sourceText, body: draft.body, publishedAt });
      await insertWithFreeSlug(tx, id, texts(draft), slugify(draft.title) ?? `article-${id.slice(0, 8)}`);
      return { ok: true, id, revision: 1 } as const;
    }),
  );
}

export function replaceArticle(id: string, expectedRevision: number, draft: ArticleDraft): Promise<ArticleOutcome> {
  return guarded("статьи", () =>
    getDb().transaction(async (tx) => {
      const [updated] = await tx
        .update(articles)
        .set({
          sourceText: draft.sourceText,
          body: draft.body,
          revision: sql`${articles.revision} + 1`,
          contentRevision: sql`${articles.contentRevision} + 1`,
          updatedAt: sql`now()`,
        })
        .where(and(eq(articles.id, id), eq(articles.revision, expectedRevision)))
        .returning({ revision: articles.revision });
      if (!updated) return missing(tx, id);
      await tx
        .update(articleLocalizations)
        .set(texts(draft))
        .where(and(eq(articleLocalizations.articleId, id), eq(articleLocalizations.locale, "ru")));
      return { ok: true, id, revision: updated.revision } as const;
    }),
  );
}

/** Опубликовать / снять — как у рецептов: `published_at` — первая публикация; тот же статус ничего не меняет. */
export async function setArticleStatus(id: string, status: "draft" | "published"): Promise<boolean> {
  const rows = await guarded("статьи", () =>
    getDb()
      .update(articles)
      .set({
        status,
        publishedAt: status === "published" ? sql`coalesce(${articles.publishedAt}, now())` : sql`${articles.publishedAt}`,
        revision: sql`${articles.revision} + 1`,
        updatedAt: sql`now()`,
      })
      .where(and(eq(articles.id, id), ne(articles.status, status)))
      .returning({ id: articles.id }),
  );
  if (rows.length > 0) return true;
  const [exists] = await guarded("статьи", () => getDb().select({ id: articles.id }).from(articles).where(eq(articles.id, id)));
  return exists !== undefined;
}

/** Удалить можно только черновик; фото и связи уходят каскадом. */
export async function deleteArticleDraft(id: string): Promise<boolean> {
  const rows = await guarded("статьи", () =>
    getDb()
      .delete(articles)
      .where(and(eq(articles.id, id), eq(articles.status, "draft")))
      .returning({ id: articles.id }),
  );
  return rows.length > 0;
}

/** Связанные рецепты целиком (порядок — как выбраны); не меняет текст — `content_revision` не растёт. */
export function setArticleRecipes(id: string, expectedRevision: number, recipeIds: readonly string[]): Promise<ArticleOutcome> {
  return guarded("статьи", () =>
    getDb().transaction(async (tx) => {
      const [updated] = await tx
        .update(articles)
        .set({ revision: sql`${articles.revision} + 1`, updatedAt: sql`now()` })
        .where(and(eq(articles.id, id), eq(articles.revision, expectedRevision)))
        .returning({ revision: articles.revision });
      if (!updated) return missing(tx, id);
      await tx.delete(articleRecipes).where(eq(articleRecipes.articleId, id));
      const rows = [...new Set(recipeIds)].slice(0, 20).map((recipeId, position) => ({ articleId: id, recipeId, position }));
      if (rows.length) await tx.insert(articleRecipes).values(rows);
      return { ok: true, id, revision: updated.revision } as const;
    }),
  );
}

async function missing(tx: Executor, id: string): Promise<ArticleOutcome> {
  const [exists] = await tx.select({ id: articles.id }).from(articles).where(eq(articles.id, id));
  return { ok: false, reason: exists ? "conflict" : "not-found" };
}

async function insertWithFreeSlug(tx: Executor, articleId: string, text: ReturnType<typeof texts>, base: string): Promise<void> {
  for (let attempt = 1; attempt <= 50; attempt += 1) {
    const suffix = attempt === 1 ? "" : `-${attempt}`;
    const slug = `${base.slice(0, 80 - suffix.length).replace(/-+$/, "")}${suffix}`;
    try {
      await tx.transaction((savepoint) => savepoint.insert(articleLocalizations).values({ articleId, locale: "ru", slug, ...text }));
      return;
    } catch (error) {
      if (!isUniqueViolation(error, "article_localizations_locale_slug_unique")) throw error;
    }
  }
  throw new Error("не нашли свободный адрес статьи за 50 попыток");
}
