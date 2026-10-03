import { isLargeEnough, SOURCE_MAX_SIDE } from "@/lib/domain/photo";

// Уменьшение фото в браузере (ADR-0028): общий прокси на проде пропускает запрос не больше 1 МБ, а снимок с
// телефона — 3–10 МБ. Поворот по EXIF делает createImageBitmap (без ручного поворота), canvas — sRGB на светлом
// фоне (прозрачность), JPEG: сначала ниже качество, потом меньше размер; каждая попытка — из canvas заново.
const TARGET_BYTES = 850 * 1024;
const MAX_INPUT_BYTES = 40 * 1024 * 1024;
const QUALITIES = [0.88, 0.8, 0.72];

export type Shrunk = { blob: Blob; url: string; width: number; height: number };
export class ShrinkError extends Error {
  constructor(readonly reason: "open" | "small" | "large") {
    super(reason);
  }
}

const toBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));

export async function shrinkImage(file: Blob): Promise<Shrunk> {
  if (file.size > MAX_INPUT_BYTES) throw new ShrinkError("large");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ShrinkError("open");
  }
  const canvas = document.createElement("canvas");
  try {
    let scale = Math.min(1, SOURCE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (!isLargeEnough({ width: Math.round(bitmap.width * scale), height: Math.round(bitmap.height * scale) })) throw new ShrinkError("small");
    for (let attempt = 0; attempt < 4; attempt += 1, scale *= 0.85) {
      const [width, height] = [Math.round(bitmap.width * scale), Math.round(bitmap.height * scale)];
      if (!isLargeEnough({ width, height })) break;
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: false, colorSpace: "srgb" });
      if (!context) throw new ShrinkError("open");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, 0, 0, width, height);
      for (const quality of QUALITIES) {
        const blob = await toBlob(canvas, quality);
        if (blob && blob.size <= TARGET_BYTES) return { blob, url: URL.createObjectURL(blob), width, height };
      }
    }
    throw new ShrinkError("large");
  } finally {
    bitmap.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}
