// «Сохранить теги» против живой БД (pnpm db:up): `pnpm test:db`. Английская сторона — в translations.db.test.ts.
import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import type { TagCode } from "@/lib/domain/catalog";
import { parseRecipeText } from "@/lib/domain/recipe-text/parse";
import { retagText } from "@/lib/domain/recipe-text/retag";
import { getDb, getSql } from "@/lib/server/db/client";
import { recipes } from "@/lib/server/db/schema";

import { catalogLabels, getCatalog } from "./catalog";
import { getRecipe } from "./queries";
import { createRecipe } from "./save";
import { setRecipeTags } from "./tags";

const enabled = process.env.RECIPE_DB_TESTS === "1";
const created: string[] = [];
const marker = randomUUID().slice(0, 8);
const SOURCE = `Лосось ${marker}\nТеги: горячее, белок\nИнгредиенты:\n- Лосось — 600 г - основной\nПриготовление:\n1. Запечь.`;

async function recipe() {
  const parsed = parseRecipeText(SOURCE);
  const saved = await createRecipe(parsed, SOURCE, "draft");
  if (!saved.ok) throw new Error("не сохранилось");
  created.push(saved.id);
  return saved.id;
}

async function retag(id: string, tags: TagCode[]) {
  const stored = await getRecipe(id);
  const result = retagText(stored?.sourceText ?? "", tags, catalogLabels(await getCatalog()));
  if (!stored || !result.ok) throw new Error("строка тегов не легла");
  return { revision: stored.revision, text: result.text };
}

const row = async (id: string) => (await getDb().select().from(recipes).where(eq(recipes.id, id)))[0];

describe.skipIf(!enabled)("теги рецепта: БД", () => {
  afterAll(async () => {
    await getDb().delete(recipes).where(inArray(recipes.id, created));
    await getSql().end({ timeout: 5 });
  });

  it("теги и строка «Теги:» — вместе; revision +1, content_revision и original_text не меняются; пустой набор", async () => {
    const id = await recipe();
    const before = await row(id);
    const next = await retag(id, ["protein", "omega-3"]);
    expect(await setRecipeTags(id, next.revision, ["protein", "omega-3"], next.text)).toEqual({ ok: true, revision: 2 });
    const after = await row(id);
    expect(after).toMatchObject({ revision: 2, contentRevision: before?.contentRevision, originalText: before?.originalText });
    expect(after?.sourceText).toBe(SOURCE.replace("Теги: горячее, белок", "Теги: горячее, белок, омега-3"));
    expect((await getRecipe(id))?.view.tags.map((tag) => tag.id)).toEqual(["protein", "omega-3"]);
    const none = await retag(id, []);
    expect(await setRecipeTags(id, none.revision, [], none.text)).toEqual({ ok: true, revision: 3 });
    expect((await getRecipe(id))?.view.tags).toEqual([]);
  });

  it("устаревшая вкладка — конфликт, удалённый рецепт — «нет»; неизвестный тег — ошибка, ничего не записано", async () => {
    const id = await recipe();
    const next = await retag(id, ["iron"]);
    expect(await setRecipeTags(id, 7, ["iron"], next.text)).toEqual({ ok: false, reason: "conflict" });
    expect(await setRecipeTags(randomUUID(), 1, ["iron"], next.text)).toEqual({ ok: false, reason: "not-found" });
    await expect(setRecipeTags(id, 1, ["nope" as TagCode], next.text)).rejects.toThrow();
    expect(await row(id)).toMatchObject({ revision: 1, sourceText: SOURCE });
    expect((await getRecipe(id))?.view.tags.map((tag) => tag.id)).toEqual(["protein"]);
  });
});
