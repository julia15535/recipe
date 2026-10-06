import "server-only";
import { and, eq, sql } from "drizzle-orm";

import type { ArticleBody } from "@/lib/domain/article-text/types";
import type { CropRect, Size } from "@/lib/domain/photo";
import { type Executor, getDb } from "@/lib/server/db/client";
import { guarded } from "@/lib/server/db/errors";
import * as t from "@/lib/server/db/schema";
import type { RenderedFile } from "@/lib/server/media/process";

import type { ArticleOutcome } from "./save";

// Фото статьи (ADR-0034): у фото постоянный код метки, uuid строки — новый при каждой смене кадра (адрес файла новый).
// Новое фото и «Убрать фото» меняют текст статьи (метка) — вместе со строкой фото, одной транзакцией по `revision`.
type Rendered = { size: Size; crop: CropRect; files: RenderedFile[] };
type Text = { sourceText: string; body: ArticleBody };

const row = (articleId: string, key: string, { size, crop }: Rendered) => ({
  id: crypto.randomUUID(),
  articleId,
  key,
  sourceWidth: size.width,
  sourceHeight: size.height,
  cropLeft: crop.left,
  cropTop: crop.top,
  cropWidth: crop.width,
  cropHeight: crop.height,
});

async function insertFiles(tx: Executor, photoId: string, files: RenderedFile[]) {
  // По одной строке: каждый вариант — до ~1 МБ, не собираем их в один большой запрос.
  for (const file of files) await tx.insert(t.articlePhotoFiles).values({ photoId, ...file });
}

/** Текст статьи с новой меткой (готовит действие) + фото — вместе; `revision` устарел — конфликт. */
export function addArticlePhoto(articleId: string, revision: number, key: string, rendered: Rendered, text: Text): Promise<ArticleOutcome> {
  return guarded("фото", () =>
    getDb().transaction(async (tx) => {
      const updated = await bumpText(tx, articleId, revision, text);
      if (!updated.ok) return updated;
      const photo = row(articleId, key, rendered);
      await tx.insert(t.articlePhotos).values(photo);
      await insertFiles(tx, photo.id, rendered.files);
      return updated;
    }),
  );
}

/** Новый кадр того же фото: новый uuid, код и подпись прежние; `expected` — uuid, с которым открыто окно. */
export function recropArticlePhoto(articleId: string, key: string, expected: string, rendered: Rendered): Promise<{ ok: true; id: string } | { ok: false; reason: "conflict" | "not-found" }> {
  return guarded("фото", () =>
    getDb().transaction(async (tx) => {
      const [current] = await tx
        .select({ id: t.articlePhotos.id, caption: t.articlePhotos.caption })
        .from(t.articlePhotos)
        .where(and(eq(t.articlePhotos.articleId, articleId), eq(t.articlePhotos.key, key)))
        .for("update");
      if (!current) return { ok: false, reason: "not-found" } as const;
      if (current.id !== expected) return { ok: false, reason: "conflict" } as const;
      await tx.delete(t.articlePhotos).where(eq(t.articlePhotos.id, current.id));
      const photo = { ...row(articleId, key, rendered), caption: current.caption };
      await tx.insert(t.articlePhotos).values(photo);
      await insertFiles(tx, photo.id, rendered.files);
      await tx.update(t.articles).set({ revision: sql`${t.articles.revision} + 1`, updatedAt: sql`now()` }).where(eq(t.articles.id, articleId));
      return { ok: true, id: photo.id } as const;
    }),
  );
}

/** Убрать фото: метка из текста (готовит действие) и строка фото с файлами — вместе. */
export function removeArticlePhoto(articleId: string, revision: number, key: string, text: Text): Promise<ArticleOutcome> {
  return guarded("фото", () =>
    getDb().transaction(async (tx) => {
      const updated = await bumpText(tx, articleId, revision, text);
      if (updated.ok) await tx.delete(t.articlePhotos).where(and(eq(t.articlePhotos.articleId, articleId), eq(t.articlePhotos.key, key)));
      return updated;
    }),
  );
}

/** Подпись фото (для глаз и для экранного диктора); переводимый текст — `content_revision` растёт. */
export function setPhotoCaption(articleId: string, key: string, caption: string | null): Promise<boolean> {
  return guarded("фото", () =>
    getDb().transaction(async (tx) => {
      const rows = await tx
        .update(t.articlePhotos)
        .set({ caption })
        .where(and(eq(t.articlePhotos.articleId, articleId), eq(t.articlePhotos.key, key)))
        .returning({ id: t.articlePhotos.id });
      if (!rows.length) return false;
      await tx
        .update(t.articles)
        .set({ revision: sql`${t.articles.revision} + 1`, contentRevision: sql`${t.articles.contentRevision} + 1`, updatedAt: sql`now()` })
        .where(eq(t.articles.id, articleId));
      return true;
    }),
  );
}

async function bumpText(tx: Executor, articleId: string, revision: number, text: Text): Promise<ArticleOutcome> {
  const [updated] = await tx
    .update(t.articles)
    .set({
      sourceText: text.sourceText,
      body: text.body,
      revision: sql`${t.articles.revision} + 1`,
      contentRevision: sql`${t.articles.contentRevision} + 1`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(t.articles.id, articleId), eq(t.articles.revision, revision)))
    .returning({ revision: t.articles.revision });
  if (updated) return { ok: true, id: articleId, revision: updated.revision };
  const [exists] = await tx.select({ id: t.articles.id }).from(t.articles).where(eq(t.articles.id, articleId));
  return { ok: false, reason: exists ? "conflict" : "not-found" };
}
