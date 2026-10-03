import { describe, expect, it } from "vitest";

import { canonicalCrop, fullCrop, isLargeEnough, maxZoom, photoSources, plannedFiles, toFractions } from "./photo";

const landscape = { width: 2000, height: 1500 };
const portrait = { width: 1500, height: 2000 };

describe("кадр фото", () => {
  it("рамка во всё фото — наибольшая 4:3 по центру", () => {
    expect(fullCrop(landscape)).toEqual({ left: 0, top: 0, width: 2000, height: 1500 });
    expect(fullCrop(portrait)).toEqual({ left: 0, top: 437, width: 1500, height: 1125 });
    expect(fullCrop({ width: 2000, height: 1125 })).toEqual({ left: 250, top: 0, width: 1500, height: 1125 });
  });

  it("слишком маленькое фото не кадрируется; увеличение — пока рамка не уже 800 px, не больше 4", () => {
    expect(isLargeEnough({ width: 1000, height: 590 })).toBe(false);
    expect(isLargeEnough({ width: 1067, height: 800 })).toBe(true);
    expect(maxZoom(landscape)).toBe(2.5);
    expect(maxZoom({ width: 900, height: 675 })).toBeCloseTo(1.125);
  });

  it("доли из окна → целые пиксели 4:3 внутри фото; обратно — те же доли", () => {
    const result = canonicalCrop({ x: 0.5, y: 0.5, width: 0.5, height: 0.5 }, landscape);
    expect(result).toEqual({ ok: true, rect: { left: 1000, top: 750, width: 1000, height: 750 } });
    if (result.ok) expect(toFractions(result.rect, landscape)).toEqual({ x: 0.5, y: 0.5, width: 0.5, height: 0.5 });
    // Округление окна чуть вылезло за край — прижимаем внутрь.
    expect(canonicalCrop({ x: 0.51, y: 0.505, width: 0.5, height: 0.5 }, landscape)).toEqual({ ok: true, rect: { left: 1000, top: 750, width: 1000, height: 750 } });
  });

  it("рамке из браузера не верим: не числа, вне фото, не 4:3, слишком мелкая — отказ", () => {
    expect(canonicalCrop({ x: Number.NaN, y: 0, width: 1, height: 1 }, landscape)).toEqual({ ok: false, reason: "invalid" });
    expect(canonicalCrop({ x: 0, y: 0, width: Number.POSITIVE_INFINITY, height: 1 }, landscape)).toEqual({ ok: false, reason: "invalid" });
    expect(canonicalCrop({ x: -0.2, y: 0, width: 0.5, height: 0.5 }, landscape)).toEqual({ ok: false, reason: "invalid" });
    expect(canonicalCrop({ x: 0.7, y: 0, width: 0.5, height: 0.5 }, landscape)).toEqual({ ok: false, reason: "invalid" });
    expect(canonicalCrop({ x: 0, y: 0, width: 1, height: 0.5 }, landscape)).toEqual({ ok: false, reason: "aspect" });
    expect(canonicalCrop({ x: 0, y: 0, width: 0.3, height: 0.3 }, landscape)).toEqual({ ok: false, reason: "small" });
  });

  it("ширины WebP — без увеличения и без повторов", () => {
    expect(plannedFiles(2000)).toEqual([
      { key: 480, width: 480 },
      { key: 960, width: 960 },
      { key: 1600, width: 1600 },
    ]);
    expect(plannedFiles(900)).toEqual([
      { key: 480, width: 480 },
      { key: 960, width: 900 },
    ]);
  });

  it("srcset — по реальным ширинам, src — средний вариант", () => {
    expect(photoSources({ id: "p1", files: plannedFiles(900) })).toEqual({
      src: "/media/recipe/p1/960.webp",
      srcSet: "/media/recipe/p1/480.webp 480w, /media/recipe/p1/960.webp 900w",
      width: 900,
      height: 675,
    });
  });
});
