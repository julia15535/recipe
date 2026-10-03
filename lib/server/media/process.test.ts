import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { normalize, PhotoError, renderCrop } from "./process";

// Эталон 400×300 с разными углами: слева сверху красный, справа сверху зелёный, слева снизу синий, справа снизу белый.
const QUADRANTS = [
  { left: 0, top: 0, color: "#ff0000" },
  { left: 200, top: 0, color: "#00ff00" },
  { left: 0, top: 150, color: "#0000ff" },
  { left: 200, top: 150, color: "#ffffff" },
];

async function reference(): Promise<Buffer> {
  const tile = (color: string) => sharp({ create: { width: 200, height: 150, channels: 3, background: color } }).png().toBuffer();
  const tiles = await Promise.all(QUADRANTS.map(async (q) => ({ input: await tile(q.color), left: q.left, top: q.top })));
  return sharp({ create: { width: 400, height: 300, channels: 3, background: "#000000" } }).composite(tiles).png().toBuffer();
}

/** Средний цвет области → ближайший из угловых. */
async function colorAt(image: Buffer, left: number, top: number, size = 20): Promise<string> {
  // stats() считает по входу, а не после extract — сначала вырезать в отдельный буфер.
  const region = await sharp(image).extract({ left, top, width: size, height: size }).toBuffer();
  const { channels } = await sharp(region).stats();
  const [r, g, b] = channels.map((c) => (c.mean > 128 ? "f" : "0"));
  return `${r}${g}${b}`;
}

const corners = async (image: Buffer) => {
  const { width = 0, height = 0 } = await sharp(image).metadata();
  return [await colorAt(image, 5, 5), await colorAt(image, width - 25, 5), await colorAt(image, 5, height - 25), await colorAt(image, width - 25, height - 25)];
};
const UPRIGHT = ["f00", "0f0", "00f", "fff"];

// Как хранит камера: пиксели, которые при показе с тегом ориентации n дают эталон (EXIF 1–8, вкл. зеркальные).
const stored: Record<number, (img: Buffer) => Promise<Buffer>> = {
  2: (img) => sharp(img).flop().toBuffer(),
  3: (img) => sharp(img).rotate(180).toBuffer(),
  4: (img) => sharp(img).flip().toBuffer(),
  5: async (img) => sharp(await sharp(img).rotate(90).toBuffer()).flop().toBuffer(),
  6: (img) => sharp(img).rotate(270).toBuffer(),
  7: async (img) => sharp(await sharp(img).rotate(270).toBuffer()).flop().toBuffer(),
  8: (img) => sharp(img).rotate(90).toBuffer(),
};

describe("обработка фото", () => {
  it("поворот по EXIF 2–8 (и зеркальные) — фото стоит как на экране камеры", async () => {
    const ref = await reference();
    for (const [orientation, transform] of Object.entries(stored)) {
      const input = await sharp(await transform(ref)).withMetadata({ orientation: Number(orientation) }).jpeg({ quality: 95 }).toBuffer();
      const { file } = await normalize(input);
      expect(await corners(file.bytes), `ориентация ${orientation}`).toEqual(UPRIGHT);
      expect([file.width, file.height]).toEqual([400, 300]);
    }
  });

  it("метаданные не сохраняются: ни EXIF с GPS, ни ICC; цвет — sRGB", async () => {
    const input = await sharp(await reference())
      .withExif({ IFD0: { Copyright: "secret" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "55/1 45/1 0/1" } })
      .withIccProfile("p3")
      .jpeg()
      .toBuffer();
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const { file } = await normalize(input);
    const meta = await sharp(file.bytes).metadata();
    expect([meta.exif, meta.icc, meta.space]).toEqual([undefined, undefined, "srgb"]);
  });

  it("прозрачность — на светлом фоне; большое фото уменьшается до 2000 px", async () => {
    const png = await sharp({ create: { width: 3000, height: 1000, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    const { file } = await normalize(png);
    expect([file.width, file.height]).toEqual([2000, 667]);
    expect(await colorAt(file.bytes, 100, 100)).toBe("fff");
  });

  it("не фото, SVG, GIF, битый JPEG, слишком большое — понятный отказ", async () => {
    const reason = (input: Buffer) => normalize(input).then(() => "ok", (error: unknown) => (error instanceof PhotoError ? error.reason : "другое"));
    const jpeg = await sharp(await reference()).jpeg().toBuffer();
    expect(await reason(Buffer.from("просто текст"))).toBe("format");
    expect(await reason(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'))).toBe("format");
    expect(await reason(await sharp(await reference()).gif().toBuffer())).toBe("format");
    expect(await reason(jpeg.subarray(0, Math.floor(jpeg.length / 2)))).toBe("broken");
    expect(await reason(Buffer.alloc(901 * 1024))).toBe("large");
    // Ровно 900 КиБ проходит предел размера (дальше — проверка содержимого).
    expect(await reason(Buffer.alloc(900 * 1024))).toBe("format");
    // Сигнатура JPEG без содержимого — libvips не откроет.
    expect(await reason(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe("broken");
    const huge = await sharp({ create: { width: 3000, height: 3000, channels: 3, background: "#808080" } }).png().toBuffer();
    expect(await reason(huge)).toBe("large");
  });

  it("кадр: вырезан именно выбранный прямоугольник; WebP по ширине без увеличения, превью ссылки 1200×630", async () => {
    const half = (color: string) => sharp({ create: { width: 1000, height: 1500, channels: 3, background: color } }).png().toBuffer();
    const source = await sharp({ create: { width: 2000, height: 1500, channels: 3, background: "#000" } })
      .composite([
        { input: await half("#ff0000"), left: 0, top: 0 },
        { input: await half("#0000ff"), left: 1000, top: 0 },
      ])
      .jpeg()
      .toBuffer();
    const files = await renderCrop(source, { left: 1000, top: 0, width: 1000, height: 750 });
    expect(files.map((f) => [f.name, f.width, f.height, f.contentType])).toEqual([
      ["w480", 480, 360, "image/webp"],
      ["w960", 960, 720, "image/webp"],
      ["w1600", 1000, 750, "image/webp"],
      ["og", 1200, 630, "image/jpeg"],
    ]);
    for (const file of files) expect(await colorAt(file.bytes, 10, 10)).toBe("00f");
  });
});
