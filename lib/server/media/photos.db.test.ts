// Фото блюда против живой БД (pnpm db:up): `pnpm test:db`. Ходит ролью рантайма recipe_app.
import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";

import { fullCrop } from "@/lib/domain/photo";
import { parseRecipeText } from "@/lib/domain/recipe-text/parse";
import { getDb, getSql } from "@/lib/server/db/client";
import { recipePhotoFiles, recipePhotos, recipes } from "@/lib/server/db/schema";
import { getRecipe } from "@/lib/server/recipes/queries";
import { createRecipe } from "@/lib/server/recipes/save";
import { deleteDraft, setRecipeStatus } from "@/lib/server/recipes/status";

import { editablePhoto, photoFileBytes, photoFileInfo, photoRefs } from "./photo-reads";
import { deletePhoto, storePhoto } from "./photos";
import { normalize, renderCrop } from "./process";

const enabled = process.env.RECIPE_DB_TESTS === "1";
const created: string[] = [];
const marker = randomUUID().slice(0, 8);

async function recipe(title: string) {
  const source = `${title}\nТеги: завтрак\nИнгредиенты:\n- Творог — 200 г - основной\nПриготовление:\n1. Смешать.`;
  const result = parseRecipeText(source);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  const saved = await createRecipe(result, source, "draft");
  if (!saved.ok) throw new Error("не сохранилось");
  created.push(saved.id);
  return saved.id;
}

async function photo(color: string) {
  const input = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: color } }).jpeg().toBuffer();
  const source = await normalize(input);
  const crop = fullCrop(source.size);
  return { size: source.size, crop, files: [source.file, ...(await renderCrop(source.file.bytes, crop))] };
}

describe.skipIf(!enabled)("фото: БД", () => {
  afterAll(async () => {
    await getDb().delete(recipes).where(inArray(recipes.id, created));
    await getSql().end({ timeout: 5 });
  });

  it("сохраняется с файлами; рецепт черновик — файл помечен неопубликованным; в модели показа — id и ширины", async () => {
    const id = await recipe(`Сырники ${marker}`);
    const saved = await storePhoto({ recipeId: id, expected: null, ...(await photo("#c96")) });
    if (!saved.ok) throw new Error("фото не сохранилось");
    expect(await photoFileInfo(saved.id, "w480")).toEqual({ contentType: "image/webp", published: false });
    expect((await sharp((await photoFileBytes(saved.id, "w480")) ?? Buffer.alloc(0)).metadata()).width).toBe(480);
    expect((await photoRefs(getDb(), [id])).get(id)).toEqual({
      id: saved.id,
      files: expect.arrayContaining([
        { key: 480, width: 480 },
        { key: 960, width: 960 },
        { key: 1600, width: 1600 },
      ]),
    });
    expect((await getRecipe(id))?.view.photo?.id).toBe(saved.id);
    await setRecipeStatus(id, "published");
    expect((await photoFileInfo(saved.id, "og"))?.published).toBe(true);
    expect(await editablePhoto(id)).toEqual({ id: saved.id, size: { width: 1600, height: 1200 }, crop: { left: 0, top: 0, width: 1600, height: 1200 } });
  });

  it("замена — новый id, старый пропадает; вкладка со старым фото — conflict; убрать — только своё", async () => {
    const id = await recipe(`Оладьи ${marker}`);
    const first = await storePhoto({ recipeId: id, expected: null, ...(await photo("#933")) });
    if (!first.ok) throw new Error("фото не сохранилось");
    expect(await storePhoto({ recipeId: id, expected: null, ...(await photo("#393")) })).toEqual({ ok: false, reason: "conflict" });
    const second = await storePhoto({ recipeId: id, expected: first.id, ...(await photo("#339")) });
    if (!second.ok) throw new Error("замена не сохранилась");
    expect(second.id).not.toBe(first.id);
    expect(await photoFileInfo(first.id, "w480")).toBeNull();
    expect(await deletePhoto(id, first.id)).toEqual({ ok: false, reason: "conflict" });
    expect(await deletePhoto(id, second.id)).toEqual({ ok: true, id: second.id });
    expect(await photoFileBytes(second.id, "w480")).toBeNull();
    expect(await storePhoto({ recipeId: randomUUID(), expected: null, ...(await photo("#999")) })).toEqual({ ok: false, reason: "not-found" });
  });

  it("удаление рецепта удаляет фото и все его файлы (каскад); байты хранятся вне строки без сжатия", async () => {
    const id = await recipe(`Блины ${marker}`);
    const saved = await storePhoto({ recipeId: id, expected: null, ...(await photo("#36c")) });
    if (!saved.ok) throw new Error("фото не сохранилось");
    expect(await deleteDraft(id)).toBe(true);
    expect(await getDb().select().from(recipePhotos).where(eq(recipePhotos.id, saved.id))).toEqual([]);
    expect(await getDb().select({ name: recipePhotoFiles.name }).from(recipePhotoFiles).where(eq(recipePhotoFiles.photoId, saved.id))).toEqual([]);
    // Предел байтов одного файла — и в самой базе (1 МиБ).
    const big = await recipe(`Пирог ${marker}`);
    const huge = await photo("#c63");
    const [source] = huge.files;
    if (!source) throw new Error("нет исходника");
    await expect(storePhoto({ recipeId: big, expected: null, ...huge, files: [{ ...source, bytes: Buffer.alloc(1024 * 1024 + 1) }] })).rejects.toThrow(/ошибка БД/);
    const [storage] = await getSql()`select attstorage from pg_attribute where attrelid = 'recipe_photo_files'::regclass and attname = 'bytes'`;
    expect(storage?.attstorage).toBe("e");
  });
});
