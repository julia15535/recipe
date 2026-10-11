import "server-only";
import { z } from "zod";

import { ARTICLE_LIMITS } from "@/lib/domain/article-text/lines";
import { ARTICLE_SCHEMA_VERSION, type ArticleBody, type Mark } from "@/lib/domain/article-text/types";

// Документ статьи в `articles.body` и разметка в `article_imports.marks` (ADR-0034): читаем из БД через Zod — битый
// документ не роняет страницу, а показывается как «статьи нет» с записью в лог.
const line = z.number().int().nonnegative().max(ARTICLE_LIMITS.lines);
const text = (max: number) => z.string().min(1).max(max);
const id = z.string().regex(/^b\d{1,4}$/);
export const photoKey = z.string().regex(/^[A-HJ-NP-Z2-9]{4}$/);

/** `scale` — запас длины для перевода (английский бывает длиннее русского, ADR-0038); у русского — 1. */
function bodySchemaOf(scale: number): z.ZodType<ArticleBody> {
  const [heading, plain] = [Math.round(ARTICLE_LIMITS.heading * scale), Math.round(ARTICLE_LIMITS.text * scale)];
  const block = z.discriminatedUnion("type", [
    z.object({ id, type: z.literal("heading"), level: z.union([z.literal(2), z.literal(3)]), text: text(heading), from: line, to: line }),
    z.object({ id, type: z.literal("paragraph"), text: text(plain), from: line, to: line }),
    z.object({
      id,
      type: z.literal("list"),
      ordered: z.boolean(),
      start: z.number().int().min(2).max(999).optional(),
      items: z.array(z.object({ text: text(plain), from: line, to: line })).min(1).max(ARTICLE_LIMITS.blocks),
    }),
    z.object({ id, type: z.literal("photo"), key: photoKey, line }),
  ]);
  return z.object({ schemaVersion: z.literal(ARTICLE_SCHEMA_VERSION), blocks: z.array(block).max(ARTICLE_LIMITS.blocks) });
}

export const articleBodySchema = bodySchemaOf(1);
export const translatedBodySchema = bodySchemaOf(2);

export const marksSchema: z.ZodType<Mark[]> = z
  .array(z.object({ kind: z.enum(["h2", "h3", "p", "bullet", "number"]), from: line, to: line }))
  .max(ARTICLE_LIMITS.lines);
