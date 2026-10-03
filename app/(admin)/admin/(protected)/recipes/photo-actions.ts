"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { canonicalCrop, type CropFractions } from "@/lib/domain/photo";
import { requireOwner } from "@/lib/server/auth/owner";
import { StorageError } from "@/lib/server/db/errors";
import { log } from "@/lib/server/log";
import { exclusive, fail, type PhotoResult } from "@/lib/server/media/guard";
import { editablePhoto, photoFileBytes } from "@/lib/server/media/photo-reads";
import { deletePhoto, type SaveOutcome, storePhoto } from "@/lib/server/media/photos";
import { normalize, renderCrop } from "@/lib/server/media/process";
import { refreshPublicSite } from "@/lib/server/recipes/public-cache";

// Фото блюда в кабинете (план recipe-photos, ADR-0028). Каждое действие — requireOwner(); рамке и файлу из браузера
// не верим (process.ts, canonicalCrop). Обработка — одна на весь сервер (0,25 CPU): вторая сразу получает «подождите».
const id = z.uuid();
const crop = z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() });
const uploadForm = z.object({ recipeId: id, expected: z.union([id, z.literal("")]), crop: z.string().max(300) });

function finish(outcome: SaveOutcome): PhotoResult {
  if (!outcome.ok) return fail(outcome.reason);
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

/** Новое фото или замена: браузер прислал уменьшенный JPEG целиком и рамку 4:3 долями. */
export async function uploadPhoto(form: FormData): Promise<PhotoResult> {
  await requireOwner();
  const fields = uploadForm.safeParse({ recipeId: form.get("recipeId"), expected: form.get("expected"), crop: form.get("crop") });
  const file = form.get("photo");
  const rect = fields.success ? parseCrop(fields.data.crop) : null;
  if (!fields.success || !rect || !(file instanceof Blob)) return fail("broken");
  const { recipeId, expected } = fields.data;
  return exclusive(async () => {
    const source = await normalize(Buffer.from(await file.arrayBuffer()));
    const cropped = canonicalCrop(rect, source.size);
    if (!cropped.ok) return fail(cropped.reason === "small" ? "small" : "broken");
    const files = await renderCrop(source.file.bytes, cropped.rect);
    return finish(await storePhoto({ recipeId, expected: expected || null, size: source.size, crop: cropped.rect, files: [source.file, ...files] }));
  });
}

/** «Изменить кадр»: те же байты исходника, новая рамка → новые варианты и новый адрес фото. */
export async function recropPhoto(recipeId: string, expected: string, fractions: CropFractions): Promise<PhotoResult> {
  await requireOwner();
  const ids = z.object({ recipeId: id, expected: id }).safeParse({ recipeId, expected });
  const rect = crop.safeParse(fractions);
  if (!ids.success || !rect.success) return fail("broken");
  return exclusive(async () => {
    const current = await editablePhoto(ids.data.recipeId);
    const source = current?.id === ids.data.expected ? await photoFileBytes(current.id, "source") : null;
    if (!current || !source) return fail("conflict");
    const cropped = canonicalCrop(rect.data, current.size);
    if (!cropped.ok) return fail(cropped.reason === "small" ? "small" : "broken");
    const files = await renderCrop(source, cropped.rect);
    const original = { name: "source", ...current.size, contentType: "image/jpeg", bytes: source } as const;
    return finish(await storePhoto({ recipeId: ids.data.recipeId, expected: current.id, size: current.size, crop: cropped.rect, files: [original, ...files] }));
  });
}

export async function removePhoto(recipeId: string, expected: string): Promise<PhotoResult> {
  await requireOwner();
  const ids = z.object({ recipeId: id, expected: id }).safeParse({ recipeId, expected });
  if (!ids.success) return fail("broken");
  try {
    return finish(await deletePhoto(ids.data.recipeId, ids.data.expected));
  } catch (error) {
    if (!(error instanceof StorageError)) throw error;
    log.error("фото не убрано", { pg: error.code });
    return fail("storage");
  }
}
