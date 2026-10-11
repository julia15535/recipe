import "server-only";
import { z } from "zod";

import { ARTICLE_LIMITS } from "@/lib/domain/article-text/lines";
import type { ArticleSource, TranslatedArticle } from "@/lib/domain/article-text/translation";

import { articleBodySchema, photoKey, translatedBodySchema } from "./body-schema";

// Перевод статьи (ADR-0038): вход задания — снимок русской статьи, результат — английский снимок; оба читаем через Zod
// (испорченное — в лог и «перевода нет», страница не падает). У английского — запас длины (`translatedBodySchema`).
export const ARTICLE_TRANSLATION_SCHEMA_VERSION = 1;

export const articleSourceSchema: z.ZodType<ArticleSource> = z.object({
  title: z.string().min(1).max(ARTICLE_LIMITS.title),
  body: articleBodySchema,
  captions: z.record(photoKey, z.string().min(1).max(300)),
});

export const translatedArticleSchema: z.ZodType<TranslatedArticle> = z.object({
  title: z.string().min(1).max(ARTICLE_LIMITS.title * 2),
  body: translatedBodySchema,
  captions: z.record(photoKey, z.string().min(1).max(600)),
});

/** Хранимый снимок: версия + английская статья. */
export const storedTranslationSchema = z.object({ schemaVersion: z.literal(ARTICLE_TRANSLATION_SCHEMA_VERSION), article: translatedArticleSchema });
