// Публичное чтение против живой БД (pnpm db:up): `pnpm test:db`. Главное — черновик не виден нигде.
// Раздел «Заготовки» другие тесты БД не трогают — счётчики в нём можно сравнивать.
import { randomUUID } from "node:crypto";

import { inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { parseRecipeText } from "@/lib/domain/recipe-text/parse";
import { getDb, getSql } from "@/lib/server/db/client";
import { recipes } from "@/lib/server/db/schema";

import { readCatalog, readPublicRecipe } from "./public";
import { readCards, readSearchIndex } from "./public-lists";
import { getRecipe } from "./queries";
import { createRecipe } from "./save";
import { setRecipeStatus } from "./status";

const enabled = process.env.RECIPE_DB_TESTS === "1";
const created: string[] = [];
const marker = randomUUID().slice(0, 8);

const text = (title: string) =>
  `${title}\nТеги: заготовки, соусы, белок\nИнгредиенты:\n- Томаты (спелые) — 1 кг - основной\n- Соль — 1 ч. л.\nПриготовление:\n1. Варить.`;

async function draft(title: string) {
  const source = text(title);
  const result = parseRecipeText(source);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  const saved = await createRecipe(result, source, "draft");
  if (!saved.ok) throw new Error("не сохранилось");
  created.push(saved.id);
  const stored = await getRecipe(saved.id);
  if (!stored) throw new Error("не читается");
  return stored;
}

const preserves = async () => (await readCatalog("ru")).sections.find((section) => section.code === "preserves")?.recipes;
const slugs = (items: { slug: string }[]) => items.map((item) => item.slug);

describe.skipIf(!enabled)("публичный сайт: БД", () => {
  afterAll(async () => {
    await getDb().delete(recipes).where(inArray(recipes.id, created));
    await getSql().end({ timeout: 5 });
  });

  it("каталог: все 11 разделов по порядку (и пустые), со slug; теги состава", async () => {
    const { sections, tags } = await readCatalog("ru");
    expect(sections).toHaveLength(11);
    expect(sections[0]).toMatchObject({ code: "breakfast", label: "Завтраки" });
    expect(sections.every((section) => section.slug.length > 0 && section.recipes >= 0)).toBe(true);
    expect(tags.map((tag) => tag.code)).toContain("protein");
  });

  it("черновик не виден нигде: ни по адресу, ни в списках, ни в поиске, ни в счётчике раздела", async () => {
    const before = await preserves();
    const recipe = await draft(`Лечо ${marker}`);
    expect(await readPublicRecipe("ru", recipe.slug)).toBeNull();
    expect(slugs(await readCards("ru"))).not.toContain(recipe.slug);
    expect(slugs(await readCards("ru", { sectionCode: "preserves" }))).not.toContain(recipe.slug);
    expect(slugs(await readSearchIndex("ru"))).not.toContain(recipe.slug);
    expect(await preserves()).toBe(before);
  });

  it("опубликованный — везде, в т. ч. в неосновном разделе; снятый — снова нигде", async () => {
    const before = (await preserves()) ?? 0;
    const recipe = await draft(`Аджика ${marker}`);
    await setRecipeStatus(recipe.id, "published");

    const page = await readPublicRecipe("ru", recipe.slug);
    expect(Object.keys(page ?? {}).sort()).toEqual(["id", "otherSlug", "slug", "updatedAt", "view"]);
    expect(page?.view.title).toBe(`Аджика ${marker}`);
    expect(page?.view.sections.map((section) => section.href)).toEqual([expect.stringMatching(/^\/ru\/catalog\/.+/), expect.stringMatching(/^\/ru\/catalog\/.+/)]);
    expect(await preserves()).toBe(before + 1);

    const [newest] = await readCards("ru", { limit: 1 });
    expect(newest).toMatchObject({ slug: recipe.slug, section: { code: "preserves", label: "Заготовки" } });
    expect(slugs(await readCards("ru", { sectionCode: "sauces" }))).toContain(recipe.slug);
    const entry = (await readSearchIndex("ru")).find((item) => item.slug === recipe.slug);
    expect(entry).toMatchObject({ ingredients: ["Томаты", "Соль"], sections: expect.arrayContaining(["preserves", "sauces"]), tagCodes: ["protein"] });

    await setRecipeStatus(recipe.id, "draft");
    expect(await readPublicRecipe("ru", recipe.slug)).toBeNull();
    expect(slugs(await readSearchIndex("ru"))).not.toContain(recipe.slug);
    expect(await preserves()).toBe(before);
  });

  it("карточка: первый тег — в порядке автора, а не каталога (главная, раздел, поиск)", async () => {
    const source = `Икра ${marker}\nТеги: заготовки, клетчатка, белок\nИнгредиенты:\n- Кабачки — 1 кг - основной\nПриготовление:\n1. Тушить.`;
    const parsed = parseRecipeText(source);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    const saved = await createRecipe(parsed, source, "published");
    if (!saved.ok) throw new Error("не сохранилось");
    created.push(saved.id);
    const fiber = { id: "fiber", label: "Клетчатка" };
    expect((await readCards("ru")).find((card) => card.id === saved.id)?.tag).toEqual(fiber);
    expect((await readCards("ru", { sectionCode: "preserves" })).find((card) => card.id === saved.id)?.tag).toEqual(fiber);
    const entry = (await readSearchIndex("ru")).find((item) => item.title === `Икра ${marker}`);
    expect(entry).toMatchObject({ tag: fiber, tagCodes: ["fiber", "protein"] });
  });

  it("неизвестный адрес — null", async () => {
    expect(await readPublicRecipe("ru", `net-takogo-${marker}`)).toBeNull();
  });
});
