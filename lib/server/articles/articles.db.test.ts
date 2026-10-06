// Статьи против живой БД (pnpm db:up): `pnpm test:db`. Ходит ролью рантайма recipe_app.
import { randomUUID } from "node:crypto";

import { eq, inArray, sql } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";

import { insertMarker, lastLineOf, remap, removeMarker } from "@/lib/domain/article-text/edit";
import { normalizeText } from "@/lib/domain/article-text/lines";
import { parseArticle } from "@/lib/domain/article-text/parse";
import { fullCrop } from "@/lib/domain/photo";
import { parseRecipeText } from "@/lib/domain/recipe-text/parse";
import { getDb, getSql } from "@/lib/server/db/client";
import { articlePhotos as articlePhotosTable, articles, recipes } from "@/lib/server/db/schema";
import { normalize, renderCrop } from "@/lib/server/media/process";
import { createRecipe } from "@/lib/server/recipes/save";
import { setRecipeStatus } from "@/lib/server/recipes/status";

import { articlePhotoFileInfo } from "./photo-reads";
import { addArticlePhoto, recropArticlePhoto, removeArticlePhoto, setPhotoCaption } from "./photos";
import { readArticleCards, readPublicArticle, readRecipeArticles } from "./public";
import { getArticle, listArticles } from "./queries";
import { createArticle, deleteArticleDraft, replaceArticle, setArticleRecipes, setArticleStatus } from "./save";

const enabled = process.env.RECIPE_DB_TESTS === "1";
const [createdArticles, createdRecipes] = [[] as string[], [] as string[]];
const marker = randomUUID().slice(0, 8);
const TEXT = normalizeText(`Вафли можно подать по-разному.\n\n# С творожным сыром и рыбой\nНамажьте сыром, сверху рыба.\n\n## С ветчиной\n- ветчина\n- огурец`);

const draftOf = (title: string, text = TEXT) => {
  const parsed = parseArticle(text, null);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
  return { title, sourceText: text, body: parsed.body };
};

async function article(title: string, status: "draft" | "published" = "draft") {
  const saved = await createArticle(draftOf(title), status);
  if (!saved.ok) throw new Error("статья не сохранилась");
  createdArticles.push(saved.id);
  return saved.id;
}

async function recipe(title: string) {
  const source = `${title}\nТеги: завтрак\nИнгредиенты:\n- Творог — 200 г - основной\nПриготовление:\n1. Смешать.`;
  const parsed = parseRecipeText(source);
  const saved = await createRecipe(parsed, source, "published");
  if (!saved.ok) throw new Error("рецепт не сохранился");
  createdRecipes.push(saved.id);
  return saved.id;
}

async function rendered(color: string) {
  const input = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: color } }).jpeg().toBuffer();
  const source = await normalize(input);
  const crop = fullCrop(source.size);
  return { size: source.size, crop, files: [source.file, ...(await renderCrop(source.file.bytes, crop))] };
}

