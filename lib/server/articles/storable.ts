import "server-only";

import { ARTICLE_LIMITS, byteLength } from "@/lib/domain/article-text/lines";
import type { ArticleBody, ArticleIssue } from "@/lib/domain/article-text/types";

import { articleBodySchema } from "./body-schema";

// Перед записью статью проверяет та же Zod-схема, что и при чтении (`bodyOf`): иначе можно записать документ, который
// потом не прочитается, и статья пропадёт с сайта и из кабинета (verify 06.10: фото к статье у предела строк и блоков).
export function storableIssue(sourceText: string, body: ArticleBody): ArticleIssue | null {
  if (byteLength(sourceText) > ARTICLE_LIMITS.bytes) return { group: "decide", text: "Текст длиннее 20 КБ — сократите статью." };
  if (!articleBodySchema.safeParse(body).success) return { group: "decide", text: "Статья получилась слишком большой — сократите текст или уберите фото." };
  return null;
}
