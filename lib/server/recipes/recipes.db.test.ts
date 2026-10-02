// Рецепты против живой БД (pnpm db:up): `pnpm test:db`. Ходит ролью рантайма recipe_app.
import { randomUUID } from "node:crypto";

import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { fraction } from "@/lib/domain/fraction";
import { type ParseResult, parseRecipeText } from "@/lib/domain/recipe-text/parse";
import { getDb, getSql } from "@/lib/server/db/client";
import { recipeIngredients, recipes } from "@/lib/server/db/schema";

import vafliV2 from "../../domain/recipe-text/fixtures/vafli-v2.txt?raw";
import { getRecipe, listRecipes } from "./queries";
import { createRecipe, replaceRecipe } from "./save";
import { countImportsLastHour, dropImport, loadImport, storeImport } from "./imports";
import { deleteDraft, setRecipeStatus } from "./status";

const enabled = process.env.RECIPE_DB_TESTS === "1";
const created: string[] = [];
const marker = randomUUID().slice(0, 8);

function parsed(text: string): ParseResult & { mainIndex: number } {
  const result = parseRecipeText(text);
  if (!result.ok || result.mainIndex === null) throw new Error(JSON.stringify(result.issues));
  return { ...result, mainIndex: result.mainIndex };
}

async function create(text: string, status: "draft" | "published" = "draft") {
  const outcome = await createRecipe(parsed(text), text, status);
  if (!outcome.ok) throw new Error("не сохранилось");
  created.push(outcome.id);
  return outcome;
}

const simple = (title: string, extra = "") =>
  `${title}\nТеги: суп, клетчатка\nИнгредиенты:\n- Вода — 2 л - основной\n- Соль — ⅓ ч. л.\n- Перец — ⅔ ч. л.\n- Лук — 1⅓ шт.${extra}\nПриготовление:\n1. Варить.`;