describe.skipIf(!enabled)("статьи: БД", () => {
  afterAll(async () => {
    await getDb().delete(articles).where(inArray(articles.id, createdArticles));
    await getDb().delete(recipes).where(inArray(recipes.id, createdRecipes));
    await getSql().end({ timeout: 5 });
  });

  it("новая статья: адрес из названия (`-2` при совпадении), анонс — первый абзац; замена — по revision", async () => {
    const [first, second] = [await article(`Вафли ${marker}`), await article(`Вафли ${marker}`)];
    const [a, b] = [await getArticle(first), await getArticle(second)];
    expect(a?.slug).toBe(`vafli-${marker}`);
    expect(b?.slug).toBe(`vafli-${marker}-2`);
    expect((await listArticles()).some((item) => item.id === first && item.status === "draft")).toBe(true);
    const replaced = await replaceArticle(first, 1, draftOf(`Вафли ${marker} — новое`, `${TEXT}\n\nЕщё абзац.`));
    expect(replaced).toEqual({ ok: true, id: first, revision: 2 });
    expect(await replaceArticle(first, 1, draftOf("Старое"))).toEqual({ ok: false, reason: "conflict" });
    expect((await getArticle(first))?.title).toBe(`Вафли ${marker} — новое`);
    const [row] = await getDb().select({ content: articles.contentRevision }).from(articles).where(eq(articles.id, first));
    expect(row?.content).toBe(2);
  });

  it("черновик не виден на сайте; опубликованная — в списке и по адресу; удалить можно только черновик", async () => {
    const id = await article(`Блины ${marker}`);
    const slug = (await getArticle(id))?.slug ?? "";
    expect(await readPublicArticle("ru", slug)).toBeNull();
    expect((await readArticleCards("ru")).map((card) => card.id)).not.toContain(id);
    await setArticleStatus(id, "published");
    expect((await readArticleCards("ru")).find((card) => card.id === id)).toMatchObject({ title: `Блины ${marker}`, excerpt: "Вафли можно подать по-разному." });
    expect((await readPublicArticle("ru", slug))?.view.blocks[1]).toMatchObject({ type: "heading", text: "С творожным сыром и рыбой" });
    expect(await readPublicArticle("en", slug)).toBeNull();
    expect(await deleteArticleDraft(id)).toBe(false);
    await setArticleStatus(id, "draft");
    expect(await deleteArticleDraft(id)).toBe(true);
  });

  it("связанные рецепты: порядок владельца, снятый рецепт на сайте скрыт (связь остаётся), удалённый — связь уходит", async () => {
    const [waffles, pancakes] = [await recipe(`Вафли рецепт ${marker}`), await recipe(`Блины рецепт ${marker}`)];
    const id = await article(`Подача ${marker}`, "published");
    expect(await setArticleRecipes(id, 1, [pancakes, waffles])).toMatchObject({ ok: true, revision: 2 });
    const slug = (await getArticle(id))?.slug ?? "";
    expect((await readPublicArticle("ru", slug))?.view.recipes.map((card) => card.title)).toEqual([`Блины рецепт ${marker}`, `Вафли рецепт ${marker}`]);
    expect((await readRecipeArticles("ru", waffles)).map((card) => card.id)).toEqual([id]);
    await setRecipeStatus(pancakes, "draft");
    expect((await readPublicArticle("ru", slug))?.view.recipes.map((card) => card.title)).toEqual([`Вафли рецепт ${marker}`]);
    expect((await getArticle(id))?.recipes.map((item) => item.status)).toEqual(["draft", "published"]);
    await getDb().delete(recipes).where(eq(recipes.id, waffles));
    expect((await getArticle(id))?.recipes.map((item) => item.id)).toEqual([pancakes]);
  });

  it("фото: «Добавить сюда» — метка и фото вместе; новый кадр — тот же код и подпись; «Убрать» — метка и фото уходят", async () => {
    const id = await article(`Фото ${marker}`, "published");
    const stored = await getArticle(id);
    if (!stored) throw new Error("нет статьи");
    const sourceText = insertMarker(stored.sourceText, lastLineOf(stored.body, "b1") ?? -1, "Q7K2");
    const moved = remap(stored.sourceText, stored.body, sourceText);
    if (!moved.ok) throw new Error("разметка не легла");
    expect(await addArticlePhoto(id, 1, "Q7K2", await rendered("#c96"), { sourceText, body: moved.body })).toMatchObject({ ok: true, revision: 2 });
    expect(await addArticlePhoto(id, 1, "W3XR", await rendered("#c96"), { sourceText, body: moved.body })).toEqual({ ok: false, reason: "conflict" });
    const withPhoto = await getArticle(id);
    const photo = withPhoto?.photos.get("Q7K2");
    if (!photo) throw new Error("нет фото");
    expect(await articlePhotoFileInfo(photo.id, "w960")).toEqual({ contentType: "image/webp", published: true });
    const page = await readPublicArticle("ru", withPhoto?.slug ?? "");
    expect(page?.cover?.id).toBe(photo.id);
    expect(page?.view.photos.Q7K2).toMatchObject({ ref: { id: photo.id, kind: "article" }, alt: `Фото ${marker}` });

    expect(await setPhotoCaption(id, "Q7K2", "Вафли с рыбой")).toBe(true);
    const recropped = await recropArticlePhoto(id, "Q7K2", photo.id, await rendered("#9c6"));
    expect(recropped.ok && recropped.id).not.toBe(photo.id);
    expect(await recropArticlePhoto(id, "Q7K2", photo.id, await rendered("#9c6"))).toEqual({ ok: false, reason: "conflict" });
    const after = await getArticle(id);
    expect(after?.photos.get("Q7K2")).toMatchObject({ caption: "Вафли с рыбой" });
    expect(await articlePhotoFileInfo(photo.id, "w960")).toBeNull();

    const without = removeMarker(after?.sourceText ?? "", "Q7K2");
    const back = remap(after?.sourceText ?? "", after?.body ?? { schemaVersion: 1, blocks: [] }, without);
    if (!back.ok || !after) throw new Error("разметка не легла");
    expect(await removeArticlePhoto(id, after.revision, "Q7K2", { sourceText: without, body: back.body })).toMatchObject({ ok: true });
    expect(await getDb().select().from(articlePhotosTable).where(eq(articlePhotosTable.articleId, id))).toEqual([]);
  });

  it("CHECK: код фото без похожих символов; документ — объект; связь не больше 20", async () => {
    const id = await article(`Проверки ${marker}`);
    const files = await rendered("#fff");
    await expect(addArticlePhoto(id, 1, "O0I1", files, { sourceText: TEXT, body: parseArticle(TEXT, null).body })).rejects.toThrow();
    await expect(getDb().execute(sql`update articles set body = '[]'::jsonb where id = ${id}`)).rejects.toThrow();
  });
});
