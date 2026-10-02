import "server-only";
import { randomUUID } from "node:crypto";

import { and, count, eq, gt, lt, sql } from "drizzle-orm";

import type { AiDraft } from "@/lib/domain/recipe-text/from-ai";
import { getDb } from "@/lib/server/db/client";
import { guarded } from "@/lib/server/db/errors";
import { recipeImports } from "@/lib/server/db/schema";

// Разборы ИИ, ждущие решения владельца (сутки). Сохранение берёт разбор отсюда по id — не из браузера.
export const IMPORTS_PER_HOUR = 30;

export function countImportsLastHour(): Promise<number> {
  return guarded("разборы", async () => {
    const [row] = await getDb()
      .select({ n: count() })
      .from(recipeImports)
      .where(gt(recipeImports.createdAt, sql`now() - interval '1 hour'`));
    return row?.n ?? 0;
  });
}

export function storeImport(originalText: string, result: AiDraft): Promise<string> {
  const id = randomUUID();
  return guarded("разборы", async () => {
    const db = getDb();
    await db.delete(recipeImports).where(lt(recipeImports.createdAt, sql`now() - interval '1 day'`));
    await db.insert(recipeImports).values({ id, originalText, result });
    return id;
  });
}

export function dropImport(id: string): Promise<void> {
  return guarded("разборы", async () => {
    await getDb().delete(recipeImports).where(eq(recipeImports.id, id));
  });
}

export function loadImport(id: string): Promise<{ originalText: string; result: AiDraft } | null> {
  return guarded("разборы", async () => {
    const [row] = await getDb()
      .select({ originalText: recipeImports.originalText, result: recipeImports.result })
      .from(recipeImports)
      .where(and(eq(recipeImports.id, id), gt(recipeImports.createdAt, sql`now() - interval '1 day'`)));
    return row ?? null;
  });
}
