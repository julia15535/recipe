import "server-only";
import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/server/db/client";
import { guarded } from "@/lib/server/db/errors";
import { recipes } from "@/lib/server/db/schema";

/**
 * Опубликовать / снять: `published_at` — дата первой публикации, не очищается; видимость задаёт
 * `status`. Любая смена — `revision + 1`: открытая вкладка правки увидит конфликт, а не перетрёт.
 */
export async function setRecipeStatus(id: string, status: "draft" | "published"): Promise<boolean> {
  const rows = await guarded("рецепты", () =>
    getDb()
      .update(recipes)
      .set({
        status,
        publishedAt: status === "published" ? sql`coalesce(${recipes.publishedAt}, now())` : sql`${recipes.publishedAt}`,
        revision: sql`${recipes.revision} + 1`,
        updatedAt: sql`now()`,
      })
      .where(eq(recipes.id, id))
      .returning({ id: recipes.id }),
  );
  return rows.length > 0;
}

/** Удалить можно только черновик (опубликованный — сначала снять); строки уходят каскадом. */
export async function deleteDraft(id: string): Promise<boolean> {
  const rows = await guarded("рецепты", () =>
    getDb()
      .delete(recipes)
      .where(and(eq(recipes.id, id), eq(recipes.status, "draft")))
      .returning({ id: recipes.id }),
  );
  return rows.length > 0;
}
