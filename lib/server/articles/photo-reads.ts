import "server-only";
import { and, eq, inArray } from "drizzle-orm";

import type { CropRect, PhotoFile, PhotoRef, Size } from "@/lib/domain/photo";
import { type Executor, getDb } from "@/lib/server/db/client";
import { guarded } from "@/lib/server/db/errors";
import * as t from "@/lib/server/db/schema";

// Чтение фото статей (ADR-0034): для показа — без байтов; для отдачи файла — сначала сведения и статус статьи,
// байты — отдельно и только когда их отдают (как у фото рецепта, ADR-0028).
export type ArticlePhoto = { key: string; id: string; caption: string | null; size: Size; crop: CropRect; ref: PhotoRef };

/** Фото статей: статья → код метки → фото. */
export async function articlePhotos(db: Executor, articleIds: string[]): Promise<Map<string, Map<string, ArticlePhoto>>> {
  const result = new Map<string, Map<string, ArticlePhoto>>();
  if (articleIds.length === 0) return result;
  const rows = await db
    .select({ photo: t.articlePhotos, name: t.articlePhotoFiles.name, width: t.articlePhotoFiles.width })
    .from(t.articlePhotos)
    .innerJoin(t.articlePhotoFiles, eq(t.articlePhotoFiles.photoId, t.articlePhotos.id))
    .where(and(inArray(t.articlePhotos.articleId, articleIds), inArray(t.articlePhotoFiles.name, ["w480", "w960", "w1600"])));
  for (const { photo, name, width } of rows) {
    const byKey = result.get(photo.articleId) ?? new Map<string, ArticlePhoto>();
    const current = byKey.get(photo.key) ?? {
      key: photo.key,
      id: photo.id,
      caption: photo.caption,
      size: { width: photo.sourceWidth, height: photo.sourceHeight },
      crop: { left: photo.cropLeft, top: photo.cropTop, width: photo.cropWidth, height: photo.cropHeight },
      ref: { id: photo.id, files: [], kind: "article" as const },
    };
    current.ref.files.push({ key: Number(name.slice(1)) as PhotoFile["key"], width });
    byKey.set(photo.key, current);
    result.set(photo.articleId, byKey);
  }
  return result;
}

type FileName = (typeof t.PHOTO_FILES)[number];
const fileOf = (photoId: string, name: FileName) => and(eq(t.articlePhotoFiles.photoId, photoId), eq(t.articlePhotoFiles.name, name));

/** Есть ли файл, его тип и опубликована ли статья — без байтов. */
export function articlePhotoFileInfo(photoId: string, name: FileName): Promise<{ contentType: string; published: boolean } | null> {
  return guarded("фото", async () => {
    const [row] = await getDb()
      .select({ contentType: t.articlePhotoFiles.contentType, status: t.articles.status })
      .from(t.articlePhotoFiles)
      .innerJoin(t.articlePhotos, eq(t.articlePhotos.id, t.articlePhotoFiles.photoId))
      .innerJoin(t.articles, eq(t.articles.id, t.articlePhotos.articleId))
      .where(fileOf(photoId, name));
    return row ? { contentType: row.contentType, published: row.status === "published" } : null;
  });
}

export function articlePhotoFileBytes(photoId: string, name: FileName): Promise<Buffer | null> {
  return guarded("фото", async () => {
    const [row] = await getDb().select({ bytes: t.articlePhotoFiles.bytes }).from(t.articlePhotoFiles).where(fileOf(photoId, name));
    return row?.bytes ?? null;
  });
}
