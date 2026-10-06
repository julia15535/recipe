// Фото блюда (план recipe-photos, ADR-0028): одна рамка 4:3 для карточки и верха рецепта (владелец 03.10). Браузер
// присылает уменьшенное фото целиком и рамку долями 0..1; сервер ей не доверяет — `canonicalCrop` переводит её в свой
// целочисленный прямоугольник 4:3 внутри фото и не меньше `MIN_CROP_WIDTH` (иначе 1600 и превью ссылки размоются).
export const ASPECT = 4 / 3;
export const MIN_CROP_WIDTH = 800;
/** Уменьшенный исходник: не длиннее этой стороны (браузер уменьшает до неё, сервер — страховка). */
export const SOURCE_MAX_SIDE = 2000;
export const WIDTHS = [480, 960, 1600] as const;
export const OG = { width: 1200, height: 630 } as const;

export type Size = { width: number; height: number };
export type CropRect = { left: number; top: number; width: number; height: number };
/** Рамка из окна кадрирования: доли ширины и высоты фото. */
export type CropFractions = { x: number; y: number; width: number; height: number };
export type PhotoFile = { key: (typeof WIDTHS)[number]; width: number };
/** Фото для показа: uuid (новый при каждой загрузке и смене кадра) и готовые ширины WebP; `kind` — чьё фото
 * (рецепта или статьи, ADR-0034) — от него адрес файла. */
export type PhotoRef = { id: string; files: PhotoFile[]; kind?: "recipe" | "article" };

const TOLERANCE = 0.03;

/** Наибольшая рамка 4:3, которая помещается в фото: от неё считается предельное увеличение. */
export function fullCrop(source: Size): CropRect {
  const width = Math.min(source.width, Math.floor((source.height * 4) / 3));
  const height = Math.round((width * 3) / 4);
  return { left: Math.floor((source.width - width) / 2), top: Math.floor((source.height - height) / 2), width, height };
}

/** Можно ли вообще кадрировать: даже рамка во всё фото должна быть не уже `MIN_CROP_WIDTH`. */
export function isLargeEnough(source: Size): boolean {
  return fullCrop(source).width >= MIN_CROP_WIDTH;
}

/** Предельное увеличение в окне кадрирования: рамка не уже `MIN_CROP_WIDTH` пикселей фото. */
export function maxZoom(source: Size): number {
  return Math.max(1, Math.min(4, fullCrop(source).width / MIN_CROP_WIDTH));
}

export type CropResult = { ok: true; rect: CropRect } | { ok: false; reason: "invalid" | "aspect" | "small" };

export function canonicalCrop(fractions: CropFractions, source: Size): CropResult {
  const values = [fractions.x, fractions.y, fractions.width, fractions.height];
  if (!values.every(Number.isFinite) || fractions.width <= 0 || fractions.height <= 0) return { ok: false, reason: "invalid" };
  if (fractions.x < -TOLERANCE || fractions.y < -TOLERANCE) return { ok: false, reason: "invalid" };
  if (fractions.x + fractions.width > 1 + TOLERANCE || fractions.y + fractions.height > 1 + TOLERANCE) return { ok: false, reason: "invalid" };
  const [pxWidth, pxHeight] = [fractions.width * source.width, fractions.height * source.height];
  if (Math.abs(pxWidth / pxHeight / ASPECT - 1) > TOLERANCE) return { ok: false, reason: "aspect" };
  const limit = fullCrop(source);
  const width = Math.min(limit.width, Math.round(pxWidth));
  const height = Math.round((width * 3) / 4);
  if (width < MIN_CROP_WIDTH) return { ok: false, reason: "small" };
  const clamp = (value: number, max: number) => Math.min(Math.max(0, Math.round(value)), max);
  return {
    ok: true,
    rect: { left: clamp(fractions.x * source.width, source.width - width), top: clamp(fractions.y * source.height, source.height - height), width, height },
  };
}

/** Обратно в доли — для «Изменить кадр»: окно открывается с прежней рамкой. */
export function toFractions(rect: CropRect, source: Size): CropFractions {
  return { x: rect.left / source.width, y: rect.top / source.height, width: rect.width / source.width, height: rect.height / source.height };
}

/** Ширины WebP для кадра: без увеличения; если кадр уже 1600 — самый крупный вариант равен ширине кадра. */
export function plannedFiles(cropWidth: number): PhotoFile[] {
  const files: PhotoFile[] = [];
  for (const key of WIDTHS) {
    const width = Math.min(key, cropWidth);
    if (files.some((file) => file.width === width)) continue;
    files.push({ key, width });
  }
  return files;
}

export const photoUrl = (id: string, file: string, kind: PhotoRef["kind"] = "recipe") => `/media/${kind}/${id}/${file}`;

/** `srcset` по реальным ширинам и запасной `src` (средний вариант). */
export function photoSources(photo: PhotoRef): { src: string; srcSet: string; width: number; height: number } {
  const files = [...photo.files].sort((a, b) => a.width - b.width);
  const middle = files[Math.min(1, files.length - 1)] ?? { key: 480, width: 480 };
  const largest = files.at(-1) ?? middle;
  return {
    src: photoUrl(photo.id, `${middle.key}.webp`, photo.kind),
    srcSet: files.map((file) => `${photoUrl(photo.id, `${file.key}.webp`, photo.kind)} ${file.width}w`).join(", "),
    width: largest.width,
    height: Math.round((largest.width * 3) / 4),
  };
}