describe.skipIf(!enabled)("рецепты: БД", () => {
  afterAll(async () => {
    await getDb().delete(recipes).where(inArray(recipes.id, created));
    await getSql().end({ timeout: 5 });
  });

  it("вафли v2: сохраняются и читаются как разобраны; ⅓ остаётся точной дробью", async () => {
    const { id } = await create(vafliV2);
    const stored = await getRecipe(id);
    expect(stored?.slug).toMatch(/^tvorozhnye-vafli(-\d+)?$/);
    expect(stored?.view.title).toBe("Творожные вафли");
    expect(stored?.view.sections).toEqual([{ code: "breakfast", label: "Завтраки", href: null }]);
    expect(stored?.view.tags).toEqual([{ id: "protein", label: "Белок" }]);
    expect(stored?.view.ingredients.map((item) => item.name)).toHaveLength(8);
    expect(stored?.view.mainId).toBe(stored?.view.ingredients[0]?.id);
    expect(stored?.sourceText).toBe(vafliV2);

    const soup = await create(simple(`Суп ${marker}`));
    const [, salt, pepper, onion] = (await getRecipe(soup.id))?.view.ingredients ?? [];
    expect(salt?.quantity).toEqual({ kind: "exact", amount: fraction(1, 3) });
    expect(pepper?.quantity).toEqual({ kind: "exact", amount: fraction(2, 3) });
    expect(onion?.quantity).toEqual({ kind: "exact", amount: fraction(4, 3) });
    expect((await listRecipes()).some((item) => item.id === soup.id && item.status === "draft")).toBe(true);
  });

  it("одинаковое название → адрес с `-2`; при замене текста адрес не меняется, revision растёт", async () => {
    const first = await create(simple(`Борщ ${marker}`));
    const second = await create(simple(`Борщ ${marker}`));
    const [a, b] = [await getRecipe(first.id), await getRecipe(second.id)];
    expect(b?.slug).toBe(`${a?.slug}-2`);

    const text = simple(`Щи ${marker}`);
    const replaced = await replaceRecipe(first.id, 1, parsed(text), text);
    expect(replaced).toEqual({ ok: true, id: first.id, revision: 2 });
    const after = await getRecipe(first.id);
    expect(after?.view.title).toBe(`Щи ${marker}`);
    expect(after?.slug).toBe(a?.slug);
  });

  it("устаревшая вкладка не перетирает; несуществующий рецепт — not-found", async () => {
    const { id } = await create(simple(`Уха ${marker}`));
    const text = simple(`Уха ${marker} 2`);
    expect((await replaceRecipe(id, 1, parsed(text), text)).ok).toBe(true);
    expect(await replaceRecipe(id, 1, parsed(text), text)).toEqual({ ok: false, reason: "conflict" });
    expect(await replaceRecipe(randomUUID(), 1, parsed(text), text)).toEqual({ ok: false, reason: "not-found" });
  });

  it("сбой вставки строк — старая версия остаётся целиком", async () => {
    const { id } = await create(simple(`Солянка ${marker}`));
    const broken = parsed(simple(`Солянка ${marker} новая`));
    const first = broken.draft.ingredients[1];
    if (first) first.note = "x".repeat(400);
    await expect(replaceRecipe(id, 1, broken, "текст")).rejects.toThrow(/ошибка БД/);
    const kept = await getRecipe(id);
    expect(kept?.view.title).toBe(`Солянка ${marker}`);
    expect(kept?.revision).toBe(1);
  });

  it("основной не отмечен — рецепт сохраняется без основного; основной из чужого рецепта БД не пустит", async () => {
    const text = simple(`Винегрет ${marker}`).replace(" - основной", "");
    const result = parseRecipeText(text);
    expect(result.ok && result.mainIndex === null).toBe(true);
    const outcome = await createRecipe(result, text, "draft");
    if (!outcome.ok) throw new Error("не сохранилось");
    created.push(outcome.id);
    expect((await getRecipe(outcome.id))?.view.mainId).toBeNull();
    const other = await create(simple(`Рагу ${marker}`));
    const foreign = (await getRecipe(other.id))?.view.mainId ?? "";
    await expect(getDb().update(recipes).set({ mainIngredientId: foreign }).where(eq(recipes.id, outcome.id))).rejects.toThrow();
    // Замена: без основного → с основным → снова без.
    const withMain = simple(`Винегрет ${marker}`);
    expect((await replaceRecipe(outcome.id, 1, parsed(withMain), withMain)).ok).toBe(true);
    expect((await getRecipe(outcome.id))?.view.mainId).not.toBeNull();
    expect((await replaceRecipe(outcome.id, 2, parseRecipeText(text), text)).ok).toBe(true);
    expect((await getRecipe(outcome.id))?.view.mainId).toBeNull();
  });

  it("основной FK отдельно: несуществующий основной при верном разделе — отказ", async () => {
    const { id } = await create(simple(`Солянка-2 ${marker}`));
    await expect(getDb().update(recipes).set({ mainIngredientId: randomUUID() }).where(eq(recipes.id, id))).rejects.toThrow();
  });

  it("БД не пускает основной ингредиент, которого нет (отложенный FK); строка без количества и пометки — можно", async () => {
    const orphan = randomUUID();
    await expect(
      getDb().transaction(async (tx) => {
        await tx.execute(sql`insert into recipes (id, source_text, main_ingredient_id, primary_section_id)
          values (${orphan}, 'x', ${randomUUID()}, ${randomUUID()})`);
      }),
    ).rejects.toThrow();
    const { id } = await create(simple(`Окрошка ${marker}`));
    await expect(
      getDb().insert(recipeIngredients).values({ id: randomUUID(), recipeId: id, position: 9, displayName: "Соль", quantityKind: "none" }),
    ).resolves.toBeDefined();
    await expect(
      getDb().insert(recipeIngredients).values({ id: randomUUID(), recipeId: id, position: 10, displayName: "Мука", quantityKind: "exact" }),
    ).rejects.toThrow();
  });

  it("публикация, снятие (дата первой публикации остаётся), удаление только черновика", async () => {
    const { id } = await create(simple(`Рассольник ${marker}`));
    expect(await setRecipeStatus(id, "published")).toBe(true);
    const [published] = await getDb().select().from(recipes).where(eq(recipes.id, id));
    expect(published?.publishedAt).toBeInstanceOf(Date);
    expect(await deleteDraft(id)).toBe(false);
    expect(await setRecipeStatus(id, "draft")).toBe(true);
    const [draft] = await getDb().select().from(recipes).where(eq(recipes.id, id));
    expect(draft?.publishedAt).toEqual(published?.publishedAt);
    expect(draft?.revision).toBe(3);
    expect(await deleteDraft(id)).toBe(true);
    expect(await getRecipe(id)).toBeNull();
    expect(await getDb().select().from(recipeIngredients).where(eq(recipeIngredients.recipeId, id))).toEqual([]);
  });

  it("советы и исходный текст сохраняются и заменяются вместе с рецептом", async () => {
    const text = simple(`Харчо ${marker}`, "") + "\nСоветы:\n- Лучше на следующий день.\n- Кинзу добавлять в конце.";
    const outcome = await createRecipe(parsed(text), text, "draft", "сырой текст как вставлен");
    if (!outcome.ok) throw new Error("не сохранилось");
    created.push(outcome.id);
    const stored = await getRecipe(outcome.id);
    expect(stored?.view.tips.map((tip) => tip.text)).toEqual(["Лучше на следующий день.", "Кинзу добавлять в конце."]);
    const [row] = await getDb().select({ originalText: recipes.originalText }).from(recipes).where(eq(recipes.id, outcome.id));
    expect(row?.originalText).toBe("сырой текст как вставлен");
    const next = simple(`Харчо ${marker}`);
    expect((await replaceRecipe(outcome.id, 1, parsed(next), next, "новый сырой")).ok).toBe(true);
    expect((await getRecipe(outcome.id))?.view.tips).toEqual([]);
    // Правка «по старому формату» (без исходного текста) не стирает исходный текст разбора ИИ.
    expect((await replaceRecipe(outcome.id, 2, parsed(next), next)).ok).toBe(true);
    const [kept] = await getDb().select({ originalText: recipes.originalText }).from(recipes).where(eq(recipes.id, outcome.id));
    expect(kept?.originalText).toBe("новый сырой");
  });

  it("разбор ИИ хранится на сервере сутки и считается для лимита", async () => {
    const result = parseRecipeText(simple(`Лагман ${marker}`));
    const before = await countImportsLastHour();
    const id = await storeImport("как вставлено", { ok: true, draft: result.draft, mainIndex: result.mainIndex, checks: [] });
    expect(await countImportsLastHour()).toBe(before + 1);
    expect((await loadImport(id))?.result.draft.title).toBe(`Лагман ${marker}`);
    expect((await loadImport(id))?.result.draft.ingredients[1]?.quantity).toEqual({ kind: "exact", amount: fraction(1, 3) });
    expect(await loadImport(randomUUID())).toBeNull();
    await dropImport(id);
    expect(await loadImport(id)).toBeNull();
  });

  it("роль рантайма меняет данные рецептов, но не их схему", async () => {
    for (const table of ["recipes", "recipe_ingredients", "sections"]) {
      await expect(getSql().unsafe(`alter table ${table} add column probe int`)).rejects.toThrow(/must be owner|permission denied/);
    }
    await expect(getSql()`create table recipe_probe (id int)`).rejects.toThrow(/permission denied/);
    await expect(getSql()`select count(*) from sections`).resolves.toBeDefined();
  });
});
