import "server-only";
import { randomUUID } from "node:crypto";

import { and, count, eq, gt, lt, sql } from "drizzle-orm";

import type { Mark } from "@/lib/domain/article-text/types";
import { getDb } from "@/lib/server/db/client";
import { guarded } from "@/lib/server/db/errors";
import { articleImports } from "@/lib/server/db/schema";

import { marksSchema } from "./body-schema";

// Разборы статей ждут «Сохранить» на сервере (сутки), как `recipe_imports`: текст и разметка; блоки при сохранении
// собираются заново из них (`parseArticle`) — браузеру не доверяем. Записи за час идут в общий лимит разборов ИИ.
export function countArticleImportsLastHour(): Promise<number> {
  return guarded("разборы", async () => {
    const [row] = await getDb()
      .select({ n: count() })
      .from(articleImports)
      .where(gt(articleImports.createdAt, sql`now() - interval '1 hour'`));
    return row?.n ?? 0;
  });
}

export function storeArticleImport(sourceText: string, marks: Mark[]): Promise<string> {
  const id = randomUUID();
  return guarded("разборы", async () => {
    const db = getDb();
    await db.delete(articleImports).where(lt(articleImports.createdAt, sql`now() - interval '1 day'`));
    await db.insert(articleImports).values({ id, sourceText, marks });
    return id;
  });
}

export function loadArticleImport(id: string): Promise<{ sourceText: string; marks: Mark[] } | null> {
  return guarded("разборы", async () => {
    const [row] = await getDb()
      .select({ sourceText: articleImports.sourceText, marks: articleImports.marks })
      .from(articleImports)
      .where(and(eq(articleImports.id, id), gt(articleImports.createdAt, sql`now() - interval '1 day'`)));
    const marks = marksSchema.safeParse(row?.marks);
    return row && marks.success ? { sourceText: row.sourceText, marks: marks.data } : null;
  });
}

export function dropArticleImport(id: string): Promise<void> {
  return guarded("разборы", async () => {
    await getDb().delete(articleImports).where(eq(articleImports.id, id));
  });
}
