import "server-only";
import { and, eq, sql } from "drizzle-orm";

import type { TagCode } from "@/lib/domain/catalog";
import { getDb } from "@/lib/server/db/client";
import { guarded } from "@/lib/server/db/errors";
import { recipeCompositionTags, recipes } from "@/lib/server/db/schema";

import { getCatalog } from "./catalog";

// «Сохранить теги» в кабинете (план recipe-tags-button, ADR-0036): теги рецепта и текст с новой строкой каталога
// (`retagText` готовит действие) — одной транзакцией по `revision`. `content_revision` не растёт: теги — коды, переводить
// нечего (английский сайт берёт их живыми, `public-en.ts`); `original_text` не трогаем.
export type TagsOutcome = { ok: true; revision: number } | { ok: false; reason: "conflict" | "not-found" };

export function setRecipeTags(id: string, expectedRevision: number, tags: readonly TagCode[], sourceText: string): Promise<TagsOutcome> {
  return guarded("рецепты", () =>
    getDb().transaction(async (tx) => {
      const catalog = await getCatalog(tx);
      const tagIds = tags.map((code) => {
        const found = catalog.tags.find((item) => item.code === code);
        if (!found) throw new Error(`нет тега ${code} в каталоге`);
        return found.id;
      });
      const [updated] = await tx
        .update(recipes)
        .set({ sourceText, revision: sql`${recipes.revision} + 1`, updatedAt: sql`now()` })
        .where(and(eq(recipes.id, id), eq(recipes.revision, expectedRevision)))
        .returning({ revision: recipes.revision });
      if (!updated) {
        const [exists] = await tx.select({ id: recipes.id }).from(recipes).where(eq(recipes.id, id));
        return { ok: false, reason: exists ? "conflict" : "not-found" } as const;
      }
      await tx.delete(recipeCompositionTags).where(eq(recipeCompositionTags.recipeId, id));
      if (tagIds.length) await tx.insert(recipeCompositionTags).values(tagIds.map((tagId, position) => ({ recipeId: id, tagId, position })));
      return { ok: true, revision: updated.revision } as const;
    }),
  );
}
