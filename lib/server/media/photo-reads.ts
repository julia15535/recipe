import "server-only";
import { and, eq, inArray } from "drizzle-orm";

import type { CropRect, PhotoFile, PhotoRef, Size } from "@/lib/domain/photo";
import { type Executor, getDb } from "@/lib/server/db/client";
import { guarded } from "@/lib/server/db/errors";
import * as t from "@/lib/server/db/schema";

// Чтение фото (ADR-0028): кадр для «Изменить кадр», файлы для отдачи (сначала сведения и статус рецепта, байты —
// отдельно и только когда их действительно отдают), фото для показа — без байтов.
export type EditablePhoto = { id: string; size: Size; crop: CropRect };

/** Кадр текущего фото — для окна «Изменить кадр» и для повторной обработки исходника. */
export function editablePhoto(recipeId: string): Promise<EditablePhoto | null> {
  return guarded("фото", async () => {
    const [row] = await getDb().select().from(t.recipePhotos).where(eq(t.recipePhotos.recipeId, recipeId));
    if (!row) return null;
    return {
      id: row.id,
      size: { width: row.sourceWidth, height: row.sourceHeight },
      crop: { left: row.cropLeft, top: row.cropTop, width: row.cropWidth, height: row.cropHeight },
    };
  });
}

type FileName = (typeof t.PHOTO_FILES)[number];
const fileOf = (photoId: string, name: FileName) => and(eq(t.recipePhotoFiles.photoId, photoId), eq(t.recipePhotoFiles.name, name));

/** Есть ли файл, его тип и опубликован ли рецепт (кому отдавать — решает маршрут) — без байтов. */
export function photoFileInfo(photoId: string, name: FileName): Promise<{ contentType: string; published: boolean } | null> {
  return guarded("фото", async () => {
    const [row] = await getDb()
      .select({ contentType: t.recipePhotoFiles.contentType, status: t.recipes.status })
      .from(t.recipePhotoFiles)
      .innerJoin(t.recipePhotos, eq(t.recipePhotos.id, t.recipePhotoFiles.photoId))
      .innerJoin(t.recipes, eq(t.recipes.id, t.recipePhotos.recipeId))
      .where(fileOf(photoId, name));
    return row ? { contentType: row.contentType, published: row.status === "published" } : null;
  });
}

/** Байты одного файла (вариант выбирается строго один). */
export function photoFileBytes(photoId: string, name: FileName): Promise<Buffer | null> {
  return guarded("фото", async () => {
    const [row] = await getDb().select({ bytes: t.recipePhotoFiles.bytes }).from(t.recipePhotoFiles).where(fileOf(photoId, name));
    return row?.bytes ?? null;
  });
}

/** Фото для показа (id и ширины WebP, без байтов) — по рецептам; рецепты без фото в карте отсутствуют. */
export async function photoRefs(db: Executor, recipeIds: string[]): Promise<Map<string, PhotoRef>> {
  if (recipeIds.length === 0) return new Map();
  const rows = await db
    .select({ recipeId: t.recipePhotos.recipeId, id: t.recipePhotos.id, name: t.recipePhotoFiles.name, width: t.recipePhotoFiles.width })
    .from(t.recipePhotos)
    .innerJoin(t.recipePhotoFiles, eq(t.recipePhotoFiles.photoId, t.recipePhotos.id))
    .where(and(inArray(t.recipePhotos.recipeId, recipeIds), inArray(t.recipePhotoFiles.name, ["w480", "w960", "w1600"])));
  const refs = new Map<string, PhotoRef>();
  for (const row of rows) {
    const ref = refs.get(row.recipeId) ?? { id: row.id, files: [] };
    ref.files.push({ key: Number(row.name.slice(1)) as PhotoFile["key"], width: row.width });
    refs.set(row.recipeId, ref);
  }
  return refs;
}
