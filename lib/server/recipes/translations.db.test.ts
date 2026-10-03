// Перевод рецептов против живой БД (pnpm db:up): `pnpm test:db`. ИИ — подставной «переводчик» (EN перед текстами).
// Раздел «Напитки» — свой у этого файла (счётчики сравниваются; «Заготовки» — у public.db.test.ts).
import { randomUUID } from "node:crypto";

import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { parseRecipeText } from "@/lib/domain/recipe-text/parse";
import { type AiTranslation, composeTranslation, type SourceRecipe } from "@/lib/domain/translation";
import { type Masked, maskNumbers } from "@/lib/domain/translation-numbers";
import { getDb, getSql } from "@/lib/server/db/client";
import { recipes, recipeTranslationJobs } from "@/lib/server/db/schema";
import type { AiConfig } from "@/lib/server/env";

import { readCatalog, readPublicRecipe } from "./public";
import { readCards, readSearchIndex } from "./public-lists";
import { createRecipe, replaceRecipe } from "./save";
import { setRecipeStatus } from "./status";
import { claimJob, enqueueTranslation, finishJob, MAX_ATTEMPTS } from "./translation-jobs";
import { failExhausted, translationState } from "./translation-queue";
import { runJob } from "./translation-run";

const enabled = process.env.RECIPE_DB_TESTS === "1";
const created: string[] = [];
const marker = randomUUID().slice(0, 8);
const config: AiConfig = { apiKey: "test", baseUrl: "http://127.0.0.1:9", model: "test/model" } as AiConfig;

const text = (title: string, extra = "") =>
  `${title}\nТеги: напитки, соусы, белок\nПорции: 4\nИнгредиенты:\n- Томаты — 1 кг - основной\n- Соль — 1 ч. л.${extra}\nПриготовление:\n1. Варить 20 минут при 180 °C.`;

async function published(title: string) {
  const source = text(title);
  const parsed = parseRecipeText(source);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
  const saved = await createRecipe(parsed, source, "published");
  if (!saved.ok) throw new Error("не сохранилось");
  created.push(saved.id);
  return saved.id;
}

/** Подставной переводчик: как настоящий — метки чисел, проверка через composeTranslation. */
const fake = (prefix: string) => async (source: SourceRecipe) => {
  const masks = new Map<string, Masked>();
  const m = (path: string, value: string | null) => {
    if (value === null) return null;
    const masked = maskNumbers(value);
    masks.set(path, masked);
    return `${prefix} ${masked.text}`;
  };
  const ai: AiTranslation = {
    title: m("title", source.title) ?? "",
    description: m("description", source.description),
    time: m("time", source.time),
    yieldForms: source.yield ? ["serving", "servings"] : null,
    ingredients: source.ingredients.map((row) => ({ id: row.id, name: m(`ingredients.${row.id}.name`, row.name) ?? "", note: m(`ingredients.${row.id}.note`, row.note), unitForms: null })),
    steps: source.steps.map((row) => ({ id: row.id, text: m(`steps.${row.id}`, row.text) ?? "" })),
    tips: source.tips.map((row) => ({ id: row.id, text: m(`tips.${row.id}`, row.text) ?? "" })),
  };
  const composed = composeTranslation(source, ai, masks);
  if (!composed.ok) return composed;
  return { ok: true as const, head: composed.head, body: composed.body, model: "test/model", promptVersion: "test" };
};
const failing = async () => ({ ok: false as const, reason: "server" as const });

async function translate(recipeId: string, force: boolean, prefix = "EN") {
  const job = await enqueueTranslation(recipeId, force);
  if (job) await runJob(job, { translate: fake(prefix), config });
  return job;
}

