import "server-only";
import { eq, sql } from "drizzle-orm";

import type { CropRect, Size } from "@/lib/domain/photo";
import { type Executor, getDb } from "@/lib/server/db/client";
import { guarded } from "@/lib/server/db/errors";
import * as t from "@/lib/server/db/schema";

import type { RenderedFile } from "./process";

// Запись фото в Postgres (ADR-0028): одно фото на рецепт. Замена и смена кадра — новый uuid в одной транзакции;
// вкладка, открытая со старым фото, получает «conflict» (сверка ожидаемого id). Чтение — `photo-reads.ts`.
export type SaveOutcome = { ok: true; id: string } | { ok: false; reason: "not-found" | "conflict" };
type NewPhoto = { recipeId: string; expected: string | null; size: Size; crop: CropRect; files: RenderedFile[] };

export function storePhoto({ recipeId, expected, size, crop, files }: NewPhoto): Promise<SaveOutcome> {
  return guarded("фото", () =>
    getDb().transaction(async (tx) => {
      const current = await lockCurrent(tx, recipeId);
      if (current === undefined) return { ok: false, reason: "not-found" } as const;
      if (current !== expected) return { ok: false, reason: "conflict" } as const;
      if (current) await tx.delete(t.recipePhotos).where(eq(t.recipePhotos.id, current));
      const id = crypto.randomUUID();
      await tx.insert(t.recipePhotos).values({
        id,
        recipeId,
        sourceWidth: size.width,
        sourceHeight: size.height,
        cropLeft: crop.left,
        cropTop: crop.top,
        cropWidth: crop.width,
        cropHeight: crop.height,
      });
      // По одной строке: каждый вариант — до ~1 МБ, не собираем их в один большой запрос.
      for (const file of files) await tx.insert(t.recipePhotoFiles).values({ photoId: id, ...file });
      await tx.update(t.recipes).set({ updatedAt: sql`now()` }).where(eq(t.recipes.id, recipeId));
      return { ok: true, id } as const;
    }),
  );
}

export function deletePhoto(recipeId: string, expected: string): Promise<SaveOutcome> {
  return guarded("фото", () =>
    getDb().transaction(async (tx) => {
      const current = await lockCurrent(tx, recipeId);
      if (current === undefined) return { ok: false, reason: "not-found" } as const;
      if (current !== expected) return { ok: false, reason: "conflict" } as const;
      await tx.delete(t.recipePhotos).where(eq(t.recipePhotos.id, expected));
      await tx.update(t.recipes).set({ updatedAt: sql`now()` }).where(eq(t.recipes.id, recipeId));
      return { ok: true, id: expected } as const;
    }),
  );
}

/** id текущего фото под блокировкой рецепта: undefined — рецепта нет, null — фото нет. */
async function lockCurrent(tx: Executor, recipeId: string): Promise<string | null | undefined> {
  const [recipe] = await tx.select({ id: t.recipes.id }).from(t.recipes).where(eq(t.recipes.id, recipeId)).for("update");
  if (!recipe) return undefined;
  const [photo] = await tx.select({ id: t.recipePhotos.id }).from(t.recipePhotos).where(eq(t.recipePhotos.recipeId, recipeId));
  return photo?.id ?? null;
}
