// Перевод рецептов против живой БД (pnpm db:up): `pnpm test:db`. ИИ — подставной «переводчик» (EN перед текстами).
// Раздел «Напитки» — свой у этого файла (счётчики сравниваются; «Заготовки» — у public.db.test.ts).
import { randomUUID } from "node:crypto";

import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { parseRecipeText } from "@/lib/domain/recipe-text/parse";
import { retagText } from "@/lib/domain/recipe-text/retag";
import { type AiTranslation, composeTranslation, type SourceRecipe } from "@/lib/domain/translation";
import { sourceRecipeSchema } from "@/lib/server/ai/translate-schema";
import { type Masked, maskNumbers } from "@/lib/domain/translation-numbers";
import { getDb, getSql } from "@/lib/server/db/client";
import { recipes, recipeTranslationJobs } from "@/lib/server/db/schema";
import type { AiConfig } from "@/lib/server/env";

import { catalogLabels, getCatalog } from "./catalog";
import { readCatalog, readPublicRecipe } from "./public";
import { readCards, readSearchIndex } from "./public-lists";
import { getRecipe } from "./queries";
import { createRecipe, replaceRecipe } from "./save";
import { setRecipeStatus } from "./status";
import { setRecipeTags } from "./tags";
import { claimJob, enqueueTranslation, finishJob, MAX_ATTEMPTS } from "./translation-jobs";
import { failExhausted, translationState } from "./translation-queue";
import { runJob } from "./translation-run";
import { writeTranslation } from "./translation-store";

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

  it("теги на английском — живые, в порядке автора (ADR-0036): «Сохранить теги» видно сразу, перевод не устаревает", async () => {
    const source = text(`Смузи ${marker}`).replace("Теги: напитки, соусы, белок", "Теги: напитки, клетчатка, белок");
    const parsed = parseRecipeText(source);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    const saved = await createRecipe(parsed, source, "published");
    if (!saved.ok) throw new Error("не сохранилось");
    created.push(saved.id);
    await translate(saved.id, false);
    const { slug } = await translationState(saved.id);
    expect((await readCards("en")).find((c) => c.slug === slug)?.tag).toEqual({ id: "fiber", label: "Fiber" });
    expect((await readSearchIndex("en")).find((item) => item.slug === slug)).toMatchObject({ tag: { id: "fiber" }, tagCodes: ["fiber", "protein"] });
    const stored = await getRecipe(saved.id);
    const retagged = retagText(stored?.sourceText ?? "", ["omega-3", "fiber"], catalogLabels(await getCatalog()));
    if (!stored || !retagged.ok) throw new Error("строка тегов не легла");
    expect(await setRecipeTags(saved.id, stored.revision, ["omega-3", "fiber"], retagged.text)).toEqual({ ok: true, revision: stored.revision + 1 });
    expect((await readCards("en")).find((c) => c.slug === slug)?.tag).toEqual({ id: "omega-3", label: "Omega-3" });
    expect((await readPublicRecipe("en", slug ?? ""))?.view.tags.map((tag) => tag.label)).toEqual(["Omega-3", "Fiber"]);
    expect(await translationState(saved.id)).toMatchObject({ slug, outdated: false });
  });

  it("запись числа автора (ADR-0032) переходит в снимок; старый снимок без неё читается — десятичная", async () => {
    const source = text(`Узвар ${marker}`).replace("- Соль — 1 ч. л.", "- Соль — 1/2 ч. л.\n- Сахар — 0,5 ст. л.");
    const parsed = parseRecipeText(source);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    const saved = await createRecipe(parsed, source, "published");
    if (!saved.ok) throw new Error("не сохранилось");
    created.push(saved.id);
    await translate(saved.id, false);
    const { slug } = await translationState(saved.id);
    const styles = async () => (await readPublicRecipe("en", slug ?? ""))?.view.ingredients.map((row) => row.amountStyle);
    expect(await styles()).toEqual([undefined, "fraction", "decimal"]);
    // Снимок, сделанный до ADR-0032, — без поля: страница не падает, строки — без вида.
    await getDb().execute(
      sql`update recipe_translations set body = jsonb_set(body, '{ingredients}', (select jsonb_agg(i - 'amountStyle') from jsonb_array_elements(body -> 'ingredients') i)) where recipe_id = ${saved.id}`,
    );
    expect(await styles()).toEqual([undefined, undefined, undefined]);
  });

  it("состояние для кабинета — один снимок: перевод, завершившийся между чтениями, не даёт «готово без перевода»", async () => {
    const id = await published(`Ряженка ${marker}`);
    const jobId = await enqueueTranslation(id, false);
    const claimed = jobId ? await claimJob(jobId) : null;
    if (!jobId || !claimed) throw new Error("нет задания");
    const done = await fake("EN")(sourceRecipeSchema.parse(claimed.input));
    if (!done.ok) throw new Error("перевод заглушки");
    const saved = { head: done.head, body: done.body, sourceContentRevision: claimed.sourceContentRevision, model: "test/model", promptVersion: "test" };
    // Барьер: таблица заданий заперта, пока кабинет читает состояние; завершаем перевод, когда чтение ждёт блокировку.
    // Два отдельных запроса (прежняя ошибка) увидели бы «перевода нет» до коммита и «done» — после.
    let reading: ReturnType<typeof translationState> | null = null;
    await getDb().transaction(async (tx) => {
      await tx.execute(sql`set local lock_timeout = '10s'`);
      await tx.execute(sql`lock table recipe_translation_jobs in access exclusive mode`);
      reading = translationState(id);
      reading.catch(() => undefined);
      for (let i = 0; ; i += 1) {
        const [row] = await getSql()<{ n: number }[]>`select count(*)::int as n from pg_stat_activity
          where datname = current_database() and wait_event_type = 'Lock' and query ilike '%recipe_translation_jobs%' and pid <> pg_backend_pid()`;
        if ((row?.n ?? 0) > 0) break;
        if (i > 100) throw new Error("чтение состояния не дошло до блокировки");
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      await writeTranslation(tx, id, saved);
      await tx.update(recipeTranslationJobs).set({ status: "done", finishedAt: sql`now()`, leaseUntil: null }).where(eq(recipeTranslationJobs.id, jobId));
    });
    const state = await (reading as ReturnType<typeof translationState> | null);
    expect({ status: state?.job?.status, slug: state?.slug ?? null }).toEqual({ status: "done", slug: expect.stringMatching(/ryazhenka-/) });
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
