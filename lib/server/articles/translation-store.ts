import "server-only";
import { and, eq, sql } from "drizzle-orm";

import { excerptOf } from "@/lib/domain/article-text/assemble";
import { plainText } from "@/lib/domain/article-text/inline";
import { ARTICLE_LIMITS } from "@/lib/domain/article-text/lines";
import type { ArticleSource, TranslatedArticle } from "@/lib/domain/article-text/translation";
import { slugify } from "@/lib/domain/recipe-text/slug";
import type { Executor } from "@/lib/server/db/client";
import { isUniqueViolation } from "@/lib/server/db/errors";
import * as t from "@/lib/server/db/schema";

import { bodyOf } from "./queries";
import { ARTICLE_TRANSLATION_SCHEMA_VERSION } from "./translation-schema";

// Снимок русской статьи для перевода и запись готового перевода (ADR-0038). Вызывается внутри транзакций
// `translation-jobs.ts`; здесь — только чтение и запись строк.

/** Русская статья на момент постановки перевода: название, блоки, подписи фото; null — статьи нет. */
export async function articleSource(tx: Executor, articleId: string): Promise<{ source: ArticleSource; contentRevision: number } | null> {
  const [head] = await tx
    .select({ body: t.articles.body, contentRevision: t.articles.contentRevision, title: t.articleLocalizations.title })
    .from(t.articles)
    .innerJoin(t.articleLocalizations, and(eq(t.articleLocalizations.articleId, t.articles.id), eq(t.articleLocalizations.locale, "ru")))
    .where(eq(t.articles.id, articleId));
  const body = head ? bodyOf(head.body, articleId) : null;
  if (!head || !body) return null;
  const photos = await tx.select({ key: t.articlePhotos.key, caption: t.articlePhotos.caption }).from(t.articlePhotos).where(eq(t.articlePhotos.articleId, articleId));
  const captions = Object.fromEntries(photos.flatMap((photo) => (photo.caption ? [[photo.key, photo.caption]] : [])));
  return { source: { title: head.title, body, captions }, contentRevision: head.contentRevision };
}

export type SavedArticleTranslation = { article: TranslatedArticle; sourceContentRevision: number; model: string; promptVersion: string };

/** Название — до 120 знаков по границе слова (так велит `article_localizations`). */
const titleOf = (title: string) => {
  const plain = plainText(title).replace(/\s+/gu, " ").trim();
  if (plain.length <= ARTICLE_LIMITS.title) return plain;
  const cut = plain.slice(0, ARTICLE_LIMITS.title);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), ARTICLE_LIMITS.title / 2)).trim();
};

/** Перевод: английская локализация и снимок вместе. Адрес при повторном переводе не меняется (ссылки живут). */
export async function writeArticleTranslation(tx: Executor, articleId: string, saved: SavedArticleTranslation): Promise<string> {
  const text = { title: titleOf(saved.article.title), excerpt: excerptOf(saved.article.body) };
  const where = and(eq(t.articleLocalizations.articleId, articleId), eq(t.articleLocalizations.locale, "en"));
  const [current] = await tx.select({ slug: t.articleLocalizations.slug }).from(t.articleLocalizations).where(where);
  let slug = current?.slug;
  if (slug) await tx.update(t.articleLocalizations).set(text).where(where);
  else slug = await insertWithFreeSlug(tx, articleId, slugify(text.title) ?? `article-${articleId.slice(0, 8)}`, text);
  const row = {
    body: { schemaVersion: ARTICLE_TRANSLATION_SCHEMA_VERSION, article: saved.article },
    schemaVersion: ARTICLE_TRANSLATION_SCHEMA_VERSION,
    sourceContentRevision: saved.sourceContentRevision,
    model: saved.model.slice(0, 100),
    promptVersion: saved.promptVersion,
  };
  await tx
    .insert(t.articleTranslations)
    .values({ articleId, locale: "en", ...row })
    .onConflictDoUpdate({ target: [t.articleTranslations.articleId, t.articleTranslations.locale], set: { ...row, translatedAt: sql`now()` } });
  return slug;
}

async function insertWithFreeSlug(tx: Executor, articleId: string, base: string, text: { title: string; excerpt: string | null }): Promise<string> {
  for (let attempt = 1; attempt <= 50; attempt += 1) {
    const suffix = attempt === 1 ? "" : `-${attempt}`;
    const slug = `${base.slice(0, 80 - suffix.length).replace(/-+$/, "")}${suffix}`;
    try {
      await tx.transaction((savepoint) => savepoint.insert(t.articleLocalizations).values({ articleId, locale: "en", slug, ...text }));
      return slug;
    } catch (error) {
      if (!isUniqueViolation(error, "article_localizations_locale_slug_unique")) throw error;
    }
  }
  throw new Error("не нашли свободный английский адрес статьи за 50 попыток");
}
