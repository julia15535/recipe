// Иконки сайта из одного рисунка `app/icon.svg` (владелец 03.10, ADR-0033): `app/favicon.ico` (16, 32, 48 — старые
// браузеры и поисковики) и `app/apple-icon.png` (180, значок на экране телефона — на кремовом фоне, без прозрачности).
// Запуск после правки рисунка: `node scripts/make-icons.mjs`; готовые файлы — в git.
import { readFileSync, writeFileSync } from "node:fs";

import sharp from "sharp";

const svg = readFileSync("app/icon.svg");
const png = (size) => sharp(svg, { density: Math.ceil((72 * size) / 64) * 4 }).resize(size, size).png().toBuffer();

// ICO — заголовок, оглавление по 16 байт и PNG-картинки подряд.
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map(png));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((size, index) => {
  const entry = 6 + 16 * index;
  header.writeUInt8(size, entry);
  header.writeUInt8(size, entry + 1);
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(images[index].length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += images[index].length;
});
writeFileSync("app/favicon.ico", Buffer.concat([header, ...images]));

const apple = await sharp(svg, { density: 72 * 3 * 4 }).resize(150, 150).png().toBuffer();
await sharp({ create: { width: 180, height: 180, channels: 4, background: "#f8f2e6" } })
  .composite([{ input: apple, left: 15, top: 15 }])
  .png()
  .toFile("app/apple-icon.png");
