"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { insertMarker, lastLineOf, remap, removeMarker } from "@/lib/domain/article-text/edit";
import { ARTICLE_LIMITS, newPhotoKey } from "@/lib/domain/article-text/lines";
import { canonicalCrop, type CropFractions } from "@/lib/domain/photo";
import { articlePhotoFileBytes } from "@/lib/server/articles/photo-reads";
import { addArticlePhoto, recropArticlePhoto, removeArticlePhoto, setPhotoCaption } from "@/lib/server/articles/photos";
import { getArticle } from "@/lib/server/articles/queries";
import { storableIssue } from "@/lib/server/articles/storable";
import type { ArticleOutcome } from "@/lib/server/articles/save";
import { requireOwner } from "@/lib/server/auth/owner";
import { StorageError } from "@/lib/server/db/errors";
import { log } from "@/lib/server/log";
import { exclusive, fail, type PhotoResult } from "@/lib/server/media/guard";
import { normalize, renderCrop } from "@/lib/server/media/process";
import { refreshPublicSite } from "@/lib/server/recipes/public-cache";

// Фото статьи в кабинете (ADR-0034). Каждое действие — requireOwner(); файлу и рамке из браузера не верим
// (process.ts, canonicalCrop). Метку в текст ставит сервер — по текущему тексту статьи и её `revision`.
const id = z.uuid();
const key = z.string().regex(/^[A-HJ-NP-Z2-9]{4}$/);
const crop = z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() });
const addForm = z.object({ articleId: id, revision: z.coerce.number().int().positive(), after: z.string().regex(/^(top|b\d{1,4})$/), crop: z.string().max(300) });

function finish(outcome: ArticleOutcome | { ok: true } | { ok: false; reason: "conflict" | "not-found" }): PhotoResult {
  if (!outcome.ok) return fail(outcome.reason === "conflict" ? "conflict" : "gone");
  refreshPublicSite();
  refresh();
  return { ok: true };
}

function parseCrop(raw: string): CropFractions | null {
  try {
    const parsed = crop.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** «Добавить фото сюда»: фото и метка после блока `after` (или в начало) — вместе. */
export async function addPhotoHere(form: FormData): Promise<PhotoResult> {
  await requireOwner();
  const fields = addForm.safeParse({ articleId: form.get("articleId"), revision: form.get("revision"), after: form.get("after"), crop: form.get("crop") });
  const file = form.get("photo");
  const rect = fields.success ? parseCrop(fields.data.crop) : null;
  if (!fields.success || !rect || !(file instanceof Blob)) return fail("broken");
  const { articleId, revision, after } = fields.data;
  return exclusive(async () => {
    const article = await getArticle(articleId);
    if (!article) return fail("gone");
    if (article.revision !== revision) return fail("conflict");
    if (article.photos.size >= ARTICLE_LIMITS.photos) return fail("too-many");
    const line = after === "top" ? -1 : lastLineOf(article.body, after);
    if (line === null) return fail("conflict");
    const source = await normalize(Buffer.from(await file.arrayBuffer()));
    const cropped = canonicalCrop(rect, source.size);
    if (!cropped.ok) return fail(cropped.reason === "small" ? "small" : "broken");
    const files = [source.file, ...(await renderCrop(source.file.bytes, cropped.rect))];
    const photoKey = newPhotoKey(new Set(article.photos.keys()));
    const sourceText = insertMarker(article.sourceText, line, photoKey);
    const moved = remap(article.sourceText, article.body, sourceText);
    if (!moved.ok) return fail("conflict");
    // Метка добавляет строки и блок — у предела статья могла бы стать нечитаемой; проверяем той же схемой, что при чтении.
    const size = storableIssue(sourceText, moved.body) ?? moved.issues.find((issue) => issue.group === "decide");
    if (size) return { ok: false, message: size.text };
    return finish(await addArticlePhoto(articleId, revision, photoKey, { size: source.size, crop: cropped.rect, files }, { sourceText, body: moved.body }));
  });
}

/** «Изменить кадр»: те же байты исходника, новая рамка → новый uuid (новый адрес файла), код метки прежний. */
export async function recropArticle(articleId: string, photoKey: string, expected: string, fractions: CropFractions): Promise<PhotoResult> {
  await requireOwner();
  const ids = z.object({ articleId: id, photoKey: key, expected: id }).safeParse({ articleId, photoKey, expected });
  const rect = crop.safeParse(fractions);
  if (!ids.success || !rect.success) return fail("broken");
  return exclusive(async () => {
    const current = (await getArticle(ids.data.articleId))?.photos.get(ids.data.photoKey);
    const source = current?.id === ids.data.expected ? await articlePhotoFileBytes(current.id, "source") : null;
    if (!current || !source) return fail("conflict");
    const cropped = canonicalCrop(rect.data, current.size);
    if (!cropped.ok) return fail(cropped.reason === "small" ? "small" : "broken");
    const original = { name: "source", ...current.size, contentType: "image/jpeg", bytes: source } as const;
    const files = [original, ...(await renderCrop(source, cropped.rect))];
    return finish(await recropArticlePhoto(ids.data.articleId, ids.data.photoKey, current.id, { size: current.size, crop: cropped.rect, files }));
  });
}

/** «Убрать фото»: метка из текста и фото — вместе (у фото «без места» метки нет — просто удаляется). */
export async function removeArticlePhotoAction(articleId: string, revision: number, photoKey: string): Promise<PhotoResult> {
  await requireOwner();
  const ids = z.object({ articleId: id, revision: z.number().int().positive(), photoKey: key }).safeParse({ articleId, revision, photoKey });
  if (!ids.success) return fail("broken");
  return storage(async () => {
    const article = await getArticle(ids.data.articleId);
    if (!article) return fail("gone");
    const sourceText = removeMarker(article.sourceText, ids.data.photoKey);
    const moved = remap(article.sourceText, article.body, sourceText);
    if (!moved.ok) return fail("conflict");
    const size = storableIssue(sourceText, moved.body);
    if (size) return { ok: false, message: size.text };
    const changed = sourceText !== article.sourceText;
    return finish(await removeArticlePhoto(ids.data.articleId, ids.data.revision, ids.data.photoKey, { sourceText, body: moved.body }, changed));
  });
}

/** Подпись под фото (пусто — без подписи). */
export async function captionArticlePhoto(articleId: string, photoKey: string, caption: string): Promise<PhotoResult> {
  await requireOwner();
  const fields = z.object({ articleId: id, photoKey: key, caption: z.string().max(300) }).safeParse({ articleId, photoKey, caption });
  if (!fields.success) return { ok: false, message: "Подпись длиннее 300 знаков — сократите." };
  const text = fields.data.caption.replace(/\s+/gu, " ").trim();
  return storage(async () => ((await setPhotoCaption(fields.data.articleId, fields.data.photoKey, text || null)) ? finish({ ok: true }) : fail("gone")));
}

async function storage(work: () => Promise<PhotoResult>): Promise<PhotoResult> {
  try {
    return await work();
  } catch (error) {
    if (!(error instanceof StorageError)) throw error;
    log.error("фото статьи не сохранено", { pg: error.code });
    return fail("storage");
  }
}
