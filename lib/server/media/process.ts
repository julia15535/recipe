import "server-only";
import sharp, { type Metadata } from "sharp";

import { type CropRect, OG, plannedFiles, type Size, SOURCE_MAX_SIDE } from "@/lib/domain/photo";

// Обработка фото (ADR-0028). Контейнер сайта — 0,25 CPU и 384 МБ: libvips без кэша и в один поток, вход не больше
// ~4 Мп (браузер присылает ≤ 2000 px), варианты — строго по очереди. Метаданные (EXIF, GPS, ICC) sharp не переносит,
// цвет — sRGB; поворот по EXIF делает браузер, `autoOrient` — страховка.
sharp.cache(false);
sharp.concurrency(1);

const LIMIT_PIXELS = 4_200_000;
const FORMATS = new Set(["jpeg", "png", "webp"]);
export const MAX_UPLOAD_BYTES = 900 * 1024;
export const MAX_FILE_BYTES = 1024 * 1024;

export type RenderedFile = { name: "source" | "w480" | "w960" | "w1600" | "og"; width: number; height: number; contentType: "image/jpeg" | "image/webp"; bytes: Buffer };
export type Normalized = { size: Size; file: RenderedFile };
export class PhotoError extends Error {
  constructor(readonly reason: "format" | "broken" | "large" | "small") {
    super(reason);
  }
}

const open = (input: Buffer) => sharp(input, { limitInputPixels: LIMIT_PIXELS, failOn: "error" });

/** Сигнатура JPEG / PNG / WebP — до libvips: SVG и прочее не разбираются вообще. */
function looksLikePhoto(input: Buffer): boolean {
  const ascii = (start: number, end: number) => input.subarray(start, end).toString("latin1");
  return (
    (input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff) ||
    (input[0] === 0x89 && ascii(1, 4) === "PNG") ||
    (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP")
  );
}

/** Присланное браузером → проверенный исходник JPEG ≤ 2000 px без метаданных (его и храним для «Изменить кадр»). */
export async function normalize(input: Buffer): Promise<Normalized> {
  if (input.length > MAX_UPLOAD_BYTES) throw new PhotoError("large");
  if (!looksLikePhoto(input)) throw new PhotoError("format");
  let meta: Metadata;
  try {
    meta = await sharp(input, { failOn: "error" }).metadata(); // только заголовок: предел пикселей проверяем сами ниже
  } catch {
    throw new PhotoError("broken");
  }
  // Формат — по содержимому, не по имени и типу файла: SVG, GIF, HEIC, TIFF и прочее не принимаем.
  if (!meta.format || !FORMATS.has(meta.format)) throw new PhotoError("format");
  if ((meta.width ?? 0) * (meta.height ?? 0) > LIMIT_PIXELS) throw new PhotoError("large");
  try {
    const { data, info } = await open(input)
      .autoOrient()
      .resize({ width: SOURCE_MAX_SIDE, height: SOURCE_MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .toColourspace("srgb")
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    if (data.length > MAX_FILE_BYTES) throw new PhotoError("large");
    return { size: { width: info.width, height: info.height }, file: { name: "source", width: info.width, height: info.height, contentType: "image/jpeg", bytes: data } };
  } catch (error) {
    if (error instanceof PhotoError) throw error;
    throw new PhotoError("broken");
  }
}

/** Кадр 4:3 → WebP по ширине (480 / 960 / 1600, без увеличения) и превью ссылки 1200×630 из середины кадра. */
export async function renderCrop(source: Buffer, crop: CropRect): Promise<RenderedFile[]> {
  try {
    return await render(source, crop);
  } catch (error) {
    if (error instanceof PhotoError) throw error;
    throw new PhotoError("broken");
  }
}

async function render(source: Buffer, crop: CropRect): Promise<RenderedFile[]> {
  const files: RenderedFile[] = [];
  for (const planned of plannedFiles(crop.width)) {
    const { data, info } = await open(source)
      .extract(crop)
      .resize({ width: planned.width, withoutEnlargement: true })
      .webp({ quality: 78, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    files.push({ name: `w${planned.key}`, width: info.width, height: info.height, contentType: "image/webp", bytes: data });
  }
  const og = await open(source)
    .extract(crop)
    .resize({ width: OG.width, height: OG.height, fit: "cover", position: "centre" })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  files.push({ name: "og", width: og.info.width, height: og.info.height, contentType: "image/jpeg", bytes: og.data });
  if (files.some((file) => file.bytes.length > MAX_FILE_BYTES)) throw new PhotoError("large");
  return files;
}