describe.skipIf(!enabled)("перевод: БД", () => {
  afterAll(async () => {
    await getDb().delete(recipes).where(inArray(recipes.id, created));
    await getSql().end({ timeout: 5 });
  });

  it("перевод → английская страница, карточки, поиск и счётчик раздела; числа и коды — из русского", async () => {
    const id = await published(`Лечо ${marker}`);
    const before = (await readCatalog("en")).sections.find((s) => s.code === "drinks")?.recipes ?? 0;
    expect(await translationState(id)).toEqual({ slug: null, outdated: false, job: null });
    await translate(id, false);
    const state = await translationState(id);
    expect(state).toMatchObject({ outdated: false, job: { status: "done" } });
    const page = await readPublicRecipe("en", state.slug ?? "");
    expect(page?.view).toMatchObject({
      title: `EN Лечо ${marker}`,
      sections: [
        { code: "drinks", label: "Drinks", href: "/en/catalog/drinks" },
        { code: "sauces", label: "Sauces", href: "/en/catalog/sauces" },
      ],
      tags: [{ id: "protein", label: "Protein" }],
      yield: { forms: ["serving", "servings"] },
    });
    expect(page?.view.steps[0]?.text).toBe("EN Варить 20 минут при 180 °C.");
    expect(page?.view.ingredients[0]).toMatchObject({ quantity: { kind: "exact", amount: { num: 1, den: 1 } }, unit: "кг", kind: "weight" });
    expect(page?.otherSlug).toMatch(/^lecho-/);
    expect((await readPublicRecipe("ru", page?.otherSlug ?? ""))?.otherSlug).toBe(state.slug);
    expect((await readCards("en", { sectionCode: "sauces" })).find((c) => c.slug === state.slug)?.tag).toEqual({ id: "protein", label: "Protein" });
    expect((await readSearchIndex("en")).find((item) => item.slug === state.slug)?.ingredients).toEqual([`EN Томаты`, "EN Соль"]);
    expect((await readCatalog("en")).sections.find((s) => s.code === "drinks")?.recipes).toBe(before + 1);
  });

  it("правка русского — «устарел», на английском прежний; без force не переводится; заново — тот же адрес", async () => {
    const id = await published(`Аджика ${marker}`);
    await translate(id, false);
    const { slug } = await translationState(id);
    const changed = text(`Аджика ${marker} острая`);
    const parsed = parseRecipeText(changed);
    if (!parsed.ok) throw new Error("разбор");
    const [row] = await getDb().select({ revision: recipes.revision }).from(recipes).where(eq(recipes.id, id));
    expect((await replaceRecipe(id, row?.revision ?? 0, parsed, changed)).ok).toBe(true);
    expect(await translationState(id)).toMatchObject({ slug, outdated: true });
    expect((await readPublicRecipe("en", slug ?? ""))?.view.title).toBe(`EN Аджика ${marker}`);
    expect(await enqueueTranslation(id, false)).toBeNull();
    // Повторная публикация того же рецепта — перевод не трогается.
    await setRecipeStatus(id, "published");
    expect(await enqueueTranslation(id, false)).toBeNull();
    await translate(id, true, "EN again");
    expect(await translationState(id)).toMatchObject({ slug, outdated: false });
    expect((await readPublicRecipe("en", slug ?? ""))?.view.title).toBe(`EN again Аджика ${marker} острая`);
  });

  it("неудачный повтор оставляет прежний перевод; поздний ответ старого задания ничего не пишет", async () => {
    const id = await published(`Соус ${marker}`);
    await translate(id, false);
    const { slug } = await translationState(id);
    const job = await enqueueTranslation(id, true);
    if (!job) throw new Error("нет задания");
    // Активное задание не дублируется.
    expect(await enqueueTranslation(id, true)).toBe(job);
    await runJob(job, { translate: failing, config });
    expect(await translationState(id)).toMatchObject({ slug, job: { status: "failed", error: "server" } });
    expect((await readPublicRecipe("en", slug ?? ""))?.view.title).toBe(`EN Соус ${marker}`);

    const next = await enqueueTranslation(id, true);
    if (!next) throw new Error("нет задания");
    const first = await claimJob(next);
    // Аренда истекла (процесс «умер») — задание берут заново с новым token.
    await getDb().update(recipeTranslationJobs).set({ leaseUntil: sql`now() - interval '1 second'` }).where(eq(recipeTranslationJobs.id, next));
    const second = await claimJob(next);
    if (!first || !second) throw new Error("не взяли задание");
    const late = { head: { title: "LATE", description: null, time: null, yieldForms: null }, body: {} as never, sourceContentRevision: 1, model: "x", promptVersion: "x" };
    expect(await finishJob(next, first.token, id, late)).toBe(false);
    expect((await readPublicRecipe("en", slug ?? ""))?.view.title).toBe(`EN Соус ${marker}`);
  });

  it("карточка: первый тег — из снимка, в порядке автора", async () => {
    const source = text(`Смузи ${marker}`).replace("Теги: напитки, соусы, белок", "Теги: напитки, клетчатка, белок");
    const parsed = parseRecipeText(source);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    const saved = await createRecipe(parsed, source, "published");
    if (!saved.ok) throw new Error("не сохранилось");
    created.push(saved.id);
    await translate(saved.id, false);
    const { slug } = await translationState(saved.id);
    expect((await readCards("en")).find((c) => c.slug === slug)?.tag).toEqual({ id: "fiber", label: "Fibre" });
    expect((await readSearchIndex("en")).find((item) => item.slug === slug)).toMatchObject({ tag: { id: "fiber" }, tagCodes: ["fiber", "protein"] });
  });

  it("снят с публикации — нет и на английском; удаление рецепта убирает перевод и задания", async () => {
    const id = await published(`Компот ${marker}`);
    await translate(id, false);
    const { slug } = await translationState(id);
    await setRecipeStatus(id, "draft");
    expect(await readPublicRecipe("en", slug ?? "")).toBeNull();
    expect((await readCards("en")).map((c) => c.slug)).not.toContain(slug);
    await getDb().delete(recipes).where(eq(recipes.id, id));
    expect(await getDb().select().from(recipeTranslationJobs).where(eq(recipeTranslationJobs.recipeId, id))).toEqual([]);
  });

  it("правка во время перевода — перевод по прежнему тексту, сразу «устарел»; снятие во время перевода — скрыт", async () => {
    const id = await published(`Морс ${marker}`);
    const job = await enqueueTranslation(id, false);
    if (!job) throw new Error("нет задания");
    const changed = text(`Морс ${marker} клюквенный`);
    const parsed = parseRecipeText(changed);
    if (!parsed.ok) throw new Error("разбор");
    const [row] = await getDb().select({ revision: recipes.revision }).from(recipes).where(eq(recipes.id, id));
    await replaceRecipe(id, row?.revision ?? 0, parsed, changed);
    await setRecipeStatus(id, "draft");
    await runJob(job, { translate: fake("EN"), config });
    const state = await translationState(id);
    expect(state).toMatchObject({ outdated: true, job: { status: "done" } });
    expect(await readPublicRecipe("en", state.slug ?? "")).toBeNull();
    await setRecipeStatus(id, "published");
    expect((await readPublicRecipe("en", state.slug ?? ""))?.view.title).toBe(`EN Морс ${marker}`);
  });

  it("процесс умер на последней попытке — задание «не получилось», можно перевести заново", async () => {
    const id = await published(`Квас ${marker}`);
    const job = await enqueueTranslation(id, false);
    if (!job) throw new Error("нет задания");
    await claimJob(job);
    await getDb()
      .update(recipeTranslationJobs)
      .set({ attempts: MAX_ATTEMPTS, leaseUntil: sql`now() - interval '1 second'` })
      .where(eq(recipeTranslationJobs.id, job));
    expect(await claimJob(job)).toBeNull();
    await failExhausted();
    expect(await translationState(id)).toMatchObject({ slug: null, job: { status: "failed", error: "lease" } });
    const again = await enqueueTranslation(id, true);
    expect(again).not.toBe(job);
    await runJob(again ?? "", { translate: fake("EN"), config });
    expect(await translationState(id)).toMatchObject({ job: { status: "done" } });
  });
});
