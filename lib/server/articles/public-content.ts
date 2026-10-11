import "server-only";

import type { TranslatedArticle } from "@/lib/domain/article-text/translation";
import type { ArticleBody } from "@/lib/domain/article-text/types";
import type { Locale } from "@/lib/server/recipes/public-paths";
import { log } from "@/lib/server/log";

import type { ArticlePhoto } from "./photo-reads";
import { bodyOf } from "./queries";
import { storedTranslationSchema } from "./translation-schema";

// Содержимое статьи на языке страницы (ADR-0038): русское — из статьи, английское — из снимка перевода.

/** Английский снимок через Zod: испорченный — в лог и null. */
function englishOf(raw: unknown, id: string): TranslatedArticle | null {
  const parsed = storedTranslationSchema.safeParse(raw);
  if (!parsed.success) log.error("перевод статьи: снимок не прошёл проверку", { article: id.slice(0, 8) });
  return parsed.success ? parsed.data.article : null;
}

/** Блоки и подписи статьи на языке страницы: русские — из статьи, английские — из снимка перевода. */
export type ContentRow = { id: string; body: unknown; english: unknown };
export function contentOf(locale: Locale, row: ContentRow): { body: ArticleBody; captions: Record<string, string> | null } | null {
  if (locale === "ru") {
    const body = bodyOf(row.body, row.id);
    return body ? { body, captions: null } : null;
  }
  const english = englishOf(row.english, row.id);
  return english ? { body: english.body, captions: english.captions } : null;
}

/** Фото с подписями на языке страницы (у английской — из снимка; подписи нет — без подписи). */
export function withCaptions(photos: ReadonlyMap<string, ArticlePhoto> | undefined, captions: Record<string, string> | null): Map<string, ArticlePhoto> {
  return new Map([...(photos ?? new Map<string, ArticlePhoto>())].map(([key, photo]) => [key, captions ? { ...photo, caption: captions[key] ?? null } : photo]));
}

